import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  CANDIDATE_STRUCTURED_TOOL,
  CANDIDATE_STRUCTURED_SYSTEM,
  STRUCTURED_SCHEMA_VERSION,
  type StructuredCandidateProfile,
} from "../_shared/structured-schema.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function buildStructuredProfile(
  parsedCV: any,
  apiKey: string,
  linkedinUrl?: string,
): Promise<StructuredCandidateProfile | null> {
  try {
    const sourceJson = JSON.stringify(parsedCV, null, 2);
    const sourceText = `Legacy parsed CV (use as the primary source of truth):\n${sourceJson}${
      linkedinUrl ? `\n\nLinkedIn URL: ${linkedinUrl}` : ""
    }`;

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o",
        temperature: 0.1,
        messages: [
          { role: "system", content: CANDIDATE_STRUCTURED_SYSTEM },
          { role: "user", content: sourceText },
        ],
        tools: [CANDIDATE_STRUCTURED_TOOL],
        tool_choice: { type: "function", function: { name: CANDIDATE_STRUCTURED_TOOL.function.name } },
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error("structured profile call failed:", res.status, body);
      return null;
    }
    const data = await res.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) return null;
    const parsed = JSON.parse(toolCall.function.arguments);
    return {
      schema_version: STRUCTURED_SCHEMA_VERSION,
      full_name: parsed.full_name ?? parsedCV.full_name ?? null,
      current_title: parsed.current_title ?? parsedCV.current_title ?? null,
      current_company: parsed.current_company ?? parsedCV.current_company ?? null,
      seniority: parsed.seniority ?? null,
      industries: parsed.industries ?? [],
      domain_expertise: parsed.domain_expertise ?? [],
      skills: parsed.skills ?? [],
      certifications: parsed.certifications ?? [],
      education: parsed.education ?? [],
      languages: parsed.languages ?? [],
      location: parsed.location ?? {},
      years_experience: parsed.years_experience ?? parsedCV.experience_years ?? null,
      career_progression: parsed.career_progression ?? {
        total_years_experience: parsedCV.experience_years ?? null,
        current_seniority: parsed.seniority ?? null,
        trajectory: null,
      },
      work_history: parsed.work_history ?? [],
      summary: parsed.summary ?? parsedCV.summary ?? null,
    };
  } catch (e) {
    console.error("buildStructuredProfile error:", e);
    return null;
  }
}

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

function normalizeLinkedInProfileUrl(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== 'string') return null;
  let s = raw.trim();
  if (!s || /^(undefined|null|#|javascript:void\(0\)|javascript:;)$/i.test(s) || /^javascript:/i.test(s)) return null;
  const mdLabel = s.match(/^\[([^\]]+)\]\([^)]*\)$/i);
  if (mdLabel) s = mdLabel[1].trim();
  const md = s.match(/\((https?:[^)]+)\)/i);
  if (md) s = md[1];
  if (s.startsWith('//')) s = 'https:' + s;
  if (/^linkedin\.com\//i.test(s)) s = s.replace(/^linkedin\.com\//i, 'https://www.linkedin.com/');
  if (/^www\.linkedin\.com\//i.test(s)) s = s.replace(/^www\.linkedin\.com\//i, 'https://www.linkedin.com/');
  if (/^[a-z]{2}\.linkedin\.com\//i.test(s)) s = s.replace(/^[a-z]{2}\.linkedin\.com\//i, 'https://www.linkedin.com/');
  if (s.startsWith('/in/')) s = 'https://www.linkedin.com' + s;
  let url: URL;
  try { url = new URL(s); } catch { return null; }
  if (!/(^|\.)linkedin\.com$/i.test(url.hostname)) return null;
  url.hostname = 'www.linkedin.com';
  url.protocol = 'https:';
  url.search = '';
  url.hash = '';
  const match = url.pathname.match(/^\/in\/([^/?#\s]+)\/?/i);
  if (!match) return null;
  url.pathname = `/in/${match[1]}`;
  return url.toString();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Batch A / Phase 2 metering state
  let __meterAdmin: any = null;
  let __meterTenant: string | null = null;
  let __meterUser: string | null = null;
  let __meterReserved = false;
  const __meterFeatureKey = "resume_parsing";

  try {
    // ── Authentication + tenant resolution (Batch A / Phase 2) ─────────
    // Preserves backward compatibility: only adds auth/meter, no payload changes.
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const admin = createClient(supabaseUrl, serviceKey);
    const { data: profile } = await admin.from('profiles').select('tenant_id').eq('id', userData.user.id).maybeSingle();
    const tenantId = (profile?.tenant_id as string | null) ?? null;
    __meterAdmin = admin; __meterTenant = tenantId; __meterUser = userData.user.id;
    if (tenantId) {
      const __r = await admin.rpc('check_and_reserve_feature_usage', {
        _tenant_id: tenantId, _feature_key: __meterFeatureKey, _amount: 1, _user_id: userData.user.id,
      });
      if (__r.error) {
        const m = __r.error.message ?? '';
        if (m.includes('FEATURE_LIMIT_EXCEEDED')) {
          return new Response(JSON.stringify({
            error: `Plan limit reached for ${__meterFeatureKey}. Upgrade to continue.`,
            code: 'FEATURE_LIMIT_EXCEEDED', feature_key: __meterFeatureKey, upgrade_required: true,
          }), { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        console.error('[meter] reserve error', m);
      } else { __meterReserved = true; }
    }

    const { cvText, cvBase64, mimeType, linkedinUrl: rawLinkedinUrl, candidate_id, skip_structured } = await req.json();
    const linkedinUrl = normalizeLinkedInProfileUrl(rawLinkedinUrl);
    if (rawLinkedinUrl && !linkedinUrl) {
      return new Response(JSON.stringify({ error: 'LinkedIn URL must be a member profile URL like https://www.linkedin.com/in/username' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
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
      const { username, inferredName } = extractFromLinkedInUrl(linkedinUrl);
      console.log('URL extraction - username:', username, 'inferredName:', inferredName);

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
      console.log('Processing document, mimeType:', mimeType);
      
      const isImage = mimeType.startsWith('image/');
      
      if (isImage) {
        // Use vision capability for image files
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
      } else {
        // For PDF/DOCX: use file input type supported by gpt-4o models
        const fileExtension = mimeType === 'application/pdf' ? 'cv.pdf' 
          : mimeType.includes('wordprocessingml') ? 'cv.docx' 
          : 'cv.pdf';
        
        messages.push({
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Parse this CV/Resume document and extract all structured information. Return only valid JSON.'
            },
            {
              type: 'file',
              file: {
                filename: fileExtension,
                file_data: `data:${mimeType};base64,${cvBase64}`
              }
            }
          ]
        });
      }
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
        model: 'gpt-4o',
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

    console.log('CV parsing complete, generating structured profile...');

    let structured_profile: StructuredCandidateProfile | null = null;
    if (linkedinUrl) {
      parsedCV.linkedin_url = linkedinUrl;
    }

    if (!skip_structured) {
      structured_profile = await buildStructuredProfile(parsedCV, OPENAI_API_KEY, linkedinUrl);
    }

    // Optional direct write to candidates row when caller passes a candidate_id.
    if (candidate_id && structured_profile) {
      try {
        const supabase = createClient(
          Deno.env.get('SUPABASE_URL')!,
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
        );
        await supabase.from('candidates').update({
          structured_profile: structured_profile as any,
          structured_profile_version: STRUCTURED_SCHEMA_VERSION,
          structured_profile_at: new Date().toISOString(),
        }).eq('id', candidate_id);
      } catch (e) {
        console.error('Failed to persist structured_profile:', e);
      }
    }

    return new Response(JSON.stringify({ ...parsedCV, structured_profile }), {
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
