import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ComposeRequest {
  candidate_first_name?: string;
  candidate_last_name?: string;
  job_title?: string;
  location?: string;
  company_name?: string;
  recruiter_name?: string;
  purpose: 'screening_call' | 'interview_invite' | 'job_pitch' | 'follow_up' | 'offer' | 'rejection' | 'custom' | 'promotion' | 'newsletter' | 'announcement' | 'reengagement' | 'welcome' | 'upgrade';
  tone?: 'brief' | 'formal' | 'friendly';
  length?: 'short' | 'medium' | 'long';
  template_context?: string;
  custom_instructions?: string;
  customInstructions?: string;
  recipientCount?: number;
  isMarketing?: boolean;
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
      tone = 'friendly',
      length = 'medium',
      template_context,
      custom_instructions,
      customInstructions,
      recipientCount,
      isMarketing,
    } = body;

    const customPrompt = customInstructions || custom_instructions;

    // Build the AI prompt with strict structure enforcement
    const toneGuide: Record<string, string> = {
      brief: 'concise and to-the-point, no fluff',
      formal: 'professional and polished business tone',
      friendly: 'warm, personable, and approachable',
    };

    // Marketing email purposes
    const marketingPurposeGuide: Record<string, string> = {
      promotion: 'a promotional email offering a special deal or discount on our recruitment CRM platform',
      newsletter: 'a newsletter email with updates, tips, and news about recruitment industry',
      announcement: 'an announcement email about new features or important updates to our platform',
      reengagement: 're-engagement email to inactive users encouraging them to return to the platform',
      welcome: 'a welcome email for new users who just signed up',
      upgrade: 'an upgrade reminder email encouraging users to upgrade to a paid plan',
    };

    const recruitmentPurposeGuide: Record<string, string> = {
      screening_call: 'inviting the candidate to a phone screening call',
      interview_invite: 'inviting the candidate to an interview',
      job_pitch: 'presenting a job opportunity to the candidate',
      follow_up: 'following up on a previous conversation or application',
      offer: 'extending a job offer to the candidate',
      rejection: 'politely declining the candidate for the position',
      custom: customPrompt || 'general outreach',
    };

    // Client email purposes
    const clientPurposeGuide: Record<string, string> = {
      custom: customPrompt || 'professional business communication with a client',
    };

    let systemPrompt: string;
    let userPrompt: string;

    if (isMarketing) {
      // Marketing email generation
      const marketingPurpose = marketingPurposeGuide[purpose] || customPrompt || 'a general marketing email';
      
      systemPrompt = `You are an expert marketing email copywriter for HireMetrics CRM, a modern recruitment software platform. Write compelling, professional marketing emails that drive engagement and conversions.

PROFESSIONAL EMAIL STRUCTURE (follow exactly):

**SECTION 1 - GREETING:**
"Hi there," or "Hello,"

**SECTION 2 - INTRODUCTION (Opening Hook):**
1-2 sentences that capture attention and establish relevance. State the purpose of your email.

**SECTION 3 - BODY (Main Message):**
2-3 short paragraphs (each 2-3 sentences max):
- Paragraph 1: Explain the main value or announcement
- Paragraph 2: Highlight key benefits or details
- Paragraph 3 (optional): Additional context or supporting information

**SECTION 4 - CALL TO ACTION:**
1-2 sentences with a clear, compelling call to action.

**SECTION 5 - CLOSING:**
"Best regards,"
"The HireMetrics Team"

CRITICAL RULES:
- Tone: ${toneGuide[tone]}
- Write for mass email delivery to ${recipientCount || 'multiple'} recipients
- NO placeholder variables like {{name}} - keep greetings general
- NO markdown, NO HTML tags in the output
- Make each paragraph SHORT (2-3 sentences max)
- Keep total length under 200 words
- Use proper paragraph spacing (blank line between each section)
- ALSO suggest a compelling subject line at the END in format: "SUBJECT: [your subject line here]"`;

      userPrompt = `Write a marketing email for: ${marketingPurpose}

Additional context/instructions: ${customPrompt || 'None provided'}

Generate a professional, well-structured marketing email. Remember to suggest a subject line at the end.`;
    } else {
      // Recruitment or Client email generation
      const isClientEmail = !candidate_first_name && company_name;
      const recipientName = candidate_first_name || company_name?.split(' ')[0] || 'there';
      const fullRecipientName = candidate_first_name 
        ? `${candidate_first_name}${candidate_last_name ? ' ' + candidate_last_name : ''}`
        : company_name || 'there';
      const purposeGuide = isClientEmail ? clientPurposeGuide : recruitmentPurposeGuide;

      // Client outreach email prompt
      if (isClientEmail) {
        systemPrompt = `You are a senior recruitment communication strategist. Generate a professional client outreach email that is ready to be sent from Gmail and Outlook without any formatting changes.

CRITICAL FORMATTING RULES:
- Use short paragraphs (2-3 lines max)
- Leave ONE blank line between paragraphs
- No bullet points
- No emojis
- No markdown symbols (no *, **, -, #, etc.)
- No bold or italics
- No HTML tags
- Do not repeat the subject in the body
- No placeholder brackets

EMAIL STRUCTURE (mandatory - follow exactly):

1. GREETING:
Hello ${fullRecipientName},

2. FIRST PARAGRAPH (Context & Relevance):
2-3 sentences. Introduce yourself and your recruitment firm. Mention your specialization in the relevant industry.

3. SECOND PARAGRAPH (Value Proposition):
2-3 sentences. Explain how you support companies by delivering pre-vetted candidates, reducing time-to-hire and hiring risk. Focus on quality, speed, and long-term placement success.

4. FINAL PARAGRAPH (Call to Action):
1-2 sentences. Clear invitation for a short conversation to understand their requirements.

5. CLOSING:
Kind regards,

(System adds signature - stop here, do NOT add any name or signature details)

TONE: Professional, direct, confident, global business standard.
OUTPUT: Only the email body starting from "Hello" and ending with "Kind regards,"`;

        userPrompt = `Write a client outreach email.

CLIENT COMPANY: ${company_name}
INDUSTRY: ${customPrompt || 'general business'}
RECRUITER NAME: ${recruiter_name}
RECRUITMENT FIRM: [Will be added from branding]
PURPOSE: ${purposeGuide[purpose] || 'exploring recruitment partnership'}

Generate ONLY the email body. Start with "Hello ${fullRecipientName}," and end with "Kind regards,"`;

      } else {
        // Candidate outreach email prompt
        systemPrompt = `You are a senior recruitment communication strategist. Generate a professional candidate outreach email that is ready to be sent from Gmail and Outlook without any formatting changes.

CRITICAL FORMATTING RULES:
- Use short paragraphs (2-3 lines max)
- Leave ONE blank line between paragraphs
- No bullet points
- No emojis
- No markdown symbols (no *, **, -, #, etc.)
- No bold or italics
- No HTML tags
- Do not repeat the subject in the body
- No placeholder brackets

EMAIL STRUCTURE (mandatory - follow exactly):

1. GREETING:
Hello ${recipientName},

2. FIRST PARAGRAPH (Context & Relevance):
2-3 sentences. Briefly introduce yourself. Explain why you are reaching out and how you found them or why they are a good fit.

3. SECOND PARAGRAPH (Opportunity Details):
2-3 sentences. Present the role and its key highlights. Mention the company if appropriate and what makes this opportunity compelling.

4. FINAL PARAGRAPH (Call to Action):
1-2 sentences. Clear next step - invite them for a call or ask for their availability.

5. CLOSING:
Kind regards,

(System adds signature - stop here, do NOT add any name or signature details)

TONE: Professional, direct, confident, warm but not overly casual.
OUTPUT: Only the email body starting from "Hello" and ending with "Kind regards,"`;

        const purposeDetails: Record<string, string> = {
          job_pitch: `presenting an exciting ${job_title || 'career'} opportunity${company_name ? ` at ${company_name}` : ''}`,
          screening_call: `inviting them for a phone screening for the ${job_title || 'position'}`,
          interview_invite: `inviting them for an interview for the ${job_title || 'role'}`,
          follow_up: `following up on their application for ${job_title || 'the position'}`,
          offer: `extending a job offer for the ${job_title || 'position'}`,
          rejection: `providing an update on their application for ${job_title || 'the position'} (professional decline)`,
          custom: customPrompt || 'general candidate outreach',
        };

        userPrompt = `Write a candidate outreach email.

PURPOSE: ${purposeDetails[purpose] || 'general outreach'}
CANDIDATE: ${fullRecipientName}
${job_title ? `POSITION: ${job_title}` : ''}
${company_name ? `COMPANY: ${company_name}` : ''}
${location ? `LOCATION: ${location}` : ''}
RECRUITER: ${recruiter_name}
${customPrompt ? `ADDITIONAL CONTEXT: ${customPrompt}` : ''}

Generate ONLY the email body. Start with "Hello ${recipientName}," and end with "Kind regards,"`;
      }
    }

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
    let generatedText = data.choices?.[0]?.message?.content || "";

    // Extract subject line for marketing emails
    let suggestedSubject = '';
    if (isMarketing) {
      const subjectMatch = generatedText.match(/SUBJECT:\s*(.+?)(?:\n|$)/i);
      if (subjectMatch) {
        suggestedSubject = subjectMatch[1].trim();
        generatedText = generatedText.replace(/SUBJECT:\s*.+?(?:\n|$)/i, '').trim();
      }
    }

    // Clean up and ensure proper paragraph formatting
    generatedText = generatedText
      .trim()
      .replace(/\{\{[^}]+\}\}/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/^(Hi [^,]+,)\s*\n?/i, '$1\n\n');

    console.log("Email generated successfully");

    return new Response(
      JSON.stringify({ 
        email_body: generatedText,
        suggested_subject: suggestedSubject || undefined,
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
