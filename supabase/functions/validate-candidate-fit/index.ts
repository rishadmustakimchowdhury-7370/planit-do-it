import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { computeMatchScore, MODEL_VERSION } from "../_shared/match-scoring.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Evidence-based recruitment intelligence engine.
// This is the ONE engine — its output is consumed unchanged by the talent-match
// card, the validation modal, the submission workspace, the executive PDF, and
// the client portal. No other prompts may diverge from this contract.
//
// Output contract (all consumers depend on this exact shape):
//   summary                  : 2–3 sentence senior-recruiter executive summary
//   recommendation           : one of strong_match | recommended | moderate_fit |
//                              needs_review | limited_alignment | not_suitable
//   mandate_match            : requirement/evidence/fit table (5–8 rows)
//   strengths, considerations: evidence-led bullets
//   risks                    : hiring risks (optional)
//   missing_requirements     : JD items with no real CV evidence
//   recruiter_notes_summary  : how the recruiter notes shaped the view
//   recruiter_review         : one closing paragraph, consultant voice
const SYSTEM_PROMPT = `You are a senior executive-search consultant writing an evidence-based candidate assessment for a paying client. You are NOT a keyword matcher. You are NOT an optimistic AI summariser.

You will receive: a JOB DESCRIPTION, a CANDIDATE CV/profile, optional RECRUITER NOTES, and a CANONICAL FIT SCORE (0–100) computed by the firm's deterministic engine. The canonical score is the single source of truth — your recommendation, fit labels, strengths and considerations MUST be consistent with it. NEVER inflate.

EVIDENCE RULES (these are the most important rules — violating them makes the report worthless):
- Simply seeing a keyword in a skills list (e.g. "React", "Python", "AWS") is NEVER enough for STRONG or EXCEEDS. You must see commercial depth: years of usage, scale, ownership, production exposure, enterprise context.
- Adjacent experience does NOT cover an absent requirement. If the JD asks for "enterprise React architecture" and the CV only lists "React" in a skills section, the fit is PARTIAL at best — likely WEAK.
- If you cannot quote or paraphrase concrete CV evidence for a requirement, the evidence field MUST say "No clear evidence found in CV." and the fit MUST be WEAK or NOT MATCHED.
- Seniority, industry, and domain depth must be evidenced by actual roles/companies/years — not inferred from skill words.

CALIBRATION (HARD — never exceed):
- score < 35  → recommendation "not_suitable". Allowed fits: WEAK, NOT MATCHED, occasional PARTIAL. No GOOD/STRONG/EXCEEDS.
- 35–49       → "limited_alignment". Allowed: WEAK, PARTIAL, NOT MATCHED. At most one GOOD.
- 50–61       → "needs_review". Mostly PARTIAL/WEAK. At most one STRONG, no EXCEEDS.
- 62–74       → "moderate_fit". Mix of GOOD and PARTIAL. At most two STRONG, no EXCEEDS.
- 75–87       → "recommended". Majority STRONG/GOOD. EXCEEDS only with concrete proof.
- ≥ 88        → "strong_match". STRONG/EXCEEDS dominate.

TONE RULES:
- Sound like a senior recruiter, not a chatbot. Specific. Restrained. JD-anchored.
- BAD: "Highly qualified excellent candidate". GOOD: "Strong backend profile with eight years of API design at fintech scale; frontend architecture depth is less evident."
- Mention strengths AND gaps. Never pure praise.
- The recommendation, summary and mandate_match table MUST agree. If recommendation is needs_review, the table cannot be mostly STRONG.

Output ONLY valid JSON, no markdown, in this exact shape:
{
  "recommendation": "strong_match|recommended|moderate_fit|needs_review|limited_alignment|not_suitable",
  "summary": "<2–3 sentence executive summary, JD-specific, mentions strengths and gaps>",
  "mandate_match": [
    { "requirement": "<short JD requirement label>", "evidence": "<specific CV evidence or 'No clear evidence found in CV.'>", "fit": "EXCEEDS|STRONG|GOOD|PARTIAL|WEAK|NOT MATCHED" }
  ],
  "strengths": ["<lead — evidence sentence>", "..."],
  "considerations": ["<lead — balanced consideration>", "..."],
  "risks": ["<hiring risk if applicable>"],
  "missing_requirements": ["<JD requirement with no real evidence>"],
  "recruiter_notes_summary": ["<how the recruiter note shaped this view>"],
  "recruiter_review": "<one paragraph, senior consultant voice, consistent with the band>"
}

Extract 5–8 of the JOB's most important requirements. 4–6 strengths, 3–5 considerations. Output JSON only.`;

type RecLabel =
  | "strong_match" | "recommended" | "moderate_fit"
  | "needs_review" | "limited_alignment" | "not_suitable";

function recommendationFromScore(score: number): RecLabel {
  if (score >= 88) return "strong_match";
  if (score >= 75) return "recommended";
  if (score >= 62) return "moderate_fit";
  if (score >= 50) return "needs_review";
  if (score >= 35) return "limited_alignment";
  return "not_suitable";
}

const REC_ALLOWED: RecLabel[] = [
  "strong_match", "recommended", "moderate_fit",
  "needs_review", "limited_alignment", "not_suitable",
];

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
      // Invalidate cache if any cached fit label is inflated above the current canonical band
      const RANK = ["NOT MATCHED","WEAK","PARTIAL","GOOD","STRONG","EXCEEDS"];
      const ceil = canonical?.match_score == null ? 3
                 : canonical.match_score < 50 ? 1
                 : canonical.match_score < 75 ? 4 : 5;
      const inflated = hasMandate && (existing as any).mandate_match.some((m: any) =>
        Math.max(0, RANK.indexOf(String(m?.fit ?? "").toUpperCase())) > ceil
      );
      if (existing && hasMandate && !inflated && (!canonical || existing.fit_score === canonical.match_score) && !recruiterNotes.length) {
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

    const ALLOWED_FITS = ["NOT MATCHED", "WEAK", "PARTIAL", "GOOD", "STRONG", "EXCEEDS"]; // low→high
    const fitRank = (f: string) => Math.max(0, ALLOWED_FITS.indexOf(f.toUpperCase()));

    // Hard ceiling tied to canonical band — single source of truth.
    const fitCeiling = (score: number | null): number => {
      if (score == null) return 3;       // GOOD
      if (score < 35) return 1;          // WEAK
      if (score < 50) return 2;          // PARTIAL
      if (score < 62) return 4;          // STRONG cap (rare)
      if (score < 75) return 4;          // STRONG
      if (score < 88) return 5;          // EXCEEDS sparingly
      return 5;
    };
    const ceil = fitCeiling(canonicalScore);
    let strongUsed = 0;
    const strongCap =
      canonicalScore == null ? 99 :
      canonicalScore < 35 ? 0 :
      canonicalScore < 50 ? 0 :
      canonicalScore < 62 ? 1 :
      canonicalScore < 75 ? 2 : 99;

    const mandate_match = Array.isArray(parsed.mandate_match)
      ? parsed.mandate_match
          .filter((m: any) => m && typeof m.requirement === "string" && typeof m.evidence === "string")
          .map((m: any) => {
            let f = ALLOWED_FITS.includes(String(m.fit).toUpperCase()) ? String(m.fit).toUpperCase() : "PARTIAL";
            if (fitRank(f) > ceil) f = ALLOWED_FITS[ceil];
            if (f === "STRONG") {
              if (strongUsed >= strongCap) f = "GOOD";
              else strongUsed++;
            }
            return {
              requirement: String(m.requirement).slice(0, 120),
              evidence: String(m.evidence).slice(0, 600),
              fit: f,
            };
          })
          .slice(0, 10)
      : [];

    const fit_score = canonicalScore != null ? canonicalScore : 0;
    // Trust the deterministic band over whatever the AI claimed.
    const recommendation = recommendationFromScore(fit_score);

    // Derive missing_requirements from the mandate_match table as a fallback,
    // and merge anything the AI explicitly flagged.
    const aiMissing = Array.isArray(parsed.missing_requirements) ? parsed.missing_requirements.map(String) : [];
    const tableMissing = mandate_match
      .filter((m: any) => m.fit === "NOT MATCHED" || m.fit === "WEAK")
      .map((m: any) => m.requirement);
    const missing_requirements = Array.from(new Set([...aiMissing, ...tableMissing])).slice(0, 8);

    const recruiterNotesSummary = Array.isArray(parsed.recruiter_notes_summary)
      ? parsed.recruiter_notes_summary.map(String).slice(0, 6) : [];

    // We persist the recruiter-notes-summary and missing requirements inside
    // `risks` jsonb as structured items so we don't need a schema migration.
    // Consumers read `risks` as plain strings; we keep that shape but allow the
    // payload to carry the structured details under a known shape too.
    const risksOut = Array.isArray(parsed.risks) ? parsed.risks.map(String).slice(0, 6) : [];

    const insertRow = {
      tenant_id: job.tenant_id,
      job_id, candidate_id,
      fit_score, recommendation,
      summary: parsed.summary ?? null,
      strengths: Array.isArray(parsed.strengths) ? parsed.strengths.slice(0, 8) : [],
      weaknesses: Array.isArray(parsed.considerations) ? parsed.considerations.slice(0, 8) : (Array.isArray(parsed.weaknesses) ? parsed.weaknesses : []),
      risks: risksOut,
      mandate_match: [
        ...mandate_match,
        // Sidecar metadata row(s) — consumers can ignore unknown shapes.
        ...(missing_requirements.length ? [{ __kind: "missing", items: missing_requirements }] : []),
        ...(recruiterNotesSummary.length ? [{ __kind: "recruiter_notes_summary", items: recruiterNotesSummary }] : []),
      ],
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
