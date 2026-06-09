// Explainable, dimension-by-dimension scoring engine for the new Enterprise
// AI Validation pipeline. Reads two structured inputs:
//   - StructuredCandidateProfile (from parse-cv)
//   - StructuredJobDescription   (from structure-jd)
// Produces a fully traceable score: every weighted dimension carries the
// matched items, missing items, transferable considerations, and the
// per-dimension sub-score. Used by validate-candidate-fit-v2.

import type {
  StructuredCandidateProfile,
  StructuredJobDescription,
  NormalizedSkill,
  NormalizedIndustry,
  NormalizedTitle,
  NormalizedCertification,
  NormalizedEducation,
  NormalizedLocation,
} from "./structured-schema.ts";
import { expandImpliedSkillTokens, impliedSkillsFor } from "./skill-inference.ts";

// ---------- weights profile ---------------------------------------------

export interface ScoringWeights {
  role_similarity: number;  // role_first_v1: 35 — functional fit dominates
  mandatory_skills: number; // role_first_v1: 25
  domain: number;           // role_first_v1: 15
  experience: number;       // role_first_v1: 10
  industry: number;         // role_first_v1: 5  — improves rank, never dominates
  location: number;         // role_first_v1: 5
  education: number;        // role_first_v1: 5
  /** Legacy title-string scorer is now subsumed by role_similarity; kept at 0. */
  title?: number;
}

export interface TierThresholds {
  strong: number;     // default 85
  recommended: number;// default 70
  transferable: number;// default 55
}

// role_first_v1 — function-first scoring profile.
// Approved weights: Right Function > Right Skills > Right Domain > Right Industry.
export const DEFAULT_WEIGHTS: ScoringWeights = {
  role_similarity: 35,
  mandatory_skills: 25,
  domain: 15,
  experience: 10,
  industry: 5,
  location: 5,
  education: 5,
  title: 0,
};

export const SCORING_PROFILE_NAME = "role_first_v1";

export const DEFAULT_THRESHOLDS: TierThresholds = {
  strong: 85,
  recommended: 70,
  transferable: 55,
};


export type RecommendationTier =
  | "strong_match"
  | "recommended"
  | "transferable_match"
  | "needs_validation"
  | "weak_match"
  | "reject";

// ---------- helpers ------------------------------------------------------

const norm = (s: unknown): string =>
  String(s ?? "").toLowerCase().replace(/[^a-z0-9+#./ -]/g, " ").replace(/\s+/g, " ").trim();

const titleTokens = (t: NormalizedTitle | null | undefined): Set<string> => {
  const out = new Set<string>();
  if (!t) return out;
  if (t.canonical) out.add(norm(t.canonical));
  for (const a of t.aliases ?? []) out.add(norm(a));
  for (const r of t.related ?? []) out.add(norm(r));
  return out;
};

const skillTokens = (s: NormalizedSkill): Set<string> => {
  const out = new Set<string>([norm(s.name)]);
  for (const a of s.aliases ?? []) out.add(norm(a));
  return out;
};

const industryDirectSet = (i: NormalizedIndustry | null | undefined): Set<string> => {
  const out = new Set<string>();
  if (!i) return out;
  out.add(norm(i.canonical));
  for (const a of i.aliases ?? []) out.add(norm(a));
  return out;
};

const intersectsAny = (a: Set<string>, bs: Set<string>[]): boolean => {
  for (const b of bs) for (const x of b) if (a.has(x)) return true;
  return false;
};

// =========================================================================

export interface DimensionResult {
  weight: number;
  score_0_1: number;
  weighted: number;          // weight * score_0_1
  matched: string[];
  missing: string[];
  transferable: string[];
  note: string;
}

export interface SkillMatch {
  required: string;
  matched: boolean;
  via?: string;              // candidate alias that matched
  candidate_skill?: string;  // canonical candidate skill
}

export interface ValidationExplanation {
  final_score: number;
  recommendation_tier: RecommendationTier;
  weights_profile: ScoringWeights;
  thresholds: TierThresholds;
  dimensions: Record<string, DimensionResult>;
  mandatory_skills_matched: SkillMatch[];
  preferred_skills_matched: SkillMatch[];
  missing_requirements: string[];
  deal_breakers_triggered: string[];
  transferable_considerations: string[];
  penalty: number;
  summary: string;
}

// ---------- dimension scorers -------------------------------------------

function scoreSkills(required: NormalizedSkill[], candidate: NormalizedSkill[], weight: number, kind: "mandatory" | "preferred"): {
  dim: DimensionResult;
  matches: SkillMatch[];
} {
  if (required.length === 0) {
    return {
      dim: { weight, score_0_1: 1, weighted: weight, matched: [], missing: [], transferable: [], note: `No ${kind} skills specified.` },
      matches: [],
    };
  }
  const candAliasMap: { canonical: string; tokens: Set<string> }[] =
    candidate.map((s) => ({ canonical: s.name, tokens: skillTokens(s) }));

  const matches: SkillMatch[] = [];
  for (const req of required) {
    const reqTokens = skillTokens(req);
    let hit: SkillMatch = { required: req.name, matched: false };
    for (const c of candAliasMap) {
      for (const t of reqTokens) {
        if (c.tokens.has(t)) {
          hit = { required: req.name, matched: true, via: t, candidate_skill: c.canonical };
          break;
        }
      }
      if (hit.matched) break;
    }
    matches.push(hit);
  }
  const matched = matches.filter((m) => m.matched);
  const missing = matches.filter((m) => !m.matched);
  const score = matched.length / required.length;

  return {
    dim: {
      weight,
      score_0_1: score,
      weighted: weight * score,
      matched: matched.map((m) => m.required),
      missing: missing.map((m) => m.required),
      transferable: [],
      note: `${matched.length}/${required.length} ${kind} skills matched.`,
    },
    matches,
  };
}

function scoreIndustry(job: StructuredJobDescription, cand: StructuredCandidateProfile, weight: number): DimensionResult {
  const jobDirect = industryDirectSet(job.industry);
  const jobAdjacent = new Set<string>((job.industry?.adjacent ?? []).map(norm));
  const jobTransferable = new Set<string>([
    ...(job.industry?.transferable ?? []).map(norm),
    ...job.industries_acceptable.flatMap((i) => [norm(i.canonical), ...(i.aliases ?? []).map(norm)]),
  ]);

  const candIndustrySets = cand.industries.map(industryDirectSet);
  // Also pull from work_history
  for (const r of cand.work_history) {
    if (r.industry) {
      const s = new Set<string>([norm(r.industry), ...(r.industry_aliases ?? []).map(norm)]);
      candIndustrySets.push(s);
    }
  }

  const direct = candIndustrySets.some((s) => intersectsAny(s, [jobDirect]));
  const adjacent = !direct && candIndustrySets.some((s) => intersectsAny(s, [jobAdjacent]));
  const transferable = !direct && !adjacent && candIndustrySets.some((s) => intersectsAny(s, [jobTransferable]));

  let score = 0, note = "No industry alignment detected.";
  const matched: string[] = [], transferableList: string[] = [];
  if (direct) {
    score = 1; note = `Direct industry match: ${job.industry?.canonical ?? "n/a"}.`;
    if (job.industry?.canonical) matched.push(job.industry.canonical);
  } else if (adjacent) {
    score = 0.7; note = `Adjacent industry experience to ${job.industry?.canonical ?? "n/a"}.`;
    transferableList.push(...cand.industries.map((i) => i.canonical));
  } else if (transferable) {
    score = 0.45; note = `Transferable industry experience from ${cand.industries.map((i) => i.canonical).join(", ") || "candidate background"}.`;
    transferableList.push(...cand.industries.map((i) => i.canonical));
  }
  return {
    weight, score_0_1: score, weighted: weight * score,
    matched, missing: direct ? [] : [job.industry?.canonical ?? "Industry alignment"],
    transferable: transferableList, note,
  };
}

function scoreDomain(job: StructuredJobDescription, cand: StructuredCandidateProfile, weight: number): DimensionResult {
  const jobDomains = new Set<string>(job.domain_expertise.map(norm));
  if (jobDomains.size === 0) {
    return { weight, score_0_1: 1, weighted: weight, matched: [], missing: [], transferable: [], note: "No specific domain expertise required." };
  }
  const candDomains = new Set<string>(cand.domain_expertise.map(norm));
  // include each work_history domain
  for (const r of cand.work_history) if (r.domain) candDomains.add(norm(r.domain));

  const matched: string[] = []; const missing: string[] = [];
  for (const d of job.domain_expertise) (candDomains.has(norm(d)) ? matched : missing).push(d);
  const score = matched.length / job.domain_expertise.length;
  return {
    weight, score_0_1: score, weighted: weight * score,
    matched, missing, transferable: [],
    note: `${matched.length}/${job.domain_expertise.length} domain areas matched.`,
  };
}

function scoreTitle(job: StructuredJobDescription, cand: StructuredCandidateProfile, weight: number): DimensionResult {
  // Kept for backward compatibility; weight is 0 under role_first_v1.
  const jobT = titleTokens(job.title);
  if (jobT.size === 0 || weight === 0) {
    return { weight, score_0_1: 0, weighted: 0, matched: [], missing: [], transferable: [], note: "Title scorer subsumed by role_similarity." };
  }
  const candT = titleTokens(cand.current_title);
  const overlap = [...jobT].some((t) => candT.has(t));
  const s = overlap ? 1 : 0;
  return { weight, score_0_1: s, weighted: weight * s, matched: [], missing: [], transferable: [], note: "Legacy title scorer." };
}

// ============= role_similarity =========================================
// Functional Role Match — highest-weighted dimension under role_first_v1.
// Uses the structured taxonomy (function_family, canonical/aliases/related)
// generated per-job and per-candidate by structure-jd and parse-cv.
function scoreRoleSimilarity(
  job: StructuredJobDescription,
  cand: StructuredCandidateProfile,
  weight: number,
  mandatorySkillScore: number,
): DimensionResult {
  const jobFamily = norm(job.title?.function_family ?? "");
  const jobCanon = norm(job.title?.canonical ?? "");
  const jobAliases = new Set<string>([...(job.title?.aliases ?? []).map(norm)]);
  const jobRelated = new Set<string>([...(job.title?.related ?? []).map(norm)]);

  // Build candidate corpus across current + every past role.
  const candFamilies = new Set<string>();
  const candCanonicalLike = new Set<string>();
  const candRelated = new Set<string>();
  const addCandTitle = (t: { canonical?: string | null; aliases?: string[] | null; related?: string[] | null; function_family?: string | null } | null | undefined) => {
    if (!t) return;
    if (t.function_family) candFamilies.add(norm(t.function_family));
    if (t.canonical) candCanonicalLike.add(norm(t.canonical));
    for (const a of t.aliases ?? []) candCanonicalLike.add(norm(a));
    for (const r of t.related ?? []) candRelated.add(norm(r));
  };
  addCandTitle(cand.current_title as any);
  for (const r of cand.work_history ?? []) {
    if (r.function_family) candFamilies.add(norm(r.function_family));
    if (r.normalized_title) candCanonicalLike.add(norm(r.normalized_title));
    if (r.title) candCanonicalLike.add(norm(r.title));
    for (const a of r.title_aliases ?? []) candCanonicalLike.add(norm(a));
    for (const x of r.related_titles ?? []) candRelated.add(norm(x));
  }

  // Tier resolution.
  const exactCanonical = jobCanon && (candCanonicalLike.has(jobCanon) || [...jobAliases].some((a) => candCanonicalLike.has(a)));
  const sameFamily = jobFamily && candFamilies.has(jobFamily);
  const relatedOverlap = [...jobRelated].some((r) => candCanonicalLike.has(r))
    || [...candRelated].some((r) => r === jobCanon || jobAliases.has(r));

  let score = 0;
  let note = "No functional overlap detected.";
  const matched: string[] = [];
  const transferable: string[] = [];

  if (exactCanonical) {
    score = 1.0;
    note = `Exact functional match: ${job.title?.canonical}.`;
    matched.push(job.title?.canonical ?? "");
  } else if (sameFamily) {
    score = 0.8;
    note = `Same function family (${jobFamily}) — different specialization.`;
    matched.push(jobFamily);
  } else if (relatedOverlap) {
    score = 0.45;
    note = `Adjacent function to ${job.title?.canonical ?? "the target role"}.`;
    transferable.push(job.title?.canonical ?? "");
  } else if (mandatorySkillScore >= 0.25) {
    score = 0.15;
    note = `Different function but transferable skills overlap.`;
    transferable.push("transferable skills");
  } else {
    score = 0;
  }

  return {
    weight,
    score_0_1: score,
    weighted: weight * score,
    matched,
    missing: score >= 0.8 ? [] : [job.title?.canonical ?? "Functional role match"],
    transferable,
    note,
  };
}



function scoreExperience(job: StructuredJobDescription, cand: StructuredCandidateProfile, weight: number): DimensionResult {
  const min = job.years_experience_min;
  const max = job.years_experience_max;
  const yrs = cand.years_experience ?? cand.career_progression?.total_years_experience ?? null;
  if (min == null) {
    return { weight, score_0_1: 1, weighted: weight, matched: [], missing: [], transferable: [], note: "No minimum experience specified." };
  }
  if (yrs == null) {
    return { weight, score_0_1: 0.4, weighted: weight * 0.4, matched: [], missing: ["Years of experience unclear"], transferable: [], note: "Candidate years of experience could not be determined." };
  }
  let s = 0, note = "";
  if (yrs >= min && (max == null || yrs <= max + 2)) { s = 1; note = `Meets the ${min}+ years requirement (${yrs} yrs).`; }
  else if (yrs >= min - 1) { s = 0.75; note = `Just below the ${min}-year mark (${yrs} yrs).`; }
  else if (yrs >= min - 2) { s = 0.5; note = `${min - yrs} years short of the requirement.`; }
  else { s = 0.2; note = `Significantly below the ${min}-year minimum (${yrs} yrs).`; }
  if (max != null && yrs > max + 4) { s = Math.min(s, 0.8); note += " May be over-experienced."; }
  return { weight, score_0_1: s, weighted: weight * s, matched: s >= 1 ? [`${yrs} yrs`] : [], missing: s < 1 ? [`${min}+ yrs`] : [], transferable: [], note };
}

function scoreLocation(job: StructuredJobDescription, cand: StructuredCandidateProfile, weight: number): DimensionResult {
  const jl = job.location, cl = cand.location;
  if (jl?.remote_preference === "remote") {
    return { weight, score_0_1: 1, weighted: weight, matched: ["Remote"], missing: [], transferable: [], note: "Role is remote." };
  }
  if (!jl?.country && !jl?.city) {
    return { weight, score_0_1: 0.8, weighted: weight * 0.8, matched: [], missing: [], transferable: [], note: "Job location not specified." };
  }
  const sameCity = jl.city && cl?.city && norm(jl.city) === norm(cl.city);
  const sameRegion = jl.region && cl?.region && norm(jl.region) === norm(cl.region);
  const sameCountry = jl.country && cl?.country && norm(jl.country) === norm(cl.country);
  let s = 0, note = "Location does not match.";
  if (sameCity) { s = 1; note = `Same city: ${jl.city}.`; }
  else if (sameRegion) { s = 0.85; note = `Same region: ${jl.region}.`; }
  else if (sameCountry) { s = 0.7; note = `Same country: ${jl.country}.`; }
  else if (cl?.willing_to_relocate) { s = 0.7; note = "Candidate is willing to relocate."; }
  else if (jl.remote_preference === "hybrid") { s = 0.5; note = "Hybrid role — partial location flexibility."; }
  return { weight, score_0_1: s, weighted: weight * s, matched: s >= 0.7 ? [jl.city ?? jl.country ?? ""] : [], missing: s < 0.7 ? [jl.city ?? jl.country ?? "location"] : [], transferable: [], note };
}

function scoreEducation(job: StructuredJobDescription, cand: StructuredCandidateProfile, weight: number): DimensionResult {
  const reqs = job.education_requirements ?? [];
  if (reqs.length === 0) {
    return { weight, score_0_1: 1, weighted: weight, matched: [], missing: [], transferable: [], note: "No formal education required." };
  }
  const levelRank: Record<string, number> = { high_school: 1, associate: 2, bachelor: 3, master: 4, mba: 4, phd: 5, other: 2 };
  const candMax = Math.max(0, ...cand.education.map((e) => (e.level ? (levelRank[e.level] ?? 0) : 0)));
  const reqMax = Math.max(0, ...reqs.map((e) => (e.level ? (levelRank[e.level] ?? 0) : 0)));
  if (reqMax === 0) {
    return { weight, score_0_1: 1, weighted: weight, matched: [], missing: [], transferable: [], note: "Education requirement level not specified." };
  }
  const s = candMax >= reqMax ? 1 : candMax === reqMax - 1 ? 0.7 : 0.3;
  return {
    weight, score_0_1: s, weighted: weight * s,
    matched: candMax >= reqMax ? cand.education.map((e) => e.degree ?? "").filter(Boolean) : [],
    missing: candMax < reqMax ? reqs.map((e) => e.degree ?? "").filter(Boolean) : [],
    transferable: [],
    note: candMax >= reqMax ? "Education requirement met." : "Education below the requested level.",
  };
}

function detectDealBreakers(job: StructuredJobDescription, cand: StructuredCandidateProfile): string[] {
  const triggered: string[] = [];
  // Hard certification requirements
  if (job.certifications_required?.length) {
    const candCerts = new Set(cand.certifications.flatMap((c) => [norm(c.name), ...(c.aliases ?? []).map(norm)]));
    for (const req of job.certifications_required) {
      const reqSet = new Set([norm(req.name), ...(req.aliases ?? []).map(norm)]);
      if (![...reqSet].some((t) => candCerts.has(t))) triggered.push(`Missing required certification: ${req.name}`);
    }
  }
  return triggered;
}

// ---------- main entry --------------------------------------------------

export function scoreStructured(
  job: StructuredJobDescription,
  cand: StructuredCandidateProfile,
  weights: ScoringWeights = DEFAULT_WEIGHTS,
  thresholds: TierThresholds = DEFAULT_THRESHOLDS,
): ValidationExplanation {
  const mand = scoreSkills(job.mandatory_skills, cand.skills, weights.mandatory_skills, "mandatory");
  // preferred skills slide into the title weight slot proportionally
  const pref = scoreSkills(job.preferred_skills, cand.skills, 0, "preferred");

  const role = scoreRoleSimilarity(job, cand, weights.role_similarity ?? 0, mand.dim.score_0_1);
  const industry = scoreIndustry(job, cand, weights.industry);
  const domain = scoreDomain(job, cand, weights.domain);
  const title = scoreTitle(job, cand, weights.title ?? 0);
  const experience = scoreExperience(job, cand, weights.experience);
  const location = scoreLocation(job, cand, weights.location);
  const education = scoreEducation(job, cand, weights.education);

  const dimensions: Record<string, DimensionResult> = {
    role_similarity: role,
    mandatory_skills: mand.dim,
    domain, experience, industry, location, education, title,
  };

  const titleW = weights.title ?? 0;
  const roleW = weights.role_similarity ?? 0;
  const totalWeight =
    roleW + weights.mandatory_skills + weights.industry + weights.domain +
    titleW + weights.experience + weights.location + weights.education;

  const rawWeighted =
    role.weighted + mand.dim.weighted + industry.weighted + domain.weighted +
    title.weighted + experience.weighted + location.weighted + education.weighted;

  let baseScore = totalWeight > 0 ? (rawWeighted / totalWeight) * 100 : 0;

  // Preferred-skills bonus: up to +5 if all matched, scaled.
  const prefBonus = job.preferred_skills.length ? pref.dim.score_0_1 * 5 : 0;
  baseScore = Math.min(100, baseScore + prefBonus);

  const dealBreakers = detectDealBreakers(job, cand);
  let penalty = 0;
  penalty += Math.min(50, dealBreakers.length * 25);

  // -------- role_first_v1 hard caps (function gate) ----------------------
  // Approved rules — wrong-function candidates must NEVER appear as
  // Recommended or Strong Match, regardless of industry pedigree.
  if (role.score_0_1 < 0.15) {
    baseScore = Math.min(baseScore, 55);
  } else if (role.score_0_1 < 0.45 && mand.dim.score_0_1 < 0.6) {
    baseScore = Math.min(baseScore, 65);
  }
  // Legacy mandatory-skill caps (still apply on top).
  if (mand.dim.score_0_1 < 0.5) baseScore = Math.min(baseScore, 70);
  if (mand.dim.score_0_1 < 0.25) baseScore = Math.min(baseScore, 50);

  const finalScore = Math.max(0, Math.round(baseScore - penalty));

  // -------- Tier --------------------------------------------------------
  // Strong Match requires: role_similarity ≥ 0.80 AND mandatory_skills ≥ 0.80
  // AND domain ≥ 0.60. Industry is no longer a gate.
  let tier: RecommendationTier;
  const strongOk =
    role.score_0_1 >= 0.8 &&
    mand.dim.score_0_1 >= 0.8 &&
    domain.score_0_1 >= 0.6;
  if (finalScore >= thresholds.strong && strongOk) tier = "strong_match";
  else if (finalScore >= thresholds.recommended && role.score_0_1 >= 0.45) tier = "recommended";
  else if (finalScore >= thresholds.transferable) tier = "transferable_match";
  else if (finalScore >= 40) tier = "needs_validation";
  else if (finalScore >= 25) tier = "weak_match";
  else tier = "reject";


  // Missing requirements aggregation
  const missing: string[] = [
    ...(role.score_0_1 < 0.8 ? [`Functional role: ${job.title?.canonical ?? "target role"}`] : []),
    ...mand.dim.missing.map((s) => `Mandatory skill: ${s}`),
    ...(industry.score_0_1 < 0.7 && job.industry?.canonical ? [`Industry: ${job.industry.canonical}`] : []),
    ...domain.missing.map((d) => `Domain: ${d}`),
    ...experience.missing.map((e) => `Experience: ${e}`),
    ...education.missing.map((e) => `Education: ${e}`),
    ...dealBreakers,
  ];

  const transferableConsiderations: string[] = [
    ...role.transferable.map((t) => `Functional adjacency to ${t}`),
    ...industry.transferable.map((i) => `Industry experience transferable from ${i}`),
    ...title.transferable.map((t) => `Related title experience for ${t}`),
  ];

  const summary = buildSummary(tier, finalScore, mand.dim, industry, role, dealBreakers);

  return {
    final_score: finalScore,
    recommendation_tier: tier,
    weights_profile: weights,
    thresholds,
    dimensions,
    mandatory_skills_matched: mand.matches,
    preferred_skills_matched: pref.matches,
    missing_requirements: missing,
    deal_breakers_triggered: dealBreakers,
    transferable_considerations: transferableConsiderations,
    penalty,
    summary,
  };
}

function buildSummary(
  tier: RecommendationTier, score: number,
  mand: DimensionResult, industry: DimensionResult, role: DimensionResult, dealBreakers: string[],
): string {
  const parts: string[] = [];
  const tierPhrase: Record<RecommendationTier, string> = {
    strong_match: "Strong match",
    recommended: "Recommended",
    transferable_match: "Transferable match",
    needs_validation: "Needs validation",
    weak_match: "Weak alignment",
    reject: "Limited alignment",
  };
  parts.push(`${tierPhrase[tier]} (${score}/100).`);
  if (role.score_0_1 >= 0.95) parts.push(`Exact functional match.`);
  else if (role.score_0_1 >= 0.75) parts.push(`Same function family — different specialization.`);
  else if (role.score_0_1 >= 0.4) parts.push(`Adjacent function with transferable experience.`);
  else parts.push(`Different functional discipline.`);
  if (mand.score_0_1 >= 0.9) parts.push(`Strong mandatory-skill coverage (${mand.matched.length}/${mand.matched.length + mand.missing.length}).`);
  else if (mand.score_0_1 >= 0.6) parts.push(`Most mandatory skills covered (${mand.matched.length}/${mand.matched.length + mand.missing.length}).`);
  else if (mand.missing.length) parts.push(`Gaps in mandatory skills: ${mand.missing.slice(0, 3).join(", ")}.`);
  if (industry.score_0_1 >= 0.95) parts.push(`Direct industry experience.`);
  else if (industry.score_0_1 >= 0.6) parts.push(`Adjacent / transferable industry background.`);
  if (dealBreakers.length) parts.push(`Deal-breaker(s): ${dealBreakers.slice(0, 2).join("; ")}.`);
  return parts.join(" ");
}

