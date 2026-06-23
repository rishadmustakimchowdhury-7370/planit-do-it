// Centralized deterministic match scoring (hybrid_v1).
// This is the single source of truth used by both rediscover-candidates (AI Talent Match)
// and validate-candidate-fit (Submission/Validation), so the same candidate-job pair
// always produces the same score everywhere in the app.

export const MODEL_VERSION = "hybrid_v1";

const ROLE_FAMILIES: Record<string, { keywords: string[]; adjacent: string[] }> = {
  qa: { keywords: ["qa", "quality assurance", "sdet", "test engineer", "automation tester", "tester", "qa automation", "test automation"], adjacent: ["devops", "backend"] },
  backend: { keywords: ["backend", "back-end", "back end", "server-side", "api developer", "java developer", "node developer", "python developer", ".net developer", "golang developer", "ruby developer"], adjacent: ["fullstack", "devops", "data"] },
  frontend: { keywords: ["frontend", "front-end", "front end", "react developer", "vue developer", "angular developer", "ui developer", "javascript developer", "web developer"], adjacent: ["fullstack", "mobile"] },
  fullstack: { keywords: ["fullstack", "full-stack", "full stack"], adjacent: ["backend", "frontend"] },
  mobile: { keywords: ["ios developer", "android developer", "mobile developer", "react native", "flutter developer"], adjacent: ["frontend"] },
  devops: { keywords: ["devops", "site reliability", "sre", "platform engineer", "infrastructure", "cloud engineer", "kubernetes"], adjacent: ["backend", "qa"] },
  data: { keywords: ["data engineer", "data scientist", "data analyst", "ml engineer", "machine learning", "analytics engineer"], adjacent: ["backend"] },
  product: { keywords: ["product manager", "product owner", "pm ", "technical pm"], adjacent: ["design"] },
  design: { keywords: ["designer", "ux", "ui designer", "product designer"], adjacent: ["frontend", "product"] },
  sales: { keywords: ["sales", "account executive", "business development", "sdr", "bdr"], adjacent: ["marketing"] },
  marketing: { keywords: ["marketing", "growth", "seo specialist", "content marketing", "demand generation"], adjacent: ["sales"] },
  hr: { keywords: ["recruiter", "talent acquisition", "human resources", "hr business partner", "people ops"], adjacent: [] },
  finance: { keywords: ["accountant", "finance manager", "controller", "financial analyst", "fp&a"], adjacent: [] },
};

const SENIORITY_RANK: Record<string, number> = {
  intern: 0, junior: 1, "entry-level": 1, "entry level": 1, associate: 1,
  mid: 2, "mid-level": 2, "mid level": 2, intermediate: 2,
  senior: 3, sr: 3, lead: 4, staff: 4,
  principal: 5, architect: 5, head: 5, director: 5, vp: 6, "head of": 5,
};

const SKILL_ALIASES: Record<string, string[]> = {
  selenium: ["selenium", "webdriver", "selenium webdriver"],
  playwright: ["playwright"], cypress: ["cypress", "cypress.io"], appium: ["appium"], postman: ["postman"],
  "api testing": ["api testing", "rest assured", "restassured", "api automation"],
  "test automation": ["test automation", "automation testing", "qa automation"],
  java: ["java", "java 8", "java 11", "java 17"], javascript: ["javascript", "js", "es6"],
  typescript: ["typescript", "ts"], python: ["python", "py"],
  react: ["react", "react.js", "reactjs"], node: ["node", "node.js", "nodejs"],
  aws: ["aws", "amazon web services"], gcp: ["gcp", "google cloud", "google cloud platform"],
  azure: ["azure", "ms azure"], docker: ["docker", "containerization"],
  kubernetes: ["kubernetes", "k8s"], sql: ["sql", "mysql", "postgres", "postgresql"], graphql: ["graphql"],
};

function lower(s: unknown): string { return typeof s === "string" ? s.toLowerCase() : ""; }
function toArray(v: unknown): string[] {
  if (!v) return [];
  if (Array.isArray(v)) return v.filter(Boolean).map(String);
  if (typeof v === "string") return v.split(/[,;\n]/).map((x) => x.trim()).filter(Boolean);
  return [];
}
function normalizeSkill(s: string): string {
  const x = lower(s).trim();
  for (const [canon, variants] of Object.entries(SKILL_ALIASES)) if (variants.some((v) => x === v || x.includes(v))) return canon;
  return x;
}
function normalizeSkills(skills: unknown): Set<string> { return new Set(toArray(skills).map(normalizeSkill)); }
function detectRoleFamily(title: string, description: string): string | null {
  const hay = `${lower(title)} ${lower(description)}`;
  let best: { family: string; hits: number } | null = null;
  for (const [family, def] of Object.entries(ROLE_FAMILIES)) {
    let hits = 0;
    for (const kw of def.keywords) if (hay.includes(kw)) hits++;
    if (hits > 0 && (!best || hits > best.hits)) best = { family, hits };
  }
  return best?.family ?? null;
}
function detectSeniority(text: string, years?: number | null): number {
  const t = lower(text);
  for (const [label, rank] of Object.entries(SENIORITY_RANK)) if (t.includes(label)) return rank;
  if (typeof years === "number") {
    if (years < 2) return 1; if (years < 5) return 2; if (years < 8) return 3; if (years < 12) return 4; return 5;
  }
  return 2;
}
function extractRequiredYears(text: string): number | null {
  const m = lower(text).match(/(\d+)\s*\+?\s*(?:to\s*\d+\s*)?years?/);
  return m ? Number(m[1]) : null;
}

export interface SubScores {
  role: number; skills: number; industry: number; seniority: number; experience: number; location: number; penalty: number;
}

export interface MatchResult {
  final: number;
  confidence: "low" | "medium" | "high";
  recommendation: "strongly_recommended" | "recommended" | "moderate_match" | "low_match";
  sub: SubScores;
  matched: string[];
  missing: string[];
  jobFamily: string | null;
  candFamily: string | null;
  jobRank: number;
  candRank: number;
  model_version: string;
}

function recommendationFromScore(s: number): MatchResult["recommendation"] {
  if (s >= 90) return "strongly_recommended";
  if (s >= 75) return "recommended";
  if (s >= 60) return "moderate_match";
  return "low_match";
}

export function computeMatchScore(job: any, cand: any): MatchResult {
  const jobFamily = detectRoleFamily(job.title ?? "", job.description ?? "");
  const candFamily = detectRoleFamily(cand.current_title ?? "", cand.summary ?? "");
  const jobSkills = normalizeSkills(job.skills);
  const candSkills = normalizeSkills(cand.skills);

  const adjacent = !!(jobFamily && candFamily && jobFamily !== candFamily &&
    (ROLE_FAMILIES[jobFamily]?.adjacent ?? []).includes(candFamily));
  const sameFamily = !!(jobFamily && candFamily && jobFamily === candFamily);

  let skillScore = 0.5; const matched: string[] = []; const missing: string[] = [];
  if (jobSkills.size > 0) {
    for (const s of jobSkills) (candSkills.has(s) ? matched : missing).push(s);
    skillScore = matched.length / jobSkills.size;
    if ((adjacent || sameFamily) && skillScore < 0.4) skillScore = 0.4; // transferable floor
  }

  const jobRank = detectSeniority(`${job.title ?? ""} ${job.experience_level ?? ""}`, null);
  const candRank = detectSeniority(cand.current_title ?? "", cand.experience_years);
  const jobYears = extractRequiredYears(`${job.requirements ?? ""} ${job.description ?? ""}`);

  const roleScore = !jobFamily ? 0.5 : !candFamily ? 0.35
    : jobFamily === candFamily ? 1.0
    : adjacent ? 0.7 : 0.15;

  const seniorDiff = Math.abs(jobRank - candRank);
  const seniorityScore = seniorDiff === 0 ? 1 : seniorDiff === 1 ? 0.6 : seniorDiff === 2 ? 0.2 : 0;

  let experienceScore = 0.6;
  if (jobYears != null && cand.experience_years != null) {
    const d = cand.experience_years - jobYears;
    experienceScore = d >= 0 && d <= 3 ? 1 : d > 3 && d <= 6 ? 0.8 : d > 6 ? 0.6 : d === -1 ? 0.6 : d === -2 ? 0.3 : 0;
  } else if (jobYears != null) experienceScore = 0.4;

  let locationScore = 0.7;
  const jl = lower(job.location ?? ""), cl = lower(cand.location ?? "");
  if (jl && cl) {
    if (jl === cl) locationScore = 1.0;
    else {
      const jt = jl.split(/[,\s]+/).filter(Boolean), ct = cl.split(/[,\s]+/).filter(Boolean);
      locationScore = jt.some((t) => ct.includes(t)) ? 0.7 : (jl.includes("remote") || cl.includes("remote")) ? 0.6 : 0.2;
    }
  } else if (jl && !cl) locationScore = 0.4;

  const sub: SubScores = { role: roleScore, skills: skillScore, industry: 0.5, seniority: seniorityScore, experience: experienceScore, location: locationScore, penalty: 0 };
  // Weights per AI Recruitment Agent spec: Role 40 / Skills 30 / Function (seniority+experience) 15 / Location 10 / Industry 5.
  // Industry is the lowest signal and must never eliminate a strong candidate.
  const functionScore = 0.6 * sub.seniority + 0.4 * sub.experience;
  const base = 0.40 * sub.role + 0.30 * sub.skills + 0.15 * functionScore + 0.10 * sub.location + 0.05 * sub.industry;

  let penalty = 0;
  if (jobFamily && candFamily && jobFamily !== candFamily && !adjacent) penalty += 0.25;
  if (!adjacent && !sameFamily && jobSkills.size > 0 && matched.length / jobSkills.size < 0.3) penalty += 0.10;
  if (Math.abs(jobRank - candRank) >= 2) penalty += 0.15;
  sub.penalty = penalty;

  let final = Math.min(100, Math.round(Math.max(0, base - penalty) * 100));

  let confidence: "low" | "medium" | "high" = "low";
  const roleOk = !jobFamily || !candFamily || sub.role >= 0.5;
  const skillsOk = jobSkills.size === 0 || skillScore >= 0.6 || adjacent || sameFamily;
  if (final >= 80 && roleOk && skillsOk) confidence = "high";
  else if (final >= 60 && roleOk) confidence = "medium";

  return {
    final, confidence, recommendation: recommendationFromScore(final),
    sub, matched, missing, jobFamily, candFamily, jobRank, candRank,
    model_version: MODEL_VERSION,
  };
}
