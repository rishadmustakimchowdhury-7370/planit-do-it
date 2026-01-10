import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface GenerateTemplateRequest {
  template_purpose: string;
  variables: string[];
  tone: 'formal' | 'friendly' | 'professional';
  company_name?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not configured");
    }

    const body: GenerateTemplateRequest = await req.json();
    const { template_purpose, variables, tone, company_name } = body;

    const toneGuide = {
      formal: 'professional, polished, and business-appropriate',
      friendly: 'warm, personable, and approachable while remaining professional',
      professional: 'balanced, clear, and respectful business communication',
    };

    const variablePlaceholders = variables.length > 0 
      ? `Use these template variables where appropriate: ${variables.map(v => `{{${v}}}`).join(', ')}`
      : 'You can use {{name}} and {{company}} as default variables';

    const systemPrompt = `You are an expert email template designer. Generate professional HTML email templates that work across all email clients.

REQUIREMENTS:
1. Use table-based layouts for maximum email client compatibility
2. Inline all CSS styles
3. Use web-safe fonts: Arial, Helvetica, sans-serif
4. Include proper email structure: header with logo placeholder, main content, footer
5. Use a clean, modern design with good whitespace
6. ${variablePlaceholders}
7. Make the template mobile-responsive using max-width
8. Tone: ${toneGuide[tone]}
9. Company name: ${company_name || 'Company Name'}

Generate ONLY the HTML code, no explanations. Start with <!DOCTYPE html> and end with </html>.`;

    const userPrompt = `Create an email template for: ${template_purpose}

The template should:
- Have a professional header area
- Include a main content section with placeholder text relevant to the purpose
- Have a footer with company info
- Use ${company_name || '{{company}}'} as the company name
- Be visually appealing with good use of colors (use subtle blues/grays)
- Work well on both desktop and mobile

Generate the complete HTML email template now:`;

    console.log("Calling OpenAI API for template generation...");

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 4000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenAI API error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    let generatedHtml = data.choices?.[0]?.message?.content || "";

    // Clean up the response - extract just the HTML
    const htmlMatch = generatedHtml.match(/<!DOCTYPE html>[\s\S]*<\/html>/i);
    if (htmlMatch) {
      generatedHtml = htmlMatch[0];
    } else if (generatedHtml.includes('<html')) {
      // Try to extract from <html> if no DOCTYPE
      const startMatch = generatedHtml.match(/<html[\s\S]*<\/html>/i);
      if (startMatch) {
        generatedHtml = `<!DOCTYPE html>\n${startMatch[0]}`;
      }
    }

    // Remove any markdown code blocks
    generatedHtml = generatedHtml
      .replace(/```html\n?/gi, '')
      .replace(/```\n?/g, '')
      .trim();

    console.log("Template generated successfully");

    return new Response(
      JSON.stringify({ 
        html_content: generatedHtml,
        ai_generated: true,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in ai-generate-template:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
