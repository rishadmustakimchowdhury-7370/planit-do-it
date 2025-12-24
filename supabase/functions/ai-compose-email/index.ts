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
      custom: customPrompt || 'general outreach to the candidate',
    };

    let systemPrompt: string;
    let userPrompt: string;

    if (isMarketing) {
      // Marketing email generation
      const marketingPurpose = marketingPurposeGuide[purpose] || customPrompt || 'a general marketing email';
      
      systemPrompt = `You are an expert marketing email copywriter for HireMetrics CRM, a modern recruitment software platform. Write compelling, professional marketing emails that drive engagement and conversions.

STRUCTURE:
1. Greeting: Start with a warm, professional greeting (e.g., "Hi there," or "Hello,")
2. [blank line]
3. Opening Hook: 1-2 sentences that capture attention and establish relevance
4. [blank line]
5. Main Content: 2-3 paragraphs explaining the value proposition, benefits, or announcement
6. [blank line]
7. Call to Action: Clear, compelling CTA with urgency if appropriate
8. [blank line]
9. Sign-off: "Best regards," followed by "The HireMetrics Team"

CRITICAL RULES:
- Tone: ${toneGuide[tone]}
- Write for mass email delivery to ${recipientCount || 'multiple'} recipients
- NO placeholder variables like {{name}} - keep greetings general
- NO markdown, NO HTML tags in the output
- Make it scannable with short paragraphs
- Include a clear benefit-focused call to action
- Keep it under 200 words for optimal engagement
- Be genuine and avoid overly salesy language
- ALSO suggest a compelling subject line at the END in format: "SUBJECT: [your subject line here]"`;

      userPrompt = `Write a marketing email for: ${marketingPurpose}

Additional context/instructions: ${customPrompt || 'None provided'}

Generate a professional marketing email that will resonate with recruitment professionals and hiring managers. Remember to suggest a subject line at the end.`;
    } else {
      // Original recruitment email generation
      const purposeGuide = recruitmentPurposeGuide;

      systemPrompt = `You are an expert recruitment email writer. You MUST follow this EXACT structure for every email:

STRUCTURE (follow exactly - use ACTUAL candidate name, job title, and location provided, NOT placeholders):
1. Greeting: "Hi ${candidate_first_name}," (use the actual first name provided, on its own line)
2. [blank line]
3. Paragraph 1: Introduction and context (2-3 sentences explaining who you are and why you're reaching out about the ${job_title} role${location ? ` in ${location}` : ''})
4. [blank line]
5. Paragraph 2: Value proposition / main message (2-3 sentences about the opportunity or key information)
6. [blank line]
7. Paragraph 3: Call to action or closing (1-2 sentences with clear next steps)
8. [blank line]
9. Sign-off: "Best regards," (on its own line, NO signature block after - the system adds signature automatically)

CRITICAL FORMATTING RULES:
- Tone: ${toneGuide[tone]}
- ALWAYS use the actual candidate name "${candidate_first_name}" in the greeting, NOT a placeholder
- ALWAYS mention the actual job title "${job_title}"${location ? ` and location "${location}"` : ''} in the email body
- Company name to use: ${company_name || 'our client company'}
- Recruiter signing off: ${recruiter_name}
- Use exactly 3 distinct paragraphs with DOUBLE LINE BREAKS between them for clear visual separation
- NO markdown, NO HTML, NO bullet points, NO numbered lists
- NO placeholder text like {{variable}}, [insert here], or brackets - use actual values provided
- NO subject line - only the email body
- End with "Best regards," - do NOT add any name or signature after it
- Each paragraph should be substantial (2-3 complete sentences)
- IMPORTANT: Separate each paragraph with TWO newlines (blank line between them) for proper formatting`;

      userPrompt = `Write a recruitment email for: ${purposeGuide[purpose] || 'general outreach'}

ACTUAL VALUES TO USE (NOT placeholders):
- Candidate First Name: ${candidate_first_name}
- Candidate Last Name: ${candidate_last_name || ''}
- Job Position: ${job_title}
- Location: ${location || 'flexible/remote'}
- Company Name: ${company_name || 'our client company'}
- Your Name (Recruiter): ${recruiter_name}
${customPrompt ? `\nAdditional Instructions: ${customPrompt}` : ''}

REQUIREMENTS:
1. Start with "Hi ${candidate_first_name}," as the greeting
2. Write 3 distinct paragraphs separated by blank lines
3. Mention the ${job_title} role${location ? ` in ${location}` : ''} naturally in the content
4. End with "Best regards," only - no name or signature after
5. Use actual values above, NOT template variables or placeholders

Generate the email now:`;
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
