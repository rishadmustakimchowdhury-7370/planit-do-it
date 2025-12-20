import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Extract meaningful data from LinkedIn URL
function extractFromLinkedInUrl(linkedinUrl: string): { username: string; inferredName: string } {
  const urlParts = linkedinUrl.match(/linkedin\.com\/in\/([^\/\?]+)/i);
  const username = urlParts ? urlParts[1].replace(/-/g, ' ').replace(/_/g, ' ') : '';
  
  // Convert username to proper name format
  const inferredName = username
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
  
  return { username, inferredName };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { cvText, cvBase64, mimeType, linkedinUrl } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const systemPrompt = `You are an expert CV/Resume parser. Extract structured information from resumes and LinkedIn profiles.

Always respond with valid JSON in this exact format:
{
  "full_name": "string",
  "email": "string or null",
  "phone": "string or null",
  "location": "string or null",
  "current_title": "string or null",
  "current_company": "string or null",
  "linkedin_url": "string or null",
  "summary": "string - brief professional summary",
  "experience_years": number or null,
  "skills": ["skill1", "skill2", ...],
  "education": [
    {
      "degree": "string",
      "institution": "string",
      "year": "string or null"
    }
  ],
  "work_history": [
    {
      "title": "string",
      "company": "string",
      "duration": "string",
      "description": "string"
    }
  ]
}

Extract as much information as possible. For LinkedIn profiles, look for:
- Name from the profile heading
- Current job title and company
- Location
- Summary/About section
- Experience history
- Education
- Skills

If certain information is not available, use null for those fields.`;

    let messages: any[] = [{ role: 'system', content: systemPrompt }];
    
    if (linkedinUrl) {
      console.log('Processing LinkedIn URL:', linkedinUrl);
      
      // Extract info from URL pattern since direct LinkedIn fetch is blocked
      const { username, inferredName } = extractFromLinkedInUrl(linkedinUrl);
      console.log('Extracted from URL - username:', username, 'inferredName:', inferredName);
      
      // Use AI to create a reasonable profile template based on the URL
      messages.push({
        role: 'user',
        content: `I have a LinkedIn profile URL: ${linkedinUrl}

The username extracted from the URL is: "${username}"
The inferred name (formatted from username) is: "${inferredName}"

Please create a candidate profile with:
1. full_name: Use "${inferredName}" as the name
2. linkedin_url: Set to "${linkedinUrl}"
3. All other fields should be null since we cannot access the actual LinkedIn content (LinkedIn requires authentication to view profiles)

IMPORTANT: Return ONLY valid JSON, no markdown, no explanations.`
      });
    } else if (cvBase64 && mimeType) {
      // Use multimodal capability for PDF/document files
      console.log('Processing document with multimodal API, mimeType:', mimeType);
      messages.push({
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Parse this CV/Resume document and extract all structured information. Return only valid JSON.'
          },
          {
            type: 'image_url',
            image_url: {
              url: `data:${mimeType};base64,${cvBase64}`
            }
          }
        ]
      });
    } else if (cvText) {
      messages.push({
        role: 'user',
        content: `Parse this CV/Resume and extract structured information:

${cvText}`
      });
    } else {
      throw new Error('Either cvText, cvBase64, or linkedinUrl must be provided');
    }

    console.log('Calling Lovable AI Gateway for CV parsing...');

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages,
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'AI credits exhausted. Please add more credits.' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('No response from AI');
    }

    console.log('AI Response:', content.substring(0, 500));

    // Parse the JSON response
    let parsedCV;
    try {
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, content];
      const jsonStr = jsonMatch[1].trim();
      // Try to find JSON object in the response
      const jsonStart = jsonStr.indexOf('{');
      const jsonEnd = jsonStr.lastIndexOf('}');
      if (jsonStart !== -1 && jsonEnd !== -1) {
        parsedCV = JSON.parse(jsonStr.substring(jsonStart, jsonEnd + 1));
      } else {
        parsedCV = JSON.parse(jsonStr);
      }
    } catch (parseError) {
      console.error('Failed to parse AI response:', content);
      
      // If parsing failed for LinkedIn URL, return a basic structure
      if (linkedinUrl) {
        const { inferredName } = extractFromLinkedInUrl(linkedinUrl);
        parsedCV = {
          full_name: inferredName,
          email: null,
          phone: null,
          location: null,
          current_title: null,
          current_company: null,
          linkedin_url: linkedinUrl,
          summary: null,
          experience_years: null,
          skills: [],
          education: [],
          work_history: []
        };
      } else {
        throw new Error('Failed to parse CV data from AI response');
      }
    }

    // Ensure linkedin_url is set if we processed a LinkedIn URL
    if (linkedinUrl && !parsedCV.linkedin_url) {
      parsedCV.linkedin_url = linkedinUrl;
    }

    // Ensure experience_years is an integer (AI might return decimals like "1.5")
    if (parsedCV.experience_years !== null && parsedCV.experience_years !== undefined) {
      const expYears = parseFloat(parsedCV.experience_years);
      if (!isNaN(expYears)) {
        parsedCV.experience_years = Math.floor(expYears);
      } else {
        parsedCV.experience_years = null;
      }
    }

    console.log('CV parsing complete, result:', JSON.stringify(parsedCV));

    return new Response(JSON.stringify(parsedCV), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in parse-cv function:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});