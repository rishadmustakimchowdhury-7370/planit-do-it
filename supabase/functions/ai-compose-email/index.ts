import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ComposeRequest {
  candidate_first_name: string;
  candidate_last_name?: string;
  job_title: string;
  location?: string;
  company_name?: string;
  recruiter_name: string;
  purpose: 'screening_call' | 'interview_invite' | 'job_pitch' | 'follow_up' | 'offer' | 'rejection' | 'custom';
  tone: 'brief' | 'formal' | 'friendly';
  length: 'short' | 'medium' | 'long';
  template_context?: string;
  custom_instructions?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const body: ComposeRequest = await req.json();
    const {
      candidate_first_name,
      candidate_last_name,
      job_title,
      location,
      company_name,
      recruiter_name,
      purpose,
      tone,
      length,
      template_context,
      custom_instructions,
    } = body;

    // Build the AI prompt
    const lengthGuide = {
      short: '2-3 sentences, under 100 words',
      medium: '1-2 paragraphs, 100-200 words',
      long: '2-3 paragraphs, 200-300 words',
    };

    const toneGuide = {
      brief: 'concise and to-the-point, no fluff',
      formal: 'professional and polished business tone',
      friendly: 'warm, personable, and approachable',
    };

    const purposeGuide: Record<string, string> = {
      screening_call: 'inviting the candidate to a phone screening call',
      interview_invite: 'inviting the candidate to an interview',
      job_pitch: 'presenting a job opportunity to the candidate',
      follow_up: 'following up on a previous conversation or application',
      offer: 'extending a job offer to the candidate',
      rejection: 'politely declining the candidate for the position',
      custom: custom_instructions || 'general outreach to the candidate',
    };

    const systemPrompt = `You are a professional recruitment email writer. Generate plain-text emails that are ${toneGuide[tone]}.
Use merge placeholders like {{candidate_first_name}}, {{job_title}}, {{company_name}}, {{recruiter_name}} where appropriate.
Keep the email ${lengthGuide[length]}.
Write a complete, ready-to-send email: greeting, short intro, 1-2 short paragraphs with clear value, a specific call-to-action, and a polite closing.
Do NOT include HTML tags, markdown, or any instructional text like [insert here] or TODOs.
Do NOT include a subject line - only the email body.
End with a professional closing but do NOT include a signature block.`;

    const userPrompt = `Write an email for the purpose of: ${purposeGuide[purpose]}

Details:
- Candidate: ${candidate_first_name}${candidate_last_name ? ' ' + candidate_last_name : ''}
- Job Title: ${job_title}
- Location: ${location || 'Not specified'}
- Company: ${company_name || 'our company'}
- Recruiter: ${recruiter_name}
${template_context ? `\nContext from template: ${template_context}` : ''}
${custom_instructions ? `\nAdditional instructions: ${custom_instructions}` : ''}

Generate a ${tone} email that is ${length} in length.`;

    console.log("Calling Lovable AI for email composition...");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add funds to continue." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const generatedText = data.choices?.[0]?.message?.content || "";

    console.log("Email generated successfully");

    return new Response(
      JSON.stringify({ 
        email_body: generatedText.trim(),
        ai_generated: true,
        purpose,
        tone,
        length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in ai-compose-email:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
