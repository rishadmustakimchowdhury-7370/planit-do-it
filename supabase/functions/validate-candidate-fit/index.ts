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
const SYSTEM_PROMPT = `You are a senior executive-search consultant writing an evidence-based candidate assessment for a paying client. You are NOT a keyword matcher and NOT an optimistic AI summariser. Calibrated, restrained, JD-anchored. The recommendation, executive summary, fit table, strengths and considerations MUST be internally consistent — never contradict the recommendation band.

INPUT: JOB DESCRIPTION, CANDIDATE CV/profile, optional RECRUITER NOTES, and a CANONICAL FIT SCORE (0–100) from the firm's deterministic engine. The canonical score is the single source of truth. NEVER inflate beyond the band.

EVIDENCE CONFIDENCE HIERARCHY (classify each requirement's evidence BEFORE choosing a fit label):
- HIGH confidence: quantified achievements, explicit years of direct experience, project ownership, architecture responsibility, production delivery, leadership scope, commercial implementation, repeated proven usage across roles. ONLY this tier may justify STRONG or EXCEEDS.
- MEDIUM confidence: multiple stack mentions across roles, project descriptions without quantification, partial implementation evidence, indirect exposure through adjacent work. Maximum fit: GOOD or PARTIAL.
- LOW confidence: skills section only, single-line keyword mention, no project context, no delivery proof, no years attached, vague self-description. HARD CEILING: PARTIAL (often WEAK or NOT MATCHED). NEVER STRONG. NEVER EXCEEDS.

EVIDENCE RULES (violating these makes the report worthless):
- A skill keyword in a list (e.g. "React", "Python", "AWS", "Docker") is LOW confidence by default and is NEVER enough for STRONG/EXCEEDS. To upgrade, the CV must show explicit years OR scale OR production ownership OR architecture decisions OR commercial/enterprise context for THAT specific skill.
- Adjacent experience does NOT cover an absent requirement. If the JD asks "enterprise React architecture" and the CV only lists "React" in a skills section, fit is PARTIAL at best — often WEAK.
- "Has 4+ years of web app experience" is GENERIC. Without specific company, product scale, or shipped feature evidence it is PARTIAL, never STRONG.
- If you cannot quote or paraphrase concrete CV evidence for a requirement, the evidence field MUST literally say "No clear evidence found in CV." and the fit MUST be WEAK or NOT MATCHED.
- Seniority, industry and domain depth come from actual roles/companies/years — not inferred from skill words.
- If the evidence sentence reads like a list of keywords or "lists X in skills" / "mentions X" / "skills section includes X", treat as LOW confidence and cap at PARTIAL.

CALIBRATION (HARD CAPS — never exceed):
- score < 35  → "not_suitable". Fits: WEAK / NOT MATCHED only. Zero GOOD/STRONG/EXCEEDS.
- 35–49       → "limited_alignment". Mostly WEAK / PARTIAL / NOT MATCHED. Zero GOOD/STRONG/EXCEEDS.
- 50–61       → "needs_review". Majority PARTIAL with some WEAK. At most ONE GOOD across the whole table. ZERO STRONG. ZERO EXCEEDS.
- 62–74       → "moderate_fit". Mix of GOOD and PARTIAL, some WEAK. At most ONE STRONG. ZERO EXCEEDS.
- 75–87       → "recommended". Majority GOOD/STRONG. EXCEEDS only with concrete enterprise-scale proof (max 1).
- ≥ 88        → "strong_match". STRONG/EXCEEDS dominate.

EXECUTIVE SUMMARY RULES (the summary sets tone for everything that follows):
- 2–3 sentences. Must explicitly mention BOTH strengths AND gaps proportional to the band.
- For needs_review / limited_alignment / not_suitable: LEAD with the gap, uncertainty or evidence caveat — never with a positive framing. Use language like "limited evidence", "moderate exposure", "partial alignment", "requires technical validation", "unclear production depth".
  Banned phrases in these bands: "strong candidate", "strong profile", "excellent fit", "highly qualified", "ideal", "perfect match", "well-suited", "great fit", "good suitability", "solid alignment", "positions him/her/them well", "positions him/her/them as a strong candidate", "results-driven".
- GOOD example (needs_review): "Candidate demonstrates relevant backend engineering exposure in PHP and Python, though evidence of advanced frontend architecture ownership and large-scale SaaS delivery is limited. Suitable for a screening call to probe production scale and seniority."
- BAD example: "Strong candidate for the full-stack role with excellent experience."

STRENGTHS / CONSIDERATIONS RULES:
- Each bullet starts with a short bold lead, then an em-dash, then the evidence sentence.
- For needs_review or weaker: considerations MUST be specific concerns (depth, scale, ownership, seniority, location, salary, notice), not generic platitudes. Strengths in these bands must be hedged ("baseline exposure", "some commercial use") — not "strong" / "deep" / "extensive".

Output ONLY valid JSON, no markdown, in this exact shape:
{
  "recommendation": "strong_match|recommended|moderate_fit|needs_review|limited_alignment|not_suitable",
  "summary": "<2–3 sentence executive summary, JD-specific, respects band tone>",
  "mandate_match": [
    { "requirement": "<short JD requirement label>", "evidence": "<specific CV evidence or 'No clear evidence found in CV.'>", "fit": "EXCEEDS|STRONG|GOOD|PARTIAL|WEAK|NOT MATCHED" }
  ],
  "strengths": ["<lead — evidence sentence>", "..."],
  "considerations": ["<lead — specific concern>", "..."],
  "risks": ["<hiring risk if applicable>"],
  "missing_requirements": ["<JD requirement with no real evidence>"],
  "recruiter_notes_summary": ["<how the recruiter note shaped this view>"]
}

Extract 5–8 of the JOB's most important requirements. 3–5 strengths, 3–5 considerations. Output JSON only.`;

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
      const score = canonical?.match_score;
      const ceil = score == null ? 2
                 : score < 35 ? 1
                 : score < 50 ? 2
                 : score < 62 ? 3
                 : score < 75 ? 4
                 : score < 88 ? 4
                 : 5;
      const inflated = hasMandate && (existing as any).mandate_match.some((m: any) =>
        m && typeof m.fit === "string" && !m.__kind &&
        Math.max(0, RANK.indexOf(String(m.fit).toUpperCase())) > ceil
      );
      // Also invalidate if the stored recommendation is still on the old 3-tier system.
      const legacyRec = ["strongly_recommended","needs_review","not_recommended"].includes(String((existing as any)?.recommendation ?? ""));
      if (existing && hasMandate && !inflated && !legacyRec && (!canonical || existing.fit_score === canonical.match_score) && !recruiterNotes.length) {
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
    // Rank: 0=NOT MATCHED 1=WEAK 2=PARTIAL 3=GOOD 4=STRONG 5=EXCEEDS
    const fitCeiling = (score: number | null): number => {
      if (score == null) return 2;       // PARTIAL
      if (score < 35) return 1;          // WEAK
      if (score < 50) return 2;          // PARTIAL
      if (score < 62) return 3;          // up to GOOD (rare)
      if (score < 75) return 4;          // STRONG (rare)
      if (score < 88) return 4;          // STRONG
      return 5;                          // EXCEEDS
    };
    const ceil = fitCeiling(canonicalScore);
    let goodUsed = 0, strongUsed = 0, exceedsUsed = 0;
    const goodCap =
      canonicalScore == null ? 99 :
      canonicalScore < 35 ? 0 :
      canonicalScore < 50 ? 0 :
      canonicalScore < 62 ? 1 :   // needs_review: max ONE GOOD
      99;
    const strongCap =
      canonicalScore == null ? 99 :
      canonicalScore < 62 ? 0 :   // needs_review and below: ZERO STRONG
      canonicalScore < 75 ? 1 :   // moderate_fit: max ONE STRONG
      99;
    const exceedsCap =
      canonicalScore == null ? 0 :
      canonicalScore < 75 ? 0 :
      canonicalScore < 88 ? 1 :   // recommended: max ONE EXCEEDS
      99;

    const mandate_match = Array.isArray(parsed.mandate_match)
      ? parsed.mandate_match
          .filter((m: any) => m && typeof m.requirement === "string" && typeof m.evidence === "string")
          .map((m: any) => {
            let f = ALLOWED_FITS.includes(String(m.fit).toUpperCase()) ? String(m.fit).toUpperCase() : "PARTIAL";
            if (fitRank(f) > ceil) f = ALLOWED_FITS[ceil];
            if (f === "EXCEEDS") {
              if (exceedsUsed >= exceedsCap) f = "STRONG";
              else exceedsUsed++;
            }
            if (f === "STRONG") {
              if (strongUsed >= strongCap) f = "GOOD";
              else strongUsed++;
            }
            if (f === "GOOD") {
              if (goodUsed >= goodCap) f = "PARTIAL";
              else goodUsed++;
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

    // Band-aware summary sanitization: if the recommendation is needs_review or
    // lower but the AI used inflated language, rewrite the summary with a
    // calibrated, evidence-based fallback so the report tone matches the band.
    const BANNED = [
      /\bstrong (candidate|profile|fit)\b/i, /\bexcellent (fit|candidate|experience|profile)\b/i,
      /\bhighly qualified\b/i, /\bideal (fit|candidate)\b/i, /\bperfect (fit|match)\b/i,
      /\bwell[- ]suited\b/i, /\bgreat fit\b/i, /\bresults[- ]driven\b/i,
      /\bpositions (him|her|them) (as a strong|well)\b/i,
      /\bsolid alignment\b/i, /\bgood suitability\b/i, /\bdeep experience\b/i,
      /\bextensive experience\b/i,
    ];
    const LOW_BANDS = new Set(["needs_review", "limited_alignment", "not_suitable"]);
    let cleanedSummary: string | null = parsed.summary ? String(parsed.summary).trim() : null;
    if (cleanedSummary && LOW_BANDS.has(recommendation) && BANNED.some((re) => re.test(cleanedSummary!))) {
      const firstName = String(candidate.full_name ?? "The candidate").split(" ")[0] || "The candidate";
      const role = job.title ?? "this role";
      const topGap =
        (Array.isArray(parsed.considerations) && parsed.considerations[0]) ||
        (mandate_match.find((m: any) => m.fit === "PARTIAL" || m.fit === "WEAK" || m.fit === "NOT MATCHED")?.requirement) ||
        "depth on key mandate areas";
      const topStrength =
        (Array.isArray(parsed.strengths) && parsed.strengths[0]) ||
        (mandate_match.find((m: any) => m.fit === "GOOD" || m.fit === "STRONG")?.requirement) ||
        "relevant baseline experience";
      cleanedSummary =
        `${firstName} shows ${String(topStrength).replace(/^\*+|\*+$/g, "").replace(/\s*[—:\-].*$/, "").toLowerCase()} relevant to ${role}, ` +
        `but evidence is limited around ${String(topGap).replace(/^\*+|\*+$/g, "").replace(/\s*[—:\-].*$/, "").toLowerCase()}. ` +
        `Recommend a screening call to validate commercial depth and production ownership before progressing.`;
    }

    const insertRow = {
      tenant_id: job.tenant_id,
      job_id, candidate_id,
      fit_score, recommendation,
      summary: cleanedSummary,
      strengths: Array.isArray(parsed.strengths) ? parsed.strengths.slice(0, 6) : [],
      weaknesses: Array.isArray(parsed.considerations) ? parsed.considerations.slice(0, 6) : (Array.isArray(parsed.weaknesses) ? parsed.weaknesses : []),
      risks: risksOut,
      mandate_match: [
        ...mandate_match,
        ...(missing_requirements.length ? [{ __kind: "missing", items: missing_requirements }] : []),
        ...(recruiterNotesSummary.length ? [{ __kind: "recruiter_notes_summary", items: recruiterNotesSummary }] : []),
      ],
      // recruiter_review intentionally dropped — the executive summary owns the closing voice.
      recruiter_review: null,
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
