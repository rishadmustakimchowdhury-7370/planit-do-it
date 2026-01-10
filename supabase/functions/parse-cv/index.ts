import "https://deno.land/x/xhr@0.1.0/mod.ts";
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

// Try to fetch LinkedIn page and extract basic info from HTML meta tags
async function fetchLinkedInProfile(linkedinUrl: string): Promise<{
  name?: string;
  title?: string;
  company?: string;
  location?: string;
  summary?: string;
  image?: string;
} | null> {
  try {
    console.log('Attempting to fetch LinkedIn profile:', linkedinUrl);
    
    // Normalize URL
    let url = linkedinUrl.trim();
    if (!url.startsWith('http')) {
      url = 'https://' + url;
    }
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
    });
    
    if (!response.ok) {
      console.log('LinkedIn fetch failed with status:', response.status);
      return null;
    }
    
    const html = await response.text();
    console.log('Fetched LinkedIn HTML length:', html.length);
    
    // Extract data from meta tags and structured data
    const result: any = {};
    
    // Extract from og:title (usually contains name and headline)
    const ogTitle = html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i);
    if (ogTitle) {
      const titleContent = ogTitle[1];
      console.log('Found og:title:', titleContent);
      
      // LinkedIn og:title format: "Name - Title | LinkedIn" or "Name | LinkedIn"
      const parts = titleContent.split(' - ');
      if (parts.length >= 1) {
        result.name = parts[0].replace(' | LinkedIn', '').trim();
      }
      if (parts.length >= 2) {
        result.title = parts[1].replace(' | LinkedIn', '').trim();
      }
    }
    
    // Extract from og:description (usually contains summary)
    const ogDesc = html.match(/<meta[^>]+property="og:description"[^>]+content="([^"]+)"/i);
    if (ogDesc) {
      result.summary = ogDesc[1].replace(/&#[0-9]+;/g, ' ').trim();
      console.log('Found og:description:', result.summary?.substring(0, 100));
    }
    
    // Extract from og:image
    const ogImage = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i);
    if (ogImage) {
      result.image = ogImage[1];
    }
    
    // Try to extract location from page content
    const locationMatch = html.match(/<span[^>]*class="[^"]*location[^"]*"[^>]*>([^<]+)</i);
    if (locationMatch) {
      result.location = locationMatch[1].trim();
    }
    
    // Try to extract from JSON-LD structured data
    const jsonLdMatch = html.match(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi);
    if (jsonLdMatch) {
      for (const match of jsonLdMatch) {
        try {
          const jsonContent = match.replace(/<script[^>]*>/i, '').replace(/<\/script>/i, '');
          const jsonData = JSON.parse(jsonContent);
          
          if (jsonData['@type'] === 'Person') {
            result.name = result.name || jsonData.name;
            result.title = result.title || jsonData.jobTitle;
            if (jsonData.worksFor) {
              result.company = jsonData.worksFor.name || jsonData.worksFor;
            }
            if (jsonData.address) {
              result.location = jsonData.address.addressLocality || jsonData.address;
            }
            console.log('Found JSON-LD Person data:', JSON.stringify(jsonData).substring(0, 200));
          }
        } catch (e) {
          // Ignore JSON parse errors
        }
      }
    }
    
    // Extract headline/title from common LinkedIn patterns
    const headlineMatch = html.match(/<h2[^>]*class="[^"]*headline[^"]*"[^>]*>([^<]+)</i);
    if (headlineMatch && !result.title) {
      result.title = headlineMatch[1].trim();
    }
    
    // Try to extract current company from headline
    if (result.title && result.title.includes(' at ')) {
      const atParts = result.title.split(' at ');
      result.title = atParts[0].trim();
      result.company = atParts[1].trim();
    } else if (result.title && result.title.includes(' @ ')) {
      const atParts = result.title.split(' @ ');
      result.title = atParts[0].trim();
      result.company = atParts[1].trim();
    }
    
    console.log('Extracted LinkedIn data:', JSON.stringify(result));
    return Object.keys(result).length > 0 ? result : null;
    
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
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not configured');
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
      
      // Try to fetch actual LinkedIn profile data
      const linkedInData = await fetchLinkedInProfile(linkedinUrl);
      
      // Extract info from URL as fallback
      const { username, inferredName } = extractFromLinkedInUrl(linkedinUrl);
      console.log('URL extraction - username:', username, 'inferredName:', inferredName);
      
      if (linkedInData && (linkedInData.name || linkedInData.title)) {
        // We got some data from LinkedIn
        console.log('Successfully extracted LinkedIn data:', JSON.stringify(linkedInData));
        
        messages.push({
          role: 'user',
          content: `I have extracted the following information from a LinkedIn profile at ${linkedinUrl}:

Name: ${linkedInData.name || inferredName || 'Unknown'}
Current Title/Headline: ${linkedInData.title || 'Not available'}
Company: ${linkedInData.company || 'Not available'}
Location: ${linkedInData.location || 'Not available'}
Summary/About: ${linkedInData.summary || 'Not available'}

Please create a structured candidate profile JSON from this information:
1. full_name: Use "${linkedInData.name || inferredName}"
2. current_title: ${linkedInData.title ? `Use "${linkedInData.title}"` : 'null'}
3. current_company: ${linkedInData.company ? `Use "${linkedInData.company}"` : 'null'}
4. location: ${linkedInData.location ? `Use "${linkedInData.location}"` : 'null'}
5. summary: ${linkedInData.summary ? `Create a brief professional summary based on: "${linkedInData.summary.substring(0, 500)}"` : 'null'}
6. linkedin_url: "${linkedinUrl}"
7. email, phone: null (not available from LinkedIn)
8. skills: Try to infer relevant skills based on the title and summary if available, otherwise empty array
9. experience_years: Try to estimate based on the title seniority (e.g., "Senior" = 5+, "Lead" = 7+, "Director" = 10+), otherwise null

IMPORTANT: Return ONLY valid JSON, no markdown, no explanations.`
        });
      } else {
        // Could not fetch LinkedIn data, use URL-based extraction
        console.log('Could not fetch LinkedIn data, using URL extraction');
        
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
      }
    } else if (cvBase64 && mimeType) {
      // Use vision capability for PDF/document files
      console.log('Processing document with vision API, mimeType:', mimeType);
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

    console.log('Calling OpenAI API for CV parsing...');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
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
      const errorText = await response.text();
      console.error('OpenAI API error:', response.status, errorText);
      throw new Error(`OpenAI API error: ${response.status}`);
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
