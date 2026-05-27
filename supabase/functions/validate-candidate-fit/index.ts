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
const SYSTEM_PROMPT = `You are a senior executive-search consultant and talent validation specialist writing an evidence-based candidate assessment for a paying client. You are NOT a keyword matcher and NOT an optimistic AI summariser. You are calibrated, restrained, JD-anchored, and industry-aware. The recommendation, executive summary, fit table, strengths and considerations MUST be internally consistent — never contradict the recommendation band.

DECISION WEIGHTING (apply when reasoning, never disclose to the client):
  • 60% real CV evidence (production work, ownership, scale, years on stack, direct role titles in the right industry)
  • 25% recruiter context (screening notes, voice transcripts, off-CV observations, client fit, communication)
  • 15% transferable / adjacent skill inference (only across recognised families AND only when mandatory evidence is otherwise satisfied)
Recruiter context can SHIFT the recommendation by AT MOST ONE TIER, and never above "recommended" without a concrete CV anchor.

GOLDEN RULE — MANDATORY EVIDENCE CANNOT BE REPLACED BY TRANSFERABLE EXPERIENCE.
Adjacent / transferable experience SUPPORTS a candidate but NEVER substitutes for missing mandatory evidence. Examples that MUST be respected:
  • Trade Operations / Trade Control / Risk Analyst is NOT automatically a Compliance Analyst.
  • Backend engineer is NOT automatically a Fullstack engineer.
  • Risk Analyst is NOT automatically a Quant Trader.
  • Recruiter is NOT automatically an HRBP.
  • DevOps without production cloud is NOT a Cloud Engineer.
If the candidate's profile is adjacent but mandatory domain evidence is missing, the correct band is "moderate_fit", "limited_alignment" or "not_suitable" — NEVER "recommended" or "highly_recommended".

WORKFLOW (do all five before writing JSON):
STEP 1 — JD CLASSIFICATION (industry-aware). Detect:
  • industry_domain: tech (backend, frontend, fullstack, cloud, devops, cybersecurity, ai_ml), commodities_trading (compliance, sanctions, KYC, AML, CTRM/ETRM, derivatives, physical, trade finance), banking_finance (treasury, audit, quant, regulatory reporting, Basel, IFRS), oil_gas (drilling, HSE, offshore, process safety, refinery), aviation (CAMO, EASA, flight ops, maintenance planning), healthcare (clinical, nursing, medical coding, compliance), cybersecurity (SOC, SIEM, incident response, pen test, ISO27001), legal_compliance (investigations, sanctions, AML, policy, governance), hr_talent, sales, marketing, other.
  • mandatory_requirements: blocking core skills / industry exposure / regulatory knowledge / certifications without which the candidate cannot succeed. For regulated roles you MUST list the domain pillars explicitly (e.g. for "Compliance Analyst – Commodities Trading": direct commodities compliance experience, AML/CTF, sanctions & embargo, KYC & counterparty due diligence, market conduct / market abuse, trade documentation).
  • preferred_requirements: nice-to-have / accelerators.
  • transferable_families: adjacent skill families the role accepts (e.g. "Backend↔Fullstack", "Trade Ops↔Compliance support"). Adjacent profiles are relevant but capped — see GOLDEN RULE.
  • seniority_target: junior | mid | senior | lead.

STEP 2 — CANDIDATE EVIDENCE ANALYSIS. For every mandatory requirement, classify evidence as HIGH (direct industry role title, quantified ownership, years on the exact stack, certifications named on CV), MEDIUM (adjacent industry / role, partial overlap, indirect exposure), or LOW (keyword in skills section only, single mention, assumption, "no clear evidence"). HIGH may justify STRONG/EXCEEDS. MEDIUM caps at GOOD. LOW caps at PARTIAL — usually WEAK.

STEP 3 — MANDATORY REQUIREMENT GAP DETECTION (HARD CAPS, apply on top of score calibration):
  • ANY single mandatory requirement is LOW/missing → cannot exceed "recommended".
  • 30%+ mandatory requirements LOW/missing → cannot exceed "moderate_fit".
  • 50%+ mandatory requirements LOW/missing → cannot exceed "limited_alignment".
  • Regulated industry (commodities, banking, oil_gas, aviation, healthcare, cybersecurity, legal_compliance) AND the core domain pillar is missing (e.g. no compliance/AML/sanctions evidence for a Compliance Analyst) → cannot exceed "limited_alignment"; "moderate_fit" only when strong adjacent transferable evidence is documented in the CV.
  • Missing mandatory certification for aviation / oil & gas / healthcare regulated roles → cannot be "highly_recommended" or "recommended".

STEP 4 — RECRUITER NOTES IMPACT. Notes MUST influence reasoning. Produce a recruiter_notes_impact[] explaining how each note shifts the view. Notes may upgrade the band by AT MOST one tier when they supply concrete off-CV evidence; never above "recommended" without CV anchor; never bypass the GOLDEN RULE.

STEP 5 — RECOMMENDATION. Choose ONE of: highly_recommended | recommended | moderate_fit | limited_alignment | not_suitable. No numeric percentages.

CLIENT-FRIENDLY LANGUAGE (executive search voice). BANNED PHRASES when mandatory evidence is missing: "excellent fit", "highly qualified", "strong candidate", "exceeds requirements", "perfect fit", "ideal fit", "well-suited". Always banned: "lacks", "lacking", "weak candidate", "not qualified", "unqualified", "missing experience", "no matched skills", "poor fit", "reject", "disqualified", "cannot", "fails to", "does not have". Replacements: "transferable exposure", "adjacent industry background", "limited direct evidence", "partial alignment", "requires technical validation", "interview should assess depth in this area", "exposure appears indirect", "evidence not fully demonstrated in the provided CV", "production ownership should be explored during interview".

EVIDENCE RULES:
- A skill keyword in a list is LOW by default. Upgrade only with explicit years OR scale OR production ownership OR commercial context in the right industry.
- Adjacent experience does NOT cover an absent mandatory requirement.
- If you cannot quote concrete CV evidence, the evidence field MUST literally say "No clear evidence found in CV." and fit must be WEAK or NOT MATCHED.
- Seniority, industry and domain depth come from actual roles/companies/years — not skill words.

CALIBRATION (HARD CAPS — never exceed, AND apply STEP 3 mandatory-gap caps on top):
- score < 32  → "not_suitable" — WEAK/NOT MATCHED only.
- 32–51       → "limited_alignment" — Mostly WEAK/PARTIAL. Zero STRONG/EXCEEDS.
- 52–69       → "moderate_fit" — Mix of GOOD/PARTIAL, some WEAK. At most ONE STRONG.
- 70–84       → "recommended" — Majority GOOD/STRONG. EXCEEDS only with enterprise-scale proof (max 1).
- ≥ 85        → "highly_recommended" — STRONG/EXCEEDS dominate AND all mandatory requirements have HIGH evidence.

EXECUTIVE SUMMARY RULES:
- 2–3 sentences. Mention BOTH strengths AND gaps proportional to the band.
- For limited_alignment / not_suitable, and for moderate_fit when mandatory pillars are missing: LEAD with the evidence caveat or transferable framing — never with a positive framing. Use "limited direct evidence", "adjacent background", "transferable exposure", "requires technical validation", "production depth should be explored", "direct domain experience would benefit from interview discussion".
- For recommended / highly_recommended: lead with concrete strengths anchored to CV evidence.

STRENGTHS / CONSIDERATIONS RULES:
- Each bullet: short bold lead, em-dash, evidence sentence.
- Considerations are framed as "interview focus areas", never as rejections. Client-friendly language only.

Output ONLY valid JSON, no markdown, in this exact shape:
{
  "jd_classification": {
    "industry_domain": "<one of the labels above>",
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
      // Also invalidate if the stored row is missing the new five-band taxonomy
      // or jd_classification sidecar (older rows from before this engine update).
      const recStr = String((existing as any)?.recommendation ?? "");
      const legacyRec = ["strongly_recommended","needs_review","not_recommended"].includes(recStr);
      const hasJdClassification = hasMandate && (existing as any).mandate_match.some((m: any) => m?.__kind === "jd_classification");
      const needsRefresh = legacyRec || !hasJdClassification;
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
    const BAND_ORDER: RecLabel[] = ["not_suitable","limited_alignment","moderate_fit","recommended","strong_match"];
    const canonicalIdx = BAND_ORDER.indexOf(canonicalRec === "needs_review" ? "limited_alignment" : canonicalRec);
    let chosenIdx = canonicalIdx;
    if (aiRec && aiRec !== "needs_review") {
      const aiIdx = BAND_ORDER.indexOf(aiRec);
      if (aiIdx >= 0) {
        // Allow upgrade of at most 1 tier, capped at "recommended" unless canonical already says higher.
        const upgradeCap = Math.max(canonicalIdx, BAND_ORDER.indexOf("recommended"));
        chosenIdx = Math.min(Math.max(canonicalIdx, Math.min(aiIdx, canonicalIdx + 1)), upgradeCap);
      }
    }
    let recommendation: RecLabel = BAND_ORDER[chosenIdx] ?? canonicalRec;

    // MANDATORY-GAP HARD CAP (post-processing).
    // Even if the canonical hybrid score or the AI tries to upgrade the band,
    // transferable / adjacent experience must NEVER override missing mandatory
    // evidence. Count mandatory rows whose fit is WEAK or NOT MATCHED.
    const mandatoryRows = mandate_match.filter((m: any) => m.kind === "mandatory");
    const mandatoryMissing = mandatoryRows.filter((m: any) => m.fit === "WEAK" || m.fit === "NOT MATCHED");
    const mandatoryCount = mandatoryRows.length;
    const missRatio = mandatoryCount > 0 ? mandatoryMissing.length / mandatoryCount : 0;

    const regulatedDomains = new Set([
      "commodities_trading","banking_finance","oil_gas","aviation",
      "healthcare","cybersecurity","legal_compliance",
    ]);
    const industryDomain = String(jdClassification?.industry_domain ?? parsed?.jd_classification?.industry_domain ?? "").toLowerCase();
    const isRegulated = regulatedDomains.has(industryDomain);

    const capBand = (target: RecLabel) => {
      const ti = BAND_ORDER.indexOf(target);
      const ci = BAND_ORDER.indexOf(recommendation);
      if (ci > ti) recommendation = BAND_ORDER[ti];
    };

    if (mandatoryCount > 0) {
      if (missRatio >= 0.5) capBand("limited_alignment");
      else if (missRatio >= 0.3) capBand("moderate_fit");
      else if (mandatoryMissing.length >= 1) capBand("recommended");
      // Regulated industry + missing core pillar → never above limited_alignment
      // unless there is at least one mandatory row at GOOD or better (adjacent anchor).
      if (isRegulated && mandatoryMissing.length >= 1) {
        const anchored = mandatoryRows.some((m: any) => ["GOOD","STRONG","EXCEEDS"].includes(m.fit));
        capBand(anchored ? "moderate_fit" : "limited_alignment");
      }
    }


    // Derive missing_requirements from the mandate_match table as a fallback,
    // and merge anything the AI explicitly flagged. Soften all wording.
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

    const jdClassification = parsed.jd_classification && typeof parsed.jd_classification === "object" ? {
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
    const LOW_BANDS = new Set(["limited_alignment", "not_suitable"]);
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

    const insertRow = {
      tenant_id: job.tenant_id,
      job_id, candidate_id,
      fit_score, recommendation,
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
