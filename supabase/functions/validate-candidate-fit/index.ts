import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { computeMatchScore, MODEL_VERSION } from "../_shared/match-scoring.ts";
import { softenLanguage, softenList } from "../_shared/recruiter-language.ts";

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

WORKFLOW (do all five before writing JSON):
STEP 1 — JD CLASSIFICATION. Break the JOB DESCRIPTION into:
  • mandatory_requirements: blocking core skills/experience without which the candidate cannot succeed (e.g. "React", "REST APIs", "SQL", "Backend ownership").
  • preferred_requirements: nice-to-have / accelerators. Missing these must NOT penalise heavily (e.g. "Docker", "AWS", "CI/CD").
  • transferable_families: adjacent skill families the role accepts (e.g. "Backend↔Fullstack", "Java↔Python", "DevOps↔Backend infra"). Adjacent profiles are NEVER irrelevant.
  • seniority_target: junior | mid | senior | lead — inferred from JD scope, ownership, leadership signals.

STEP 2 — CANDIDATE ANALYSIS (evidence only). Validate using real production evidence: shipped projects, architecture ownership, scale, years on stack, deployment, leadership scope. Keyword lists and generic summaries are LOW confidence.

STEP 3 — RECRUITER NOTES IMPACT. Notes (relocation, salary flex, communication, leadership, off-CV exposure, "frontend not fully reflected in CV") MUST influence reasoning. Produce a recruiter_notes_impact[] explaining how each note shifts the view. Notes may upgrade the band by AT MOST one tier when they supply concrete off-CV evidence; never above "recommended" without CV anchor.

STEP 4 — RECOMMENDATION. Choose ONE of: highly_recommended | recommended | moderate_fit | limited_alignment | not_suitable. No numeric percentages. Adjacent engineers (Backend→Fullstack, Java→Python) applying to engineering roles default to "moderate_fit" or "recommended" — never "limited_alignment" unless the domain is wrong.

STEP 5 — CLIENT-FRIENDLY LANGUAGE. Write as a senior recruiter preparing a client shortlist. Encourage discussion; never reject harshly. BANNED PHRASES anywhere in your output: "lacks", "lacking", "weak candidate", "not qualified", "unqualified", "missing experience", "no matched skills", "poor fit", "reject", "disqualified", "cannot", "fails to", "does not have". Replacements: "may benefit from technical validation", "appears limited in the provided CV", "additional discussion recommended around X", "production ownership should be explored during interview", "limited direct stack overlap", "earlier in their career than the stated band".

EVIDENCE CONFIDENCE HIERARCHY (classify each requirement BEFORE choosing fit):
- HIGH: quantified achievements, explicit years on stack, project ownership, architecture responsibility, production delivery, leadership scope. Only HIGH may justify STRONG or EXCEEDS.
- MEDIUM: multiple stack mentions across roles, project descriptions without quantification, partial implementation. Max fit: GOOD.
- LOW: skills section only, single keyword mention, no project context. Max fit: PARTIAL. Often WEAK. Never STRONG.

EVIDENCE RULES:
- A skill keyword in a list is LOW by default. Upgrade only with explicit years OR scale OR production ownership OR commercial context.
- Adjacent experience does NOT cover an absent mandatory requirement: a Backend engineer applying to Fullstack can be PARTIAL/GOOD on frontend at best — never STRONG — unless the CV proves shipped frontend.
- If you cannot quote concrete CV evidence, the evidence field MUST literally say "No clear evidence found in CV." and fit must be WEAK or NOT MATCHED. Use the client-friendly considerations line to soften it.
- Seniority, industry and domain depth come from actual roles/companies/years — not skill words.

CALIBRATION (HARD CAPS — never exceed):
- score < 32  → "not_suitable" — WEAK/NOT MATCHED only. Zero GOOD/STRONG/EXCEEDS.
- 32–51       → "limited_alignment" — Mostly WEAK/PARTIAL. Zero STRONG/EXCEEDS.
- 52–69       → "moderate_fit" — Mix of GOOD/PARTIAL, some WEAK. At most ONE STRONG.
- 70–84       → "recommended" — Majority GOOD/STRONG. EXCEEDS only with enterprise-scale proof (max 1).
- ≥ 85        → "highly_recommended" — STRONG/EXCEEDS dominate.

EXECUTIVE SUMMARY RULES (sets tone for the rest):
- 2–3 sentences. Mention BOTH strengths AND gaps proportional to the band.
- For limited_alignment / not_suitable: LEAD with the gap or evidence caveat — never with a positive framing. Use "limited evidence", "moderate exposure", "partial alignment", "requires technical validation", "production depth should be explored".
- For moderate_fit: balance — a relevant strength then a calibrated caveat.
- For recommended / highly_recommended: lead with concrete strengths anchored to CV evidence.

STRENGTHS / CONSIDERATIONS RULES:
- Each bullet: short bold lead, em-dash, evidence sentence.
- Considerations are framed as "interview focus areas", never as rejections. Use client-friendly language.

Output ONLY valid JSON, no markdown, in this exact shape:
{
  "jd_classification": {
    "mandatory_requirements": ["..."],
    "preferred_requirements": ["..."],
    "transferable_families": ["..."],
    "seniority_target": "junior|mid|senior|lead"
  },
  "recommendation": "highly_recommended|recommended|moderate_fit|limited_alignment|not_suitable",
  "summary": "<2–3 sentence executive summary, JD-specific, respects band tone, client-friendly>",
  "mandate_match": [
    { "requirement": "<short JD requirement label>", "kind": "mandatory|preferred", "evidence": "<specific CV evidence or 'No clear evidence found in CV.'>", "fit": "EXCEEDS|STRONG|GOOD|PARTIAL|WEAK|NOT MATCHED" }
  ],
  "strengths": ["<lead — evidence sentence>", "..."],
  "considerations": ["<lead — interview focus area, client-friendly>", "..."],
  "risks": ["<hiring risk if applicable, soft phrasing>"],
  "missing_requirements": ["<JD requirement with no real evidence, soft phrasing>"],
  "recruiter_notes_summary": ["<how the recruiter note shaped this view>"],
  "recruiter_notes_impact": [{ "note": "<paraphrased recruiter note>", "effect": "<how it shifted the assessment>" }]
}

Extract 5–8 of the JOB's most important requirements (mandatory first, preferred after). 3–5 strengths, 3–5 considerations. Output JSON only.`;

type RecLabel =
  | "strong_match" | "recommended" | "moderate_fit"
  | "needs_review" | "limited_alignment" | "not_suitable";

// AI emits "highly_recommended"; the platform stores the canonical key
// "strong_match" (label is rendered as "Highly Recommended" everywhere).
function normalizeRecLabel(input: any): RecLabel | null {
  const k = String(input ?? "").toLowerCase().replace(/[\s-]+/g, "_");
  if (k === "highly_recommended" || k === "strongly_recommended" || k === "strong_match") return "strong_match";
  if (k === "recommended") return "recommended";
  if (k === "moderate_fit") return "moderate_fit";
  if (k === "limited_alignment") return "limited_alignment";
  if (k === "not_suitable" || k === "not_recommended") return "not_suitable";
  if (k === "needs_review") return "needs_review";
  return null;
}

function recommendationFromScore(score: number): RecLabel {
  if (score >= 85) return "strong_match";        // Highly Recommended
  if (score >= 70) return "recommended";
  if (score >= 52) return "moderate_fit";
  if (score >= 32) return "limited_alignment";
  return "not_suitable";
}

const REC_ALLOWED: RecLabel[] = [
  "strong_match", "recommended", "moderate_fit",
  "limited_alignment", "not_suitable",
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
                 : score < 32 ? 1
                 : score < 52 ? 2
                 : score < 70 ? 3
                 : score < 85 ? 4
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

    // Evidence-quality classifier: detect LOW-confidence evidence text and cap fit at PARTIAL.
    const LOW_EVIDENCE_PATTERNS = [
      /^\s*(lists?|mentions?|includes?|references?|notes?)\b/i,
      /\bskills?\s+section\b/i,
      /\bskills?\s+(list|include|listed|mentioned)\b/i,
      /\bkeyword(s)?\b/i,
      /\bone[- ]line\b/i,
      /\bno (project|production|delivery|years|context)\b/i,
      /\bnot specified\b/i,
    ];
    const HIGH_EVIDENCE_HINTS = [
      /\b\d+\+?\s*(years|yrs)\b/i,
      /\b(led|owned|architect|designed|delivered|shipped|scaled|built|migrated|launched)\b/i,
      /\b(team of|managed|head of|director|principal|staff|lead)\b/i,
      /\b(production|enterprise|saas|platform|million|billion|k users|m users|throughput|tps|qps)\b/i,
    ];
    const evidenceQuality = (ev: string): "low" | "med" | "high" => {
      const s = String(ev || "").trim();
      if (!s || /no clear evidence/i.test(s)) return "low";
      const high = HIGH_EVIDENCE_HINTS.some((re) => re.test(s));
      const low = LOW_EVIDENCE_PATTERNS.some((re) => re.test(s)) || s.split(/\s+/).length < 8;
      if (high && !low) return "high";
      if (low && !high) return "low";
      return "med";
    };

    const mandate_match = Array.isArray(parsed.mandate_match)
      ? parsed.mandate_match
          .filter((m: any) => m && typeof m.requirement === "string" && typeof m.evidence === "string")
          .map((m: any) => {
            let f = ALLOWED_FITS.includes(String(m.fit).toUpperCase()) ? String(m.fit).toUpperCase() : "PARTIAL";
            if (fitRank(f) > ceil) f = ALLOWED_FITS[ceil];
            // Evidence-quality guard: shallow evidence cannot earn STRONG/EXCEEDS; medium caps at GOOD.
            const q = evidenceQuality(m.evidence);
            if (q === "low" && fitRank(f) > 2) f = "PARTIAL";       // PARTIAL ceiling
            else if (q === "med" && fitRank(f) > 3) f = "GOOD";     // GOOD ceiling
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
