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

    // Build the AI prompt with strict structure enforcement
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

    // Strict formatting rules for professional emails
    const systemPrompt = `You are an expert recruitment email writer. You MUST follow this EXACT structure for every email:

STRUCTURE (follow exactly):
1. Greeting: "Hi {{candidate_first_name}}," (always on its own line)
2. [blank line]
3. Paragraph 1: Introduction and context (2-3 sentences explaining who you are and why you're reaching out)
4. [blank line]
5. Paragraph 2: Value proposition / main message (2-3 sentences about the opportunity or key information)
6. [blank line]
7. Paragraph 3: Call to action or closing (1-2 sentences with clear next steps)
8. [blank line]
9. Sign-off: "Best regards," (on its own line, NO signature block after - the system adds signature automatically)

RULES:
- Tone: ${toneGuide[tone]}
- Always use exactly 3 logical paragraphs with clear spacing between them
- Use {{candidate_first_name}}, {{job_title}}, {{company_name}}, {{recruiter_name}} placeholders
- NO markdown, NO HTML, NO bullet points, NO numbered lists
- NO instructional text like [insert here] or placeholders in brackets
- NO subject line - only the email body
- End with "Best regards," - do NOT add any name or signature after it
- Each paragraph should be substantial (2-3 complete sentences)`;

    const userPrompt = `Write a recruitment email for: ${purposeGuide[purpose]}

Context:
- Candidate Name: {{candidate_first_name}} (use this placeholder)
- Position: ${job_title}
- Location: ${location || 'flexible/remote'}
- Company: ${company_name || 'our client company'}
- Recruiter: ${recruiter_name}
${custom_instructions ? `\nSpecial instructions: ${custom_instructions}` : ''}

Generate the email following the exact structure specified. Remember: 3 clear paragraphs, proper spacing, end with "Best regards," only.`;

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
