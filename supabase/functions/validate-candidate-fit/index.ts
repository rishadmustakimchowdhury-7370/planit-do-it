import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { computeMatchScore, MODEL_VERSION } from "../_shared/match-scoring.ts";
import { softenLanguage, softenList } from "../_shared/recruiter-language.ts";
import { VALIDATION_SYSTEM_PROMPT } from "../_shared/validation-prompt.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Evidence-based recruitment intelligence engine. The system prompt lives in
// _shared/validation-prompt.ts (VALIDATION_SYSTEM_PROMPT) so the live engine,
// the QA harness, and any future surface share IDENTICAL reasoning. Do NOT
// fork the prompt here.
const SYSTEM_PROMPT = VALIDATION_SYSTEM_PROMPT;


type RecLabel =
  // New 6-band Executive Search taxonomy
  | "strong_match" | "recommended" | "transferable_match"
  | "needs_validation" | "weak_match" | "reject"
  // Retained for backward compatibility with older surfaces
  | "moderate_fit" | "needs_review" | "limited_alignment" | "not_suitable";

function normalizeRecLabel(input: any): RecLabel | null {
  const k = String(input ?? "").toLowerCase().replace(/[\s-]+/g, "_");
  if (k === "highly_recommended" || k === "strongly_recommended" || k === "strong_match") return "strong_match";
  if (k === "recommended") return "recommended";
  if (k === "transferable_match") return "transferable_match";
  if (k === "needs_validation") return "needs_validation";
  if (k === "weak_match") return "weak_match";
  if (k === "reject" || k === "not_recommended" || k === "not_suitable") return "reject";
  // Legacy → new
  if (k === "moderate_fit") return "needs_validation";
  if (k === "limited_alignment") return "weak_match";
  if (k === "needs_review") return "needs_validation";
  return null;
}

function recommendationFromScore(score: number): RecLabel {
  if (score >= 85) return "strong_match";
  if (score >= 70) return "recommended";
  if (score >= 55) return "transferable_match";
  if (score >= 40) return "needs_validation";
  if (score >= 25) return "weak_match";
  return "reject";
}

const REC_ALLOWED: RecLabel[] = [
  "strong_match", "recommended", "transferable_match",
  "needs_validation", "weak_match", "reject",
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
      // Also invalidate if the stored row is missing the new taxonomy / engine
      // version, OR if the JD changed (validation_stale = true), OR if it
      // predates the Executive Search OS engine.
      const recStr = String((existing as any)?.recommendation ?? "");
      const legacyRec = ["strongly_recommended","needs_review","not_recommended","moderate_fit","limited_alignment","not_suitable"].includes(recStr);
      const hasJdClassification = hasMandate && (existing as any).mandate_match.some((m: any) => m?.__kind === "jd_classification");
      const isStale = (existing as any)?.validation_stale === true;
      const oldEngine = (existing as any)?.engine_version !== "exec_search_v1";
      const needsRefresh = legacyRec || !hasJdClassification || isStale || oldEngine;
      if (existing && hasMandate && !inflated && !needsRefresh && (!canonical || existing.fit_score === canonical.match_score) && !recruiterNotes.length) {
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
    // Five-band thresholds: <32 not_suitable, <52 limited_alignment,
    // <70 moderate_fit, <85 recommended, ≥85 highly_recommended.
    const fitCeiling = (score: number | null): number => {
      if (score == null) return 2;       // PARTIAL
      if (score < 32) return 1;          // WEAK
      if (score < 52) return 2;          // PARTIAL
      if (score < 70) return 3;          // GOOD
      if (score < 85) return 4;          // STRONG
      return 5;                          // EXCEEDS
    };
    const ceil = fitCeiling(canonicalScore);
    let goodUsed = 0, strongUsed = 0, exceedsUsed = 0;
    const goodCap =
      canonicalScore == null ? 99 :
      canonicalScore < 32 ? 0 :
      canonicalScore < 52 ? 1 :        // limited_alignment: max ONE GOOD
      99;
    const strongCap =
      canonicalScore == null ? 99 :
      canonicalScore < 52 ? 0 :        // limited_alignment & below: ZERO STRONG
      canonicalScore < 70 ? 1 :        // moderate_fit: max ONE STRONG
      99;
    const exceedsCap =
      canonicalScore == null ? 0 :
      canonicalScore < 70 ? 0 :
      canonicalScore < 85 ? 1 :        // recommended: max ONE EXCEEDS
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
            const q = evidenceQuality(m.evidence);
            if (q === "low" && fitRank(f) > 2) f = "PARTIAL";
            else if (q === "med" && fitRank(f) > 3) f = "GOOD";
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
            const kind = String(m.kind ?? "").toLowerCase() === "preferred" ? "preferred" : "mandatory";
            return {
              requirement: String(m.requirement).slice(0, 120),
              kind,
              evidence: softenLanguage(String(m.evidence).slice(0, 600)),
              fit: f,
            };
          })
          // Sort mandatory first, preferred after — drives PDF/UI ordering.
          .sort((a: any, b: any) => (a.kind === "mandatory" ? -1 : 1) - (b.kind === "mandatory" ? -1 : 1))
          .slice(0, 10)
      : [];

    // Recommendation: prefer the canonical deterministic band, but allow the AI
    // (recruiter brain + notes_impact) to upgrade by AT MOST one tier when it
    // explicitly chose a higher band. Never inflate above "recommended" via
    // notes alone. Never downgrade arbitrarily — canonical is the floor.
    const fit_score = canonicalScore != null ? canonicalScore : 0;
    const canonicalRec = recommendationFromScore(fit_score);
    const aiRec = normalizeRecLabel(parsed.recommendation);
    const BAND_ORDER: RecLabel[] = ["reject","weak_match","needs_validation","transferable_match","recommended","strong_match"];
    const normalizeLegacy = (r: RecLabel): RecLabel =>
      r === "not_suitable" || r === "limited_alignment" ? "weak_match" :
      r === "moderate_fit" || r === "needs_review" ? "needs_validation" : r;
    const canonicalIdx = BAND_ORDER.indexOf(normalizeLegacy(canonicalRec));
    let chosenIdx = canonicalIdx;
    if (aiRec) {
      const aiIdx = BAND_ORDER.indexOf(normalizeLegacy(aiRec));
      if (aiIdx >= 0) {
        // Allow upgrade of at most 1 tier, capped at "recommended" unless canonical already says higher.
        const upgradeCap = Math.max(canonicalIdx, BAND_ORDER.indexOf("recommended"));
        chosenIdx = Math.min(Math.max(canonicalIdx, Math.min(aiIdx, canonicalIdx + 1)), upgradeCap);
      }
    }
    let recommendation: RecLabel = BAND_ORDER[chosenIdx] ?? canonicalRec;

    // Build jdClassification early so downstream regulated-industry logic can use it.
    const jdClassification = parsed.jd_classification && typeof parsed.jd_classification === "object" ? {
      industry_domain: String(parsed.jd_classification.industry_domain ?? "").toLowerCase() || null,
      mandatory_requirements: Array.isArray(parsed.jd_classification.mandatory_requirements)
        ? parsed.jd_classification.mandatory_requirements.map(String).slice(0, 12) : [],
      preferred_requirements: Array.isArray(parsed.jd_classification.preferred_requirements)
        ? parsed.jd_classification.preferred_requirements.map(String).slice(0, 12) : [],
      transferable_families: Array.isArray(parsed.jd_classification.transferable_families)
        ? parsed.jd_classification.transferable_families.map(String).slice(0, 8) : [],
      seniority_target: ["junior","mid","senior","lead"].includes(String(parsed.jd_classification.seniority_target ?? "").toLowerCase())
        ? String(parsed.jd_classification.seniority_target).toLowerCase()
        : null,
    } : null;

    // MANDATORY-GAP HARD CAP (post-processing).
    const mandatoryRows = mandate_match.filter((m: any) => m.kind === "mandatory");
    const mandatoryMissing = mandatoryRows.filter((m: any) => m.fit === "WEAK" || m.fit === "NOT MATCHED");
    const mandatoryCount = mandatoryRows.length;
    const missRatio = mandatoryCount > 0 ? mandatoryMissing.length / mandatoryCount : 0;

    const regulatedDomains = new Set([
      "commodities_trading","banking_finance","oil_gas","aviation",
      "healthcare","cybersecurity","legal_compliance",
      "maritime","energy","government","manufacturing",
    ]);
    const industryDomain = String(jdClassification?.industry_domain ?? parsed?.jd_classification?.industry_domain ?? "").toLowerCase();
    const isRegulated = regulatedDomains.has(industryDomain);

    const capBand = (target: RecLabel) => {
      const ti = BAND_ORDER.indexOf(target);
      const ci = BAND_ORDER.indexOf(recommendation);
      if (ci > ti) recommendation = BAND_ORDER[ti];
    };

    if (mandatoryCount > 0) {
      if (missRatio >= 0.5) capBand("weak_match");
      else if (missRatio >= 0.3) capBand("needs_validation");
      else if (mandatoryMissing.length >= 1) capBand("recommended");
      if (isRegulated && mandatoryMissing.length >= 1) {
        const anchored = mandatoryRows.some((m: any) => ["GOOD","STRONG","EXCEEDS"].includes(m.fit));
        capBand(anchored ? "needs_validation" : "weak_match");
      }
    }

    // Derive missing_requirements
    const aiMissing = Array.isArray(parsed.missing_requirements) ? parsed.missing_requirements.map(String) : [];
    const tableMissing = mandate_match
      .filter((m: any) => m.fit === "NOT MATCHED" || m.fit === "WEAK")
      .map((m: any) => m.requirement);
    const missing_requirements = softenList(Array.from(new Set([...aiMissing, ...tableMissing])).slice(0, 8));

    const recruiterNotesSummary = softenList(
      Array.isArray(parsed.recruiter_notes_summary) ? parsed.recruiter_notes_summary.slice(0, 6) : []
    );
    const recruiterNotesImpact = Array.isArray(parsed.recruiter_notes_impact)
      ? parsed.recruiter_notes_impact
          .filter((x: any) => x && (x.note || x.effect))
          .slice(0, 6)
          .map((x: any) => ({
            note: softenLanguage(String(x.note ?? "")).slice(0, 240),
            effect: softenLanguage(String(x.effect ?? "")).slice(0, 240),
          }))
      : [];


    const risksOut = softenList(Array.isArray(parsed.risks) ? parsed.risks.slice(0, 6) : []);

    // Band-aware summary sanitisation: low bands cannot use inflated language.
    const BANNED = [
      /\bstrong (candidate|profile|fit)\b/i, /\bexcellent (fit|candidate|experience|profile)\b/i,
      /\bhighly qualified\b/i, /\bideal (fit|candidate)\b/i, /\bperfect (fit|match)\b/i,
      /\bwell[- ]suited\b/i, /\bgreat fit\b/i, /\bresults[- ]driven\b/i,
      /\bpositions (him|her|them) (as a strong|well)\b/i,
      /\bsolid alignment\b/i, /\bgood suitability\b/i, /\bdeep experience\b/i,
      /\bextensive experience\b/i,
    ];
    const LOW_BANDS = new Set(["weak_match", "reject", "limited_alignment", "not_suitable"]);
    let cleanedSummary: string | null = parsed.summary ? softenLanguage(String(parsed.summary).trim()) : null;
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
        `${firstName} brings ${String(topStrength).replace(/^\*+|\*+$/g, "").replace(/\s*[—:\-].*$/, "").toLowerCase()} relevant to ${role}, ` +
        `with evidence around ${String(topGap).replace(/^\*+|\*+$/g, "").replace(/\s*[—:\-].*$/, "").toLowerCase()} that would benefit from validation at interview. ` +
        `Recommend a screening conversation to explore production depth and ownership before progressing.`;
    }

    // Extract new Executive Search fields from the AI output
    const interviewProbability = (() => {
      const n = Number(parsed.interview_probability);
      if (!Number.isFinite(n)) return null;
      return Math.max(0, Math.min(100, Math.round(n)));
    })();
    const ecosystemSignals = Array.isArray(parsed.ecosystem_signals)
      ? parsed.ecosystem_signals
          .filter((s: any) => s && typeof s.company === "string")
          .slice(0, 10)
          .map((s: any) => ({
            company: String(s.company).slice(0, 80),
            ecosystem: String(s.ecosystem ?? "").slice(0, 80),
            relevance: ["tier1","tier2","adjacent"].includes(String(s.relevance)) ? String(s.relevance) : "adjacent",
          }))
      : [];
    const functionalOwnership = Array.isArray(parsed.functional_ownership)
      ? parsed.functional_ownership.slice(0, 10).map((x: any) => String(x).slice(0, 120))
      : [];
    const matchClassification = recommendation; // post-cap final decision is the SoT

    // Pull the authoritative jd_signature from the DB so it matches the
    // value the jobs trigger maintains (md5 of material JD fields).
    let jdSig: string | null = null;
    try {
      const { data: sigRow } = await admin.from("jobs").select("jd_signature").eq("id", job_id).maybeSingle();
      jdSig = (sigRow as any)?.jd_signature ?? null;
    } catch { /* ignore */ }

    const insertRow = {
      tenant_id: job.tenant_id,
      job_id, candidate_id,
      fit_score, recommendation,
      match_classification: matchClassification,
      interview_probability: interviewProbability,
      ecosystem_signals: ecosystemSignals,
      jd_signature: jdSig || null,
      validation_stale: false,
      engine_version: "exec_search_v1",
      summary: cleanedSummary,
      strengths: softenList(Array.isArray(parsed.strengths) ? parsed.strengths.slice(0, 6) : []),
      weaknesses: softenList(Array.isArray(parsed.considerations) ? parsed.considerations.slice(0, 6) : (Array.isArray(parsed.weaknesses) ? parsed.weaknesses : [])),
      risks: risksOut,
      mandate_match: [
        ...mandate_match,
        ...(jdClassification ? [{ __kind: "jd_classification", ...jdClassification }] : []),
        ...(missing_requirements.length ? [{ __kind: "missing", items: missing_requirements }] : []),
        ...(recruiterNotesSummary.length ? [{ __kind: "recruiter_notes_summary", items: recruiterNotesSummary }] : []),
        ...(recruiterNotesImpact.length ? [{ __kind: "recruiter_notes_impact", items: recruiterNotesImpact }] : []),
        ...(functionalOwnership.length ? [{ __kind: "functional_ownership", items: functionalOwnership }] : []),
      ],
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
