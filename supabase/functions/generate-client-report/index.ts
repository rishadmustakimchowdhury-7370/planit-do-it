// Generates an AI-powered Client Submission Report (recruiter assessment),
// versioned per (job, candidate). Inherits scoring + evidence from AI Match
// (validate-candidate-fit-v2) — the AI only enriches narrative; it never
// re-scores or changes the recommendation tier.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;

// Map validator tier -> client-facing tier (UI enum)
const TIER_MAP: Record<string, string> = {
  strong_match: "Strong Shortlist",
  recommended: "Recommended",
  transferable_match: "Transferable",
  needs_validation: "Consider",
  weak_match: "Consider",
  reject: "Do Not Recommend",
};

// The AI is only allowed to produce NARRATIVE fields. Scoring/strengths/gaps
// and the recommendation tier are inherited from the validator and overwrite
// whatever the model returns.
const NARRATIVE_TOOL = {
  type: "function",
  function: {
    name: "emit_report_narrative",
    description: "Produce ONLY narrative prose for a Client Submission Report. Do not re-score.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        snapshot: {
          type: "object",
          additionalProperties: false,
          properties: {
            compensation_expectation: { type: "string" },
            availability: { type: "string" },
            nationality: { type: "string" },
            current_location: { type: "string" },
            current_employer: { type: "string" },
            current_position: { type: "string" },
          },
          required: ["compensation_expectation","availability","nationality","current_location","current_employer","current_position"],
        },
        executive_summary: { type: "string", description: "3-6 sentences. MUST be consistent with the supplied recommendation tier, score, strengths, and gaps." },
        recruiter_notes: { type: "string", description: "Professional consolidation of recruiter text notes, voice transcripts, and screening. Enriches but does not replace the AI Match scoring." },
        recommendation_reasoning: { type: "string", description: "Plain-English justification for the supplied recommendation tier. Do NOT invent a different tier." },
      },
      required: ["snapshot","executive_summary","recruiter_notes","recommendation_reasoning"],
    },
  },
};

function asArr(x: any): string[] {
  if (!x) return [];
  if (Array.isArray(x)) return x.map(v => typeof v === "string" ? v : (v?.text ?? v?.label ?? v?.requirement ?? JSON.stringify(v))).filter(Boolean);
  if (typeof x === "string") return [x];
  return [];
}

function buildFitAssessment(validation: any): Array<{ requirement: string; evidence: string; fit: string }> {
  const rows: Array<{ requirement: string; evidence: string; fit: string }> = [];
  const mandate = Array.isArray(validation?.mandate_match) ? validation.mandate_match : [];
  for (const m of mandate) {
    if (!m || m.__kind) continue;
    const req = typeof m === "string" ? m : (m.requirement ?? m.required ?? m.skill ?? m.name ?? "");
    const ev = typeof m === "string" ? "Evidenced in Validator v2" : (m.evidence ?? m.notes ?? m.reason ?? "Evidenced in Validator v2");
    const fit = String(typeof m === "string" ? "STRONG" : (m.fit ?? "STRONG")).toUpperCase();
    if (req) rows.push({ requirement: req, evidence: ev, fit });
  }
  if (rows.length > 0) return rows;

  const reqOf = (m: any) => typeof m === "string" ? m : (m?.requirement ?? m?.required ?? m?.skill ?? m?.name ?? m?.label ?? "");
  const evOf = (m: any, fallback: string) => typeof m === "string" ? fallback : (m?.evidence ?? m?.notes ?? m?.reason ?? (m?.candidate_skill ? `Matched candidate evidence: ${m.candidate_skill}` : fallback));
  const matched = Array.isArray(validation?.mandatory_skills_matched) ? validation.mandatory_skills_matched : [];
  for (const m of matched) {
    if (m && typeof m === "object" && m.matched === false) continue;
    const req = reqOf(m);
    const ev  = evOf(m, "Matched by Validator v2");
    if (req) rows.push({ requirement: req, evidence: ev, fit: "STRONG" });
  }
  const preferred = Array.isArray(validation?.preferred_skills_matched) ? validation.preferred_skills_matched : [];
  for (const m of preferred) {
    if (m && typeof m === "object" && m.matched === false) continue;
    const req = reqOf(m);
    const ev  = evOf(m, "Preferred requirement matched by Validator v2");
    if (req) rows.push({ requirement: req, evidence: ev, fit: "GOOD" });
  }
  const missing = Array.isArray(validation?.missing_requirements) ? validation.missing_requirements : [];
  for (const m of missing) {
    const req = reqOf(m);
    const ev  = evOf(m, "Marked missing by Validator v2");
    if (req) rows.push({ requirement: req, evidence: ev, fit: "MISSING" });
  }
  return rows;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return j({ error: "Unauthorized" }, 401);

    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return j({ error: "Unauthorized" }, 401);

    const body = await req.json();
    const { job_id, candidate_id, anonymous = false } = body;
    const requestedValidationId = typeof body.ai_match_validation_id === "string" && body.ai_match_validation_id.trim()
      ? body.ai_match_validation_id.trim()
      : null;
    // "with_edits" (default) = bring previous narrative + recruiter edits into the regen context
    // "from_original" = clean slate, ignore prior edits
    const mode: "with_edits" | "from_original" = body.mode === "from_original" ? "from_original" : "with_edits";
    const previousReport = body.previous_report ?? null;
    if (!job_id || !candidate_id) return j({ error: "job_id and candidate_id required" }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { data: profile } = await admin.from("profiles").select("tenant_id").eq("id", user.id).maybeSingle();
    const tenant_id = profile?.tenant_id;
    if (!tenant_id) return j({ error: "No tenant" }, 403);

    const [candidateRes, jobRes, latestValidationRes, mirrorRes, assessmentRes, brandingRes] = await Promise.all([
      admin.from("candidates").select("*").eq("id", candidate_id).maybeSingle(),
      admin.from("jobs").select("*").eq("id", job_id).maybeSingle(),
      admin.from("ai_candidate_validations").select("*").eq("job_id", job_id).eq("candidate_id", candidate_id).order("created_at",{ascending:false}).limit(1).maybeSingle(),
      admin.from("rediscovered_matches").select("ai_validation_id, final_score, ai_score, match_score, recommendation_tier, interview_probability").eq("job_id", job_id).eq("candidate_id", candidate_id).maybeSingle(),
      admin.from("prepare_for_client_assessments").select("*").eq("job_id", job_id).eq("candidate_id", candidate_id).eq("recruiter_id", user.id).maybeSingle(),
      admin.from("branding_settings").select("*").eq("tenant_id", tenant_id).maybeSingle(),
    ]);

    const candidate = candidateRes.data;
    const job = jobRes.data;
    const aiMatchValidationId = requestedValidationId ?? mirrorRes.data?.ai_validation_id ?? latestValidationRes.data?.id ?? null;
    let validation = latestValidationRes.data;
    if (aiMatchValidationId) {
      const { data: exactValidation, error: exactErr } = await admin
        .from("ai_candidate_validations")
        .select("*")
        .eq("id", aiMatchValidationId)
        .eq("job_id", job_id)
        .eq("candidate_id", candidate_id)
        .maybeSingle();
      if (exactErr) return j({ error: exactErr.message }, 500);
      if (!exactValidation) {
        return j({
          error: `AI Match validation record ${aiMatchValidationId} was not found for this candidate/job. Re-run AI Match before generating the report.`,
          parity: { ai_match_validation_id: aiMatchValidationId, report_validation_id: null },
        }, 409);
      }
      validation = exactValidation;
    }
    const assessment = assessmentRes.data;

    if (!candidate || !job) return j({ error: "Candidate or job not found" }, 404);
    if (!validation) {
      return j({
        error: "Run AI Match for this candidate first. The Client Submission Report inherits the validated scoring, strengths, and gaps from AI Match to keep both views consistent.",
      }, 409);
    }

    // ---------- INHERITED FROM AI MATCH (single source of truth) ----------
    const matchScore = validation.final_score ?? validation.fit_score ?? null;
    const interviewProbability = validation.interview_probability ?? null;
    const tierRaw = String(validation.recommendation_tier ?? validation.recommendation ?? "").toLowerCase();
    const tier = TIER_MAP[tierRaw] ?? "Consider";

    // Hard-fail if scoring is missing — no secondary scoring is allowed.
    if (matchScore == null || !tierRaw) {
      return j({
        error: "AI Match has no final_score or recommendation_tier on the latest validation. Re-run AI Match before generating the Client Submission Report.",
      }, 409);
    }

    // Score Parity Guard: cross-check the latest validation against the
    // rediscovered_matches mirror that powers the AI Match panel. If they
    // disagree, refuse to generate so AI Match and the report can never
    // tell two different stories.
    const { data: mirror } = await admin
      .from("rediscovered_matches")
      .select("ai_validation_id, final_score, ai_score, recommendation_tier")
      .eq("job_id", job_id).eq("candidate_id", candidate_id).maybeSingle();
    const mirrorScore = mirror?.final_score ?? mirror?.ai_score ?? null;
    const mirrorTier = String(mirror?.recommendation_tier ?? "").toLowerCase();
    const scoreMismatch = mirrorScore != null && Math.round(Number(mirrorScore)) !== Math.round(Number(matchScore));
    const tierMismatch = mirrorTier && mirrorTier !== tierRaw;
    if (scoreMismatch || tierMismatch) {
      console.error("[generate-client-report] PARITY MISMATCH", {
        job_id, candidate_id,
        validation_id: validation.id, validation_score: matchScore, validation_tier: tierRaw,
        mirror_validation_id: mirror?.ai_validation_id, mirror_score: mirrorScore, mirror_tier: mirrorTier,
      });
      return j({
        error: `Score parity check failed: AI Match mirror shows ${mirrorScore ?? "n/a"}% / ${mirrorTier || "n/a"} but the latest validation shows ${matchScore}% / ${tierRaw}. Re-run AI Match to reconcile, then regenerate the report.`,
        parity: {
          validation_id: validation.id,
          validation_score: matchScore,
          validation_tier: tierRaw,
          mirror_validation_id: mirror?.ai_validation_id ?? null,
          mirror_score: mirrorScore,
          mirror_tier: mirrorTier || null,
        },
      }, 409);
    }

    const inheritedStrengths = asArr(validation.strengths);
    const inheritedConsiderations = [
      ...asArr(validation.weaknesses),
      ...asArr(validation.risks),
      ...asArr(validation.missing_requirements).map(r => `Gap: ${r}`),
    ];
    const inheritedFit = buildFitAssessment(validation);

    const voiceText = Array.isArray(assessment?.voice_transcripts)
      ? assessment.voice_transcripts.map((v: any) => v?.transcript || "").filter(Boolean).join("\n\n")
      : "";

    // ---------- NARRATIVE-ONLY AI CALL ----------
    const useEdits = mode === "with_edits" && previousReport;
    const systemPrompt = `You are an experienced executive recruiter writing the NARRATIVE sections of a Client Submission Report.

CRITICAL RULES:
- The Recommendation Tier, Match Score, Key Strengths, Considerations, and Fit Evidence are ALREADY DECIDED by the validated AI Match engine. They are provided below in "ai_match".
- DO NOT re-score, contradict, or replace any of those fields. Your job is to translate them into client-safe prose.
- Your executive_summary and recommendation_reasoning MUST be consistent with the supplied tier and score.
- Recruiter notes enrich the narrative but never override the AI Match scoring.
- For the snapshot, use the candidate/recruiter assessment data; say "Not stated" when unknown. Never fabricate.
${useEdits ? `
RECRUITER EDIT MODE — PRESERVE THE RECRUITER'S EDITS:
- "previous_report" contains the recruiter's edited version. Treat it as ground truth for tone, factual snapshot fields, and phrasing the recruiter has chosen.
- Refine and polish — do NOT discard, contradict, or revert recruiter edits.
- Keep any snapshot values the recruiter has filled in. Only fill blanks.
- Keep the recruiter's executive_summary structure and any specific claims they added; you may tighten prose, fix grammar, and reconcile with ai_match, but preserve the recruiter's intent.
- Keep recruiter_notes substantially intact; you may improve flow but do not remove substantive points.
- recommendation_reasoning should reflect the recruiter's framing where present.` : `
CLEAN REGENERATION — IGNORE PRIOR EDITS:
- Generate a fresh narrative from ai_match + recruiter_assessment only. Do not reuse prior report text.`}`;

    const userPayload = {
      regeneration_mode: mode,
      job: {
        title: job.title, seniority: job.seniority_level, location: job.location,
        employment_type: job.employment_type, description: job.description,
        requirements: job.requirements, structured_jd: job.structured_jd,
      },
      candidate: {
        name: anonymous ? "Confidential Candidate" : candidate.full_name,
        current_title: candidate.current_title, current_company: candidate.current_company,
        location: candidate.location, experience_years: candidate.experience_years,
        skills: candidate.skills, summary: candidate.summary,
        structured_profile: candidate.structured_profile, cv_parsed_data: candidate.cv_parsed_data,
      },
      ai_match: {
        recommendation_tier: tier,
        match_score: matchScore,
        interview_probability: interviewProbability,
        strengths: inheritedStrengths,
        considerations: inheritedConsiderations,
        fit_evidence: inheritedFit,
        validator_summary: validation.summary ?? null,
        validator_explanation: validation.explanation ?? null,
      },
      recruiter_assessment: assessment ? {
        text_notes: assessment.text_notes,
        structured: assessment.structured_notes,
        voice_transcript: voiceText,
      } : null,
      previous_report: useEdits ? {
        snapshot: previousReport.snapshot ?? null,
        executive_summary: previousReport.executive_summary ?? null,
        recruiter_notes: previousReport.recruiter_notes ?? null,
        recommendation_reasoning: previousReport.recommendation?.reasoning ?? null,
      } : null,
    };


    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o",
        temperature: 0.2,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: JSON.stringify(userPayload) },
        ],
        tools: [NARRATIVE_TOOL],
        tool_choice: { type: "function", function: { name: "emit_report_narrative" } },
      }),
    });

    if (!aiRes.ok) {
      const txt = await aiRes.text();
      return j({ error: `AI error: ${aiRes.status} ${txt}` }, 500);
    }
    const aiData = await aiRes.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) return j({ error: "AI returned no report" }, 500);
    const narrative = JSON.parse(toolCall.function.arguments);

    // ---------- MERGE: inherited (authoritative) + narrative ----------
    const report = {
      snapshot: narrative.snapshot,
      executive_summary: narrative.executive_summary,
      fit_assessment: inheritedFit,                    // inherited
      key_strengths: inheritedStrengths,               // inherited
      considerations: inheritedConsiderations,         // inherited
      recruiter_notes: narrative.recruiter_notes,
      recommendation: {
        tier,                                          // inherited
        reasoning: narrative.recommendation_reasoning,
      },
    };

    const { data: existing } = await admin
      .from("client_submission_reports")
      .select("version")
      .eq("tenant_id", tenant_id).eq("job_id", job_id).eq("candidate_id", candidate_id)
      .order("version", { ascending: false }).limit(1).maybeSingle();
    const version = (existing?.version ?? 0) + 1;

    const reportData = {
      ...report,
      header: {
        candidate_name: anonymous ? "Confidential Candidate" : (candidate.full_name ?? ""),
        anonymous,
        position: job.title,
        confidential: true,
      },
      branding: {
        company_name: brandingRes.data?.company_name ?? null,
        logo_url: brandingRes.data?.logo_url ?? null,
        primary_color: brandingRes.data?.primary_color ?? null,
        footer_text: brandingRes.data?.footer_text ?? null,
      },
      meta: {
        generated_at: new Date().toISOString(),
        source: "ai_match_v2",
        validation_id: validation.id,
        validation_generated_at: validation.created_at,
        match_score: matchScore,
        interview_probability: interviewProbability,
        recommendation_tier_raw: validation.recommendation_tier ?? validation.recommendation ?? null,
        regeneration_mode: mode,
        based_on_recruiter_edits: !!useEdits,
      },
    };

    const { data: inserted, error: insErr } = await admin.from("client_submission_reports").insert({
      tenant_id, job_id, candidate_id, recruiter_id: user.id,
      version, status: "draft", report_data: reportData,
      model: "gpt-4o", generated_by: user.id,
    }).select("*").single();
    if (insErr) return j({ error: insErr.message }, 500);

    return j({ report: inserted });
  } catch (e) {
    return j({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

function j(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
