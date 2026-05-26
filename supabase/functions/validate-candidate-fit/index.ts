import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { computeMatchScore, MODEL_VERSION } from "../_shared/match-scoring.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Executive-search style validation. The AI must deeply compare the JD against
// the candidate CV, taking recruiter notes into account, and produce:
//   - executive summary (2–3 sentences, evidence-based)
//   - mandate_match table (requirement / evidence / fit)
//   - strengths bullets (concise, evidence-led)
//   - considerations bullets (balanced, recruiter tone)
//   - recruiter_review (1 paragraph, senior-consultant voice)
// The fit_score itself is ALWAYS taken from the deterministic scoring engine.
const SYSTEM_PROMPT = `You are a senior executive-search consultant preparing a retained-search candidate assessment for a client.

You will receive: a JOB DESCRIPTION, a CANDIDATE CV/profile, optional RECRUITER NOTES, and a CANONICAL FIT SCORE (0–100) computed by the firm's deterministic scoring engine. The canonical score is the single source of truth — your narrative, fit labels, and recommendation language MUST be consistent with it. Never inflate the assessment above the canonical band.

CALIBRATION RULES (HARD):
- score < 50  → tone "Not Recommended". Allowed fits: PARTIAL, WEAK, NOT MATCHED. No EXCEEDS / STRONG. At most one GOOD.
- 50–64       → "Needs Review". At most one STRONG, no EXCEEDS, majority PARTIAL/GOOD/WEAK.
- 65–74       → "Needs Review (leaning positive)". At most two STRONG, no EXCEEDS, mix of GOOD/PARTIAL.
- 75–89       → "Recommended". Majority STRONG/GOOD, EXCEEDS only if clearly evidenced.
- ≥ 90        → "Strongly Recommended". EXCEEDS / STRONG dominate.

Your job is to JUSTIFY the canonical band with real CV evidence — not to argue with it.

Produce ONLY valid JSON in this exact shape:
{
  "summary": "<2–3 sentence executive summary consistent with the canonical band.>",
  "mandate_match": [
    { "requirement": "<short JD requirement label>", "evidence": "<specific CV evidence; if none, say 'No evidence found in CV.'>", "fit": "EXCEEDS|STRONG|GOOD|PARTIAL|WEAK|NOT MATCHED" }
  ],
  "strengths": ["<bold lead — evidence sentence>", "..."],
  "considerations": ["<bold lead — balanced consideration>", "..."],
  "recruiter_review": "<one paragraph in senior recruiter voice, consistent with the score band.>"
}

RULES:
- Extract 5–8 of the JOB's most important requirements and assess each against actual evidence. Do NOT invent evidence.
- Missing/weak evidence → WEAK or NOT MATCHED even if the candidate has adjacent experience.
- 4–6 strengths and 3–5 considerations. "Lead — explanatory sentence" format.
- Recruiter notes (salary/notice/relocation/visa/communication) belong in considerations only if genuinely relevant.
- Output JSON only, no markdown.`;

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
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userId = userData.user.id;

    const { job_id, candidate_id, submission_id, recruiter_notes: notesOverride, force } = await req.json();
    if (!job_id || !candidate_id) {
      return new Response(JSON.stringify({ error: "job_id and candidate_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

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

    // Pull recruiter notes from the submission (if any) — these guide the AI
    let recruiterNotes: string[] = Array.isArray(notesOverride) ? notesOverride : [];
    if (!recruiterNotes.length && submission_id) {
      const { data: subRow } = await admin
        .from("candidate_submissions")
        .select("recruiter_notes, submission_message")
        .eq("id", submission_id)
        .maybeSingle();
      const n = (subRow as any)?.recruiter_notes;
      if (Array.isArray(n)) recruiterNotes = n.filter(Boolean);
    }

    // Canonical deterministic score (single source of truth)
    let { data: canonical } = await supabase
      .from("rediscovered_matches")
      .select("match_score, sub_scores, confidence, model_version, ai_summary, strengths, gaps")
      .eq("job_id", job_id)
      .eq("candidate_id", candidate_id)
      .maybeSingle();

    if (!canonical) {
      const r = computeMatchScore(job, candidate);
      const newRow = {
        job_id, candidate_id, tenant_id: job.tenant_id,
        match_score: r.final, ai_score: r.final, confidence: r.confidence,
        sub_scores: {
          role: r.sub.role, skills: r.sub.skills, industry: r.sub.industry,
          seniority: r.sub.seniority, experience: r.sub.experience, location: r.sub.location,
          penalty: r.sub.penalty, job_family: r.jobFamily, candidate_family: r.candFamily,
        },
        model_version: r.model_version,
        strengths: r.matched.slice(0, 3).map((s) => `Has ${s}`),
        gaps: r.missing.slice(0, 3).map((s) => `Missing ${s}`),
        insights: [], dismissed: false, updated_at: new Date().toISOString(),
      };
      const { data: inserted } = await supabase
        .from("rediscovered_matches")
        .upsert(newRow, { onConflict: "job_id,candidate_id" })
        .select("match_score, sub_scores, confidence, model_version, ai_summary, strengths, gaps")
        .single();
      canonical = inserted ?? {
        match_score: r.final, sub_scores: newRow.sub_scores, confidence: r.confidence,
        model_version: r.model_version, ai_summary: null,
        strengths: newRow.strengths, gaps: newRow.gaps,
      };
    }

    // Reuse recent enrichment only if it has a mandate_match populated AND no
    // new recruiter notes have been supplied this turn.
    if (!force) {
      const { data: existing } = await supabase
        .from("ai_candidate_validations")
        .select("*")
        .eq("job_id", job_id).eq("candidate_id", candidate_id)
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      const hasMandate = Array.isArray((existing as any)?.mandate_match) && (existing as any).mandate_match.length > 0;
      if (existing && hasMandate && (!canonical || existing.fit_score === canonical.match_score) && !recruiterNotes.length) {
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

    const userPrompt = `JOB DESCRIPTION
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
${(typeof candidate.cv_parsed_data === "string" ? candidate.cv_parsed_data : JSON.stringify(candidate.cv_parsed_data ?? "")).slice(0, 9000)}

RECRUITER NOTES (from screening — must influence your reasoning where relevant):
${recruiterNotes.length ? recruiterNotes.map((n) => `- ${n}`).join("\n") : "(none provided)"}

CANONICAL FIT SCORE (deterministic engine — single source of truth): ${canonicalScore != null ? canonicalScore + "/100" : "n/a"}
Confidence: ${confidence ?? "n/a"} · Scoring version: ${scoringVersion}

Now produce the JSON assessment per the system spec, calibrated to the canonical band.`;

    let parsed: any = {};
    try {
      const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gpt-4o",
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
        if (canonicalScore != null) {
          parsed = { summary: canonical?.ai_summary ?? null, mandate_match: [], strengths: (canonical?.strengths ?? []), considerations: (canonical?.gaps ?? []), recruiter_review: null };
        } else {
          return new Response(JSON.stringify({ error: "AI provider error" }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      } else {
        const aiJson = await aiRes.json();
        try { parsed = JSON.parse(aiJson.choices?.[0]?.message?.content); } catch { parsed = {}; }
      }
    } catch (e) {
      console.error("AI call failed", e);
      parsed = { summary: canonical?.ai_summary ?? null, mandate_match: [], strengths: (canonical?.strengths ?? []), considerations: (canonical?.gaps ?? []), recruiter_review: null };
    }

    const ALLOWED_FITS = new Set(["EXCEEDS", "STRONG", "GOOD", "PARTIAL", "WEAK", "NOT MATCHED"]);
    const mandate_match = Array.isArray(parsed.mandate_match)
      ? parsed.mandate_match
          .filter((m: any) => m && typeof m.requirement === "string" && typeof m.evidence === "string")
          .map((m: any) => ({
            requirement: String(m.requirement).slice(0, 120),
            evidence: String(m.evidence).slice(0, 600),
            fit: ALLOWED_FITS.has(String(m.fit).toUpperCase()) ? String(m.fit).toUpperCase() : "PARTIAL",
          }))
          .slice(0, 10)
      : [];

    const fit_score = canonicalScore != null ? canonicalScore : 0;
    const recommendation = recommendationFromScore(fit_score);

    const insertRow = {
      tenant_id: job.tenant_id,
      job_id, candidate_id,
      fit_score, recommendation,
      summary: parsed.summary ?? null,
      strengths: Array.isArray(parsed.strengths) ? parsed.strengths.slice(0, 8) : [],
      weaknesses: Array.isArray(parsed.considerations) ? parsed.considerations.slice(0, 8) : (Array.isArray(parsed.weaknesses) ? parsed.weaknesses : []),
      risks: Array.isArray(parsed.risks) ? parsed.risks : [],
      mandate_match,
      recruiter_review: parsed.recruiter_review ?? null,
      model: "gpt-4o",
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
