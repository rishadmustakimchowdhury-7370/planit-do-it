import "https://deno.land/x/xhr@0.1.0/mod.ts";
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
    const body = await req.json();
    const { jobDescription, candidateResume, jobTitle, candidateSkills } = body;
    
    console.log('AI Match request received:', { 
      hasJobDescription: !!jobDescription, 
      hasResume: !!candidateResume,
      jobTitle,
      candidateSkillsCount: Array.isArray(candidateSkills) ? candidateSkills.length : 0
    });
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    const systemPrompt = `You are an expert AI recruitment assistant that analyzes job descriptions and candidate resumes to provide match scores and insights.

Your task is to:
1. Analyze the job requirements and candidate qualifications
2. Calculate a match score (0-100%)
3. Identify key strengths where the candidate matches well
4. Identify skill gaps or areas of improvement
5. Provide a brief explanation of the match

Always respond with valid JSON in this exact format:
{
  "score": <number 0-100>,
  "confidence": <number 0-100>,
  "strengths": ["strength1", "strength2", ...],
  "gaps": ["gap1", "gap2", ...],
  "explanation": "Brief explanation of the match assessment"
}`;

    const userPrompt = `Analyze this job and candidate match:

**Job Title:** ${jobTitle || 'Not specified'}

**Job Description:**
${jobDescription || 'No job description provided'}

**Candidate Resume/Profile:**
${candidateResume || 'No resume provided'}

**Candidate Skills:**
${Array.isArray(candidateSkills) ? candidateSkills.join(', ') : candidateSkills || 'Not specified'}

Please analyze and provide the match assessment.`;

    console.log('Calling OpenAI API for match analysis...');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3,
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

    // Parse the JSON response
    let matchResult;
    try {
      // Extract JSON from potential markdown code blocks
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, content];
      matchResult = JSON.parse(jsonMatch[1].trim());
    } catch (parseError) {
      console.error('Failed to parse AI response:', content);
      // Provide a fallback response
      matchResult = {
        score: 50,
        confidence: 30,
        strengths: ['Unable to fully analyze'],
        gaps: ['Analysis incomplete'],
        explanation: 'Could not complete full analysis. Please try again.'
      };
    }

    console.log('Match analysis complete:', matchResult);

    return new Response(JSON.stringify(matchResult), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in ai-match function:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      score: 0,
      strengths: [],
      gaps: [],
      explanation: 'Error occurred during analysis'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
