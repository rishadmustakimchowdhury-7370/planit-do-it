import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, conversationHistory, faqFlows } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // Check for FAQ matches first
    if (faqFlows && Array.isArray(faqFlows)) {
      const lowerMessage = message.toLowerCase();
      for (const faq of faqFlows) {
        if (lowerMessage.includes(faq.trigger.toLowerCase())) {
          return new Response(JSON.stringify({
            response: faq.response,
            source: 'faq',
            shouldEscalate: false
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }
    }

    const systemPrompt = `You are a helpful customer support chatbot for Recruitsy, an AI-powered recruitment CRM platform.

About Recruitsy:
- Recruitsy helps recruiters manage candidates, jobs, and hiring pipelines
- We offer three plans: Starter ($9/mo), Pro ($29/mo), and Agency ($79/mo)
- Key features include AI CV matching, Kanban pipelines, and team collaboration

Your guidelines:
1. Be friendly, professional, and helpful
2. Keep responses concise (2-3 sentences max)
3. If you can't answer a question or the user seems frustrated, suggest connecting with a human agent
4. For technical issues or account-specific questions, always recommend speaking with support

Respond with JSON:
{
  "response": "Your helpful response",
  "shouldEscalate": true/false (true if user needs human help)
}`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...(conversationHistory || []).slice(-10),
      { role: 'user', content: message }
    ];

    console.log('Calling Lovable AI Gateway for chatbot response...');

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-lite',
        messages,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ 
          response: "I'm experiencing high demand. Please try again in a moment or contact our support team.",
          shouldEscalate: true,
          source: 'error'
        }), {
          status: 200,
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

    let botResponse;
    try {
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, content];
      botResponse = JSON.parse(jsonMatch[1].trim());
    } catch (parseError) {
      // If not valid JSON, treat the content as the response
      botResponse = {
        response: content,
        shouldEscalate: false
      };
    }

    botResponse.source = 'ai';

    return new Response(JSON.stringify(botResponse), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in chatbot function:', error);
    return new Response(JSON.stringify({ 
      response: "I'm having trouble right now. Would you like to speak with a human agent?",
      shouldEscalate: true,
      source: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});