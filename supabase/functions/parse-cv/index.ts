import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function fetchLinkedInProfile(linkedinUrl: string): Promise<string | null> {
  try {
    console.log('Attempting to fetch LinkedIn profile:', linkedinUrl);
    
    // Clean up the URL
    let cleanUrl = linkedinUrl.trim();
    if (!cleanUrl.startsWith('http')) {
      cleanUrl = 'https://' + cleanUrl;
    }
    
    // Try to fetch the LinkedIn page
    const response = await fetch(cleanUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
    });

    if (!response.ok) {
      console.log('Failed to fetch LinkedIn page:', response.status);
      return null;
    }

    const html = await response.text();
    console.log('Fetched LinkedIn HTML length:', html.length);
    
    // Extract text content from HTML for AI processing
    // Remove scripts and styles
    let text = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    // Limit text length for AI processing
    if (text.length > 15000) {
      text = text.substring(0, 15000);
    }
    
    return text;
  } catch (error) {
    console.error('Error fetching LinkedIn profile:', error);
    return null;
  }
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
      // First try to fetch the LinkedIn profile content
      const linkedinContent = await fetchLinkedInProfile(linkedinUrl);
      
      if (linkedinContent && linkedinContent.length > 100) {
        console.log('Successfully fetched LinkedIn content, sending to AI for parsing');
        messages.push({
          role: 'user',
          content: `Parse this LinkedIn profile content and extract all structured information. The LinkedIn URL is: ${linkedinUrl}

Content from the page:
${linkedinContent}

Please extract the person's name, title, company, location, summary, skills, experience, and education. Return only valid JSON.`
        });
      } else {
        // Fallback: extract info from URL pattern
        console.log('Could not fetch LinkedIn content, using URL-based extraction');
        const urlParts = linkedinUrl.match(/linkedin\.com\/in\/([^\/\?]+)/i);
        const username = urlParts ? urlParts[1] : '';
        
        messages.push({
          role: 'user',
          content: `I have a LinkedIn profile URL: ${linkedinUrl}
          
The username from the URL appears to be: ${username}

Please create a template profile structure based on this URL. Set the linkedin_url field to "${linkedinUrl}" and try to infer the name from the username (${username}) by converting dashes/underscores to spaces and capitalizing appropriately.

For other fields, set them to null since we cannot access the actual profile content. Return only valid JSON.`
        });
      }
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
      throw new Error('Failed to parse CV data from AI response');
    }

    // Ensure linkedin_url is set if we processed a LinkedIn URL
    if (linkedinUrl && !parsedCV.linkedin_url) {
      parsedCV.linkedin_url = linkedinUrl;
    }

    console.log('CV parsing complete');

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
