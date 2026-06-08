// =========================================================================
// validate-candidate-fit-v2
// Enterprise AI Validation Engine — Stage 3 / Validator Rewrite.
//
// Pipeline:
//   1. Load job + candidate.
//   2. Ensure structured_jd is present (call structure-jd if missing).
//   3. Ensure structured_profile is present (call parse-cv if missing).
//   4. Load active scoring_weights_profile for the tenant (fallback defaults).
//   5. Compute deterministic prefilter_score via computeMatchScore (hybrid_v1).
//   6. Compute explainable final_score via scoreStructured (per-dimension).
//   7. Persist into ai_candidate_validations and rediscovered_matches.
//   8. Return the full ValidationExplanation to the caller.
// =========================================================================

import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { computeMatchScore } from "../_shared/match-scoring.ts";
import {
  scoreStructured,
  DEFAULT_WEIGHTS,
  DEFAULT_THRESHOLDS,
  type ScoringWeights,
  type TierThresholds,
} from "../_shared/structured-scoring.ts";
import {
  STRUCTURED_SCHEMA_VERSION,
  type StructuredCandidateProfile,
  type StructuredJobDescription,
} from "../_shared/structured-schema.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ENGINE_VERSION = "enterprise_validation_v2_1_role_first";

async function invokeFunction(name: string, body: any, authHeader: string): Promise<void> {
  const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/${name}`;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const isInternalStructureJd = name === "structure-jd";
  try {
    await fetch(url, {
      method: "POST",
      headers: isInternalStructureJd
        ? {
            Authorization: `Bearer ${serviceKey}`,
            apikey: serviceKey,
            "x-internal-service-token": serviceKey,
            "Content-Type": "application/json",
          }
        : { Authorization: authHeader, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (e) {
    console.error(`invoke ${name} failed`, e);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { job_id, candidate_id, force } = await req.json();
    if (!job_id || !candidate_id) {
      return new Response(JSON.stringify({ error: "job_id and candidate_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Load job + candidate (RLS-checked)
    const [{ data: job, error: jobErr }, { data: candidate, error: candErr }] = await Promise.all([
      supabase.from("jobs").select("*").eq("id", job_id).maybeSingle(),
      supabase.from("candidates").select("*").eq("id", candidate_id).maybeSingle(),
    ]);
    if (jobErr || !job) {
      return new Response(JSON.stringify({ error: "Job not found or access denied" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (candErr || !candidate) {
      return new Response(JSON.stringify({ error: "Candidate not found or access denied" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Ensure structured_jd
    let structuredJd: StructuredJobDescription | null = job.structured_jd as any;
    if (!structuredJd || job.structured_jd_version !== STRUCTURED_SCHEMA_VERSION || force) {
      await invokeFunction("structure-jd", { job_id, force: !!force }, authHeader);
      const { data: refreshed } = await admin.from("jobs").select("structured_jd, structured_jd_version").eq("id", job_id).maybeSingle();
      structuredJd = (refreshed?.structured_jd as any) ?? null;
    }
    if (!structuredJd) {
      return new Response(JSON.stringify({ error: "Could not structure job description. Add more detail to the JD and retry." }), {
        status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Ensure structured_profile
    let structuredProfile: StructuredCandidateProfile | null = candidate.structured_profile as any;
    if (!structuredProfile || candidate.structured_profile_version !== STRUCTURED_SCHEMA_VERSION || force) {
      // parse-cv accepts candidate_id to write structured_profile in-place
      await invokeFunction("parse-cv", { candidate_id, resume_url: candidate.resume_url, force: !!force }, authHeader);
      const { data: refreshed } = await admin.from("candidates").select("structured_profile, structured_profile_version").eq("id", candidate_id).maybeSingle();
      structuredProfile = (refreshed?.structured_profile as any) ?? null;
    }
    if (!structuredProfile) {
      return new Response(JSON.stringify({ error: "Could not structure candidate profile. Ensure the CV is parsed and retry." }), {
        status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4. Load active scoring weights profile
    let weights: ScoringWeights = DEFAULT_WEIGHTS;
    let thresholds: TierThresholds = DEFAULT_THRESHOLDS;
    let weightsProfileId: string | null = null;
    try {
      const { data: profile } = await admin
        .from("scoring_weights_profiles")
        .select("id, weights, thresholds")
        .eq("tenant_id", job.tenant_id)
        .eq("is_active", true)
        .maybeSingle();
      if (profile) {
        weightsProfileId = profile.id;
        if (profile.weights) weights = { ...DEFAULT_WEIGHTS, ...(profile.weights as any) };
        if (profile.thresholds) thresholds = { ...DEFAULT_THRESHOLDS, ...(profile.thresholds as any) };
      }
    } catch (e) {
      console.warn("weights profile lookup failed; using defaults", e);
    }

    // 5. Deterministic prefilter
    const pre = computeMatchScore(job, candidate);
    const prefilterScore = pre.final;

    // 6. Explainable final score
    const explanation = scoreStructured(structuredJd, structuredProfile, weights, thresholds);

    // 7. Persist into ai_candidate_validations (insert a new row keyed by job+candidate)
    const validationRow = {
      job_id, candidate_id, tenant_id: job.tenant_id,
      engine_version: ENGINE_VERSION,
      weights_profile_id: weightsProfileId,
      final_score: explanation.final_score,
      prefilter_score: prefilterScore,
      fit_score: explanation.final_score,
      recommendation_tier: explanation.recommendation_tier,
      recommendation: explanation.recommendation_tier,
      mandatory_skills_matched: explanation.mandatory_skills_matched as any,
      preferred_skills_matched: explanation.preferred_skills_matched as any,
      missing_requirements: explanation.missing_requirements as any,
      summary: explanation.summary,
      explanation: explanation.summary,
      created_at: new Date().toISOString(),
      validation_stale: false,
    };
    const { data: inserted, error: insErr } = await admin
      .from("ai_candidate_validations")
      .insert(validationRow as any)
      .select()
      .single();
    if (insErr) console.error("ai_candidate_validations insert failed", insErr);

    // Mirror into rediscovered_matches (single read surface)
    try {
      await admin.from("rediscovered_matches").upsert({
        job_id, candidate_id, tenant_id: job.tenant_id,
        match_score: prefilterScore,
        ai_score: explanation.final_score,
        final_score: explanation.final_score,
        recommendation_tier: explanation.recommendation_tier,
        ai_validation_id: inserted?.id ?? null,
        sub_scores: explanation.dimensions as any,
        model_version: ENGINE_VERSION,
        ai_summary: explanation.summary,
        updated_at: new Date().toISOString(),
      }, { onConflict: "job_id,candidate_id" });
    } catch (e) {
      console.warn("rediscovered_matches mirror failed", e);
    }

    // 8. Return full explanation
    return new Response(JSON.stringify({
      ok: true,
      engine_version: ENGINE_VERSION,
      validation_id: inserted?.id ?? null,
      prefilter_score: prefilterScore,
      ...explanation,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("validate-candidate-fit-v2 error:", e);
    return new Response(JSON.stringify({ error: e?.message ?? "unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
