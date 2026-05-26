import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { computeMatchScore, MODEL_VERSION } from "../_shared/match-scoring.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Validation enriches the centralized deterministic match score with recruiter-facing
// narrative. It NEVER produces its own score — the score comes from the same engine
// used by AI Talent Match (rediscover-candidates / hybrid_v1) so the same candidate
// always shows the same number across the app.
const SYSTEM_PROMPT = `You are a senior recruitment evaluator. You are given a job, a candidate, and a DETERMINISTIC fit score that has ALREADY been computed by the platform's centralized scoring engine.

Your job: produce a recruiter-facing narrative — strengths, considerations, risks, and a short executive summary — that EXPLAINS the score. Do NOT invent or override the score.

Return ONLY valid JSON in this exact shape:
{
  "summary": "<2-3 sentence executive summary that reflects the given fit_score>",
  "strengths": ["...", "..."],
  "weaknesses": ["...", "..."],
  "risks": ["...", "..."]
}

Rules:
- 2-5 short bullets per list, specific to this candidate vs this JD.
- The summary tone must match the given fit_score band (Strongly Recommended ≥90, Recommended 75-89, Moderate 60-74, Low <60).`;

function recommendationFromScore(score: number): "strongly_recommended" | "needs_review" | "not_recommended" {
  if (score >= 75) return "strongly_recommended";
  if (score >= 50) return "needs_review";
  return "not_recommended";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userId = userData.user.id;

    const { job_id, candidate_id, force } = await req.json();
    if (!job_id || !candidate_id) {
      return new Response(JSON.stringify({ error: "job_id and candidate_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Load job + candidate via RLS (user must have access)
    const [{ data: job, error: jobErr }, { data: candidate, error: candErr }] = await Promise.all([
      supabase.from("jobs").select("id, tenant_id, title, description, requirements, location, employment_type, experience_level, skills, jd_parsed_text").eq("id", job_id).maybeSingle(),
      supabase.from("candidates").select("id, full_name, current_title, current_company, location, experience_years, skills, summary, cv_parsed_data").eq("id", candidate_id).maybeSingle(),
    ]);

    if (jobErr || !job) {
      return new Response(JSON.stringify({ error: "Job not found or access denied" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (candErr || !candidate) {
      return new Response(JSON.stringify({ error: "Candidate not found or access denied" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // === SINGLE SOURCE OF TRUTH ===
    // The authoritative fit score is the deterministic hybrid_v1 score produced
    // by rediscover-candidates and stored on rediscovered_matches. We read it here
    // and reuse it so AI Talent Match and AI Validation NEVER disagree.
    const { data: canonical } = await supabase
      .from("rediscovered_matches")
      .select("match_score, sub_scores, confidence, model_version, ai_summary, strengths, gaps")
      .eq("job_id", job_id)
      .eq("candidate_id", candidate_id)
      .maybeSingle();

    // Reuse recent enrichment unless force=true
    if (!force) {
      const { data: existing } = await supabase
        .from("ai_candidate_validations")
        .select("*")
        .eq("job_id", job_id)
        .eq("candidate_id", candidate_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      // Only reuse if the cached validation's fit_score matches the canonical score.
      // If they diverge (e.g. score was re-computed), re-enrich.
      if (existing && (!canonical || existing.fit_score === canonical.match_score)) {
        return new Response(JSON.stringify({
          validation: { ...existing, sub_scores: canonical?.sub_scores ?? null, confidence: canonical?.confidence ?? null, scoring_version: canonical?.model_version ?? "hybrid_v1" },
          cached: true,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      return new Response(JSON.stringify({ error: "OPENAI_API_KEY not configured" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const canonicalScore = canonical?.match_score ?? null;
    const confidence = canonical?.confidence ?? null;
    const scoringVersion = canonical?.model_version ?? "hybrid_v1";

    const userPrompt = `CENTRALIZED SCORE (do NOT change): ${canonicalScore != null ? canonicalScore + "/100" : "not yet computed — produce an honest narrative without inventing a number"}
${canonical?.sub_scores ? "Sub-scores: " + JSON.stringify(canonical.sub_scores) : ""}

JOB
Title: ${job.title}
Seniority: ${job.experience_level ?? "n/a"}
Location: ${job.location ?? "n/a"}
Employment: ${job.employment_type ?? "n/a"}
Description:
${job.description ?? ""}
${job.jd_parsed_text ?? ""}
Requirements:
${typeof job.requirements === "string" ? job.requirements : JSON.stringify(job.requirements ?? "")}

CANDIDATE
Name: ${candidate.full_name}
Current Role: ${candidate.current_title ?? "n/a"} @ ${candidate.current_company ?? "n/a"}
Location: ${candidate.location ?? "n/a"}
Experience: ${candidate.experience_years ?? "n/a"} years
Skills: ${Array.isArray(candidate.skills) ? candidate.skills.join(", ") : candidate.skills ?? "n/a"}
Summary: ${candidate.summary ?? ""}
CV:
${(typeof candidate.cv_parsed_data === "string" ? candidate.cv_parsed_data : JSON.stringify(candidate.cv_parsed_data ?? "")).slice(0, 8000)}`;

    let parsed: any = {};
    try {
      const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.2,
          response_format: { type: "json_object" },
        }),
      });
      if (!aiRes.ok) {
        const t = await aiRes.text();
        console.error("OpenAI error", aiRes.status, t);
        if (aiRes.status === 429) {
          return new Response(JSON.stringify({ error: "Rate limited, try again shortly." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        // Graceful fallback: if AI fails but we have a canonical score, return a minimal validation.
        if (canonicalScore != null) {
          parsed = { summary: canonical?.ai_summary ?? null, strengths: canonical?.strengths ?? [], weaknesses: canonical?.gaps ?? [], risks: [] };
        } else {
          return new Response(JSON.stringify({ error: "AI provider error" }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      } else {
        const aiJson = await aiRes.json();
        try { parsed = JSON.parse(aiJson.choices?.[0]?.message?.content); } catch { parsed = {}; }
      }
    } catch (e) {
      console.error("AI call failed", e);
      parsed = { summary: canonical?.ai_summary ?? null, strengths: canonical?.strengths ?? [], weaknesses: canonical?.gaps ?? [], risks: [] };
    }

    // === AUTHORITATIVE SCORE — taken from centralized engine, never from AI ===
    const fit_score = canonicalScore != null ? canonicalScore : 0;
    const recommendation = recommendationFromScore(fit_score);

    const insertRow = {
      tenant_id: job.tenant_id,
      job_id,
      candidate_id,
      fit_score,
      recommendation,
      summary: parsed.summary ?? null,
      strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
      weaknesses: Array.isArray(parsed.weaknesses) ? parsed.weaknesses : [],
      risks: Array.isArray(parsed.risks) ? parsed.risks : [],
      model: "gpt-4o-mini",
      generated_by: userId,
    };

    const { data: validation, error: insErr } = await supabase
      .from("ai_candidate_validations")
      .insert(insertRow)
      .select()
      .single();

    if (insErr) {
      console.error("Insert error", insErr);
      return new Response(JSON.stringify({ error: insErr.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({
      validation: { ...validation, sub_scores: canonical?.sub_scores ?? null, confidence, scoring_version: scoringVersion },
      cached: false,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("validate-candidate-fit error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
