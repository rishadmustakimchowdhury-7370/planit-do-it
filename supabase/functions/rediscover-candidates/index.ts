// AI Talent Match — recruiter-grade Discovery Engine (discovery_v1).
// Architecture:
//   Stage 1: Deterministic prefilter (cheap, fast) → narrows candidate pool.
//   Stage 2: OpenAI recruiter-grade re-ranker → classification, interview probability,
//            why-ranked evidence, functional ownership, ecosystem signals.
// Discovery ≠ Validation. Discovery = broad shortlist intelligence.

import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  DISCOVERY_ENGINE_VERSION,
  DISCOVERY_SYSTEM_PROMPT,
  CLASSIFICATION_RANK,
  detectEcosystemSignals,
  type DiscoveryClassification,
  type DetectedEcosystem,
} from "../_shared/discovery-engine.ts";

const MODEL_VERSION = "hybrid_v1+discovery_v1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;


// -------------------- NORMALIZATION --------------------

const ROLE_FAMILIES: Record<string, { keywords: string[]; adjacent: string[] }> = {
  qa: {
    keywords: ["qa", "quality assurance", "sdet", "test engineer", "automation tester", "tester", "qa automation", "test automation"],
    adjacent: ["devops", "backend"],
  },
  backend: {
    keywords: ["backend", "back-end", "back end", "server-side", "api developer", "java developer", "node developer", "python developer", ".net developer", "golang developer", "ruby developer"],
    adjacent: ["fullstack", "devops", "data"],
  },
  frontend: {
    keywords: ["frontend", "front-end", "front end", "react developer", "vue developer", "angular developer", "ui developer", "javascript developer", "web developer"],
    adjacent: ["fullstack", "mobile"],
  },
  fullstack: {
    keywords: ["fullstack", "full-stack", "full stack"],
    adjacent: ["backend", "frontend"],
  },
  mobile: {
    keywords: ["ios developer", "android developer", "mobile developer", "react native", "flutter developer"],
    adjacent: ["frontend"],
  },
  devops: {
    keywords: ["devops", "site reliability", "sre", "platform engineer", "infrastructure", "cloud engineer", "kubernetes"],
    adjacent: ["backend", "qa"],
  },
  data: {
    keywords: ["data engineer", "data scientist", "data analyst", "ml engineer", "machine learning", "analytics engineer"],
    adjacent: ["backend"],
  },
  product: {
    keywords: ["product manager", "product owner", "pm ", "technical pm"],
    adjacent: ["design"],
  },
  design: {
    keywords: ["designer", "ux", "ui designer", "product designer"],
    adjacent: ["frontend", "product"],
  },
  sales: {
    keywords: ["sales", "account executive", "business development", "sdr", "bdr"],
    adjacent: ["marketing"],
  },
  marketing: {
    keywords: ["marketing", "growth", "seo specialist", "content marketing", "demand generation"],
    adjacent: ["sales"],
  },
  hr: {
    keywords: ["recruiter", "talent acquisition", "human resources", "hr business partner", "people ops"],
    adjacent: [],
  },
  finance: {
    keywords: ["accountant", "finance manager", "controller", "financial analyst", "fp&a"],
    adjacent: [],
  },
  compliance: {
    keywords: [
      "compliance","compliance officer","compliance analyst","compliance specialist","regulatory",
      "regulatory affairs","aml","kyc","sanctions","anti-money laundering","financial crime",
      "trade compliance","trade surveillance","surveillance analyst","mlro","fcc","fincrime",
    ],
    adjacent: ["legal","risk_management"],
  },
  legal: {
    keywords: ["legal counsel","lawyer","solicitor","attorney","paralegal","contracts manager"],
    adjacent: ["compliance"],
  },
  risk_management: {
    keywords: ["risk manager","market risk","credit risk","operational risk","risk analyst","enterprise risk"],
    adjacent: ["compliance","finance"],
  },
  trade_support: {
    keywords: ["trade support","trade control","trade operations","middle office","back office","settlements"],
    adjacent: ["finance","risk_management"],
  },
  trading: {
    keywords: ["trader","trading desk","commodity trader","oil trader","gas trader","power trader"],
    adjacent: ["trade_support","risk_management"],
  },
  cyber_security: {
    keywords: ["security analyst","cyber security","cybersecurity","information security","soc analyst","infosec","penetration tester"],
    adjacent: ["devops","backend"],
  },
};

const SENIORITY_RANK: Record<string, number> = {
  intern: 0, junior: 1, "entry-level": 1, "entry level": 1, associate: 1,
  mid: 2, "mid-level": 2, "mid level": 2, intermediate: 2,
  senior: 3, sr: 3,
  lead: 4, staff: 4,
  principal: 5, architect: 5, head: 5, director: 5, vp: 6, "head of": 5,
};

// Skill aliases — canonical key → set of variants (lowercase)
const SKILL_ALIASES: Record<string, string[]> = {
  selenium: ["selenium", "webdriver", "selenium webdriver"],
  playwright: ["playwright"],
  cypress: ["cypress", "cypress.io"],
  appium: ["appium"],
  postman: ["postman"],
  "api testing": ["api testing", "rest assured", "restassured", "api automation"],
  "test automation": ["test automation", "automation testing", "qa automation"],
  java: ["java", "java 8", "java 11", "java 17"],
  javascript: ["javascript", "js", "es6"],
  typescript: ["typescript", "ts"],
  python: ["python", "py"],
  react: ["react", "react.js", "reactjs"],
  node: ["node", "node.js", "nodejs"],
  aws: ["aws", "amazon web services"],
  gcp: ["gcp", "google cloud", "google cloud platform"],
  azure: ["azure", "ms azure"],
  docker: ["docker", "containerization"],
  kubernetes: ["kubernetes", "k8s"],
  sql: ["sql", "mysql", "postgres", "postgresql"],
  graphql: ["graphql"],
};

function lower(s: unknown): string {
  return typeof s === "string" ? s.toLowerCase() : "";
}

function toArray(v: unknown): string[] {
  if (!v) return [];
  if (Array.isArray(v)) return v.filter(Boolean).map(String);
  if (typeof v === "string") return v.split(/[,;\n]/).map((x) => x.trim()).filter(Boolean);
  return [];
}

function normalizeSkill(skill: string): string {
  const s = lower(skill).trim();
  for (const [canon, variants] of Object.entries(SKILL_ALIASES)) {
    if (variants.some((v) => s === v || s.includes(v))) return canon;
  }
  return s;
}

function normalizeSkills(skills: unknown): Set<string> {
  return new Set(toArray(skills).map(normalizeSkill));
}

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
  for (const [label, rank] of Object.entries(SENIORITY_RANK)) {
    if (t.includes(label)) return rank;
  }
  // Fallback by years of experience
  if (typeof years === "number") {
    if (years < 2) return 1;
    if (years < 5) return 2;
    if (years < 8) return 3;
    if (years < 12) return 4;
    return 5;
  }
  return 2; // default mid
}

function extractRequiredYears(text: string): number | null {
  const m = lower(text).match(/(\d+)\s*\+?\s*(?:to\s*\d+\s*)?years?/);
  return m ? Number(m[1]) : null;
}

// -------------------- SCORING --------------------

interface SubScores {
  role: number;       // 0..1
  skills: number;     // 0..1
  industry: number;   // 0..1
  seniority: number;  // 0..1
  experience: number; // 0..1
  location: number;   // 0..1
  penalty: number;    // negative
}

function scoreRole(jobFamily: string | null, candFamily: string | null): number {
  if (!jobFamily) return 0.5;
  if (!candFamily) return 0.35;
  if (jobFamily === candFamily) return 1.0;
  const adj = ROLE_FAMILIES[jobFamily]?.adjacent ?? [];
  if (adj.includes(candFamily)) return 0.7; // adjacent = recruiter-recognized transferable
  return 0.15;
}

function scoreSkills(jobSkills: Set<string>, candSkills: Set<string>, adjacent: boolean): { score: number; matched: string[]; missing: string[] } {
  if (jobSkills.size === 0) return { score: 0.5, matched: [], missing: [] };
  const matched: string[] = [];
  const missing: string[] = [];
  for (const s of jobSkills) {
    if (candSkills.has(s)) matched.push(s); else missing.push(s);
  }
  let score = matched.length / jobSkills.size;
  // Recruiter-grade floor: an adjacent-family engineer shouldn't read as 0% skills.
  if (adjacent && score < 0.4) score = 0.4;
  return { score, matched, missing };
}

function scoreSeniority(jobRank: number, candRank: number): number {
  const diff = Math.abs(jobRank - candRank);
  if (diff === 0) return 1.0;
  if (diff === 1) return 0.6;
  if (diff === 2) return 0.2;
  return 0.0;
}

function scoreExperience(jobYears: number | null, candYears: number | null): number {
  if (jobYears == null) return 0.6;
  if (candYears == null) return 0.4;
  const diff = candYears - jobYears;
  if (diff >= 0 && diff <= 3) return 1.0;
  if (diff > 3 && diff <= 6) return 0.8;
  if (diff > 6) return 0.6;
  // Under-experienced
  if (diff === -1) return 0.6;
  if (diff === -2) return 0.3;
  return 0.0;
}

function scoreLocation(jobLoc: string, candLoc: string): number {
  if (!jobLoc) return 0.7;
  if (!candLoc) return 0.4;
  const j = lower(jobLoc), c = lower(candLoc);
  if (j === c) return 1.0;
  // share any token (city/country)
  const jt = j.split(/[,\s]+/).filter(Boolean);
  const ct = c.split(/[,\s]+/).filter(Boolean);
  if (jt.some((t) => ct.includes(t))) return 0.7;
  if (j.includes("remote") || c.includes("remote")) return 0.6;
  return 0.2;
}

function computeScore(job: any, cand: any): { final: number; confidence: "low" | "medium" | "high"; sub: SubScores; matched: string[]; missing: string[]; jobFamily: string | null; candFamily: string | null; jobRank: number; candRank: number; } {
  // Authoritative: prefer structured function_family when available. Fall back to keyword detection.
  const jobFamStructured: string | null =
    job?.structured_jd?.title?.function_family ?? null;
  const candFamStructured: string | null =
    cand?.structured_profile?.current_title?.function_family ?? null;

  const jobFamily = jobFamStructured ?? detectRoleFamily(job.title ?? "", job.description ?? "");
  const candFamily = candFamStructured ?? detectRoleFamily(cand.current_title ?? "", cand.summary ?? "");

  const jobSkills = normalizeSkills(job.skills);
  const candSkills = normalizeSkills(cand.skills);
  const adjEarly = !!(jobFamily && candFamily && jobFamily !== candFamily &&
    (ROLE_FAMILIES[jobFamily]?.adjacent ?? []).includes(candFamily));
  const sameFamily = !!(jobFamily && candFamily && jobFamily === candFamily);
  const skillRes = scoreSkills(jobSkills, candSkills, adjEarly || sameFamily);

  const jobRank = detectSeniority(`${job.title ?? ""} ${job.experience_level ?? ""}`, null);
  const candRank = detectSeniority(cand.current_title ?? "", cand.experience_years);

  const jobYears = extractRequiredYears(`${job.requirements ?? ""} ${job.description ?? ""}`);

  const sub: SubScores = {
    role: scoreRole(jobFamily, candFamily),
    skills: skillRes.score,
    industry: 0.5, // industry is a booster only; never dominates
    seniority: scoreSeniority(jobRank, candRank),
    experience: scoreExperience(jobYears, cand.experience_years ?? null),
    location: scoreLocation(job.location ?? "", cand.location ?? ""),
    penalty: 0,
  };

  // role_first_v1 weighting — Function dominates. Industry weight removed from base.
  let base =
    0.50 * sub.role +
    0.25 * sub.skills +
    0.10 * sub.seniority +
    0.10 * sub.experience +
    0.05 * sub.location;

  // Penalties — wrong function family is the dominant penalty.
  let penalty = 0;
  if (jobFamily && candFamily && jobFamily !== candFamily) {
    const adj = ROLE_FAMILIES[jobFamily]?.adjacent ?? [];
    if (!adj.includes(candFamily)) penalty += 0.35; // wrong function — strong demote
    else penalty += 0.10; // adjacent — mild demote
  }
  if (!adjEarly && !sameFamily && jobSkills.size > 0 && skillRes.matched.length / jobSkills.size < 0.3) penalty += 0.05;
  if (Math.abs(jobRank - candRank) >= 2) penalty += 0.10;
  sub.penalty = penalty;

  let final = Math.round(Math.max(0, base - penalty) * 100);

  // Function-first floor: same-family candidates must never score below 65 here so they
  // survive the rerank slice and reach Validator v2 as Primary candidates.
  if (sameFamily) final = Math.max(final, 65);
  if (final > 100) final = 100;

  // Confidence
  let confidence: "low" | "medium" | "high" = "low";
  const roleOk = !jobFamily || !candFamily || sub.role >= 0.5;
  const skillsOk = jobSkills.size === 0 || skillRes.score >= 0.6 || adjEarly || sameFamily;
  if (final >= 80 && roleOk && skillsOk) confidence = "high";
  else if (final >= 60 && roleOk) confidence = "medium";

  return { final, confidence, sub, matched: skillRes.matched, missing: skillRes.missing, jobFamily, candFamily, jobRank, candRank };
}


interface DiscoveryAIResult {
  candidate_id: string;
  discovery_classification: DiscoveryClassification;
  interview_probability: number;
  summary: string;
  why_ranked: string[];
  functional_ownership: string[];
  ecosystem_signals: { company: string; industry: string; tier: "tier1" | "tier2" }[];
  strengths: string[];
  gaps: string[];
}

async function rerankBatch(
  job: any,
  scored: Array<{ candidate: any; result: ReturnType<typeof computeScore>; detectedEcosystem: DetectedEcosystem[] }>,
): Promise<Record<string, DiscoveryAIResult>> {
  if (scored.length === 0) return {};

  // Build rich payload — the AI needs real evidence, not just titles.
  const payload = scored.map(({ candidate: c, result: r, detectedEcosystem }) => ({
    id: c.id,
    name: c.full_name,
    current_title: c.current_title,
    structured_function_family: c?.structured_profile?.current_title?.function_family ?? null,
    structured_canonical_title: c?.structured_profile?.current_title?.canonical ?? null,
    location: c.location,
    experience_years: c.experience_years,
    summary: (c.summary ?? "").slice(0, 1200),
    skills: toArray(c.skills).slice(0, 25),
    detected_ecosystem_employers: detectedEcosystem,
    deterministic_score: r.final,
    keyword_matched: r.matched.slice(0, 10),
    keyword_missing: r.missing.slice(0, 10),
    role_family: r.candFamily,
  }));

  const user = `JOB
Title: ${job.title}
Industry/Domain hint: ${job.description?.slice(0, 200) ?? ""}
Required skills: ${toArray(job.skills).slice(0, 15).join(", ")}
Seniority hint: ${job.experience_level ?? "unspecified"}
Location: ${job.location ?? "unspecified"}
Description (truncated):
${(job.description ?? "").slice(0, 2500)}

Detected job function family (authoritative): ${job?.structured_jd?.title?.function_family ?? detectRoleFamily(job.title ?? "", job.description ?? "")}
Job canonical title: ${job?.structured_jd?.title?.canonical ?? job.title ?? ""}
Mandatory skills (authoritative): ${(job?.structured_jd?.mandatory_skills ?? []).map((s: any) => s?.name).filter(Boolean).join(", ")}

FUNCTION-FIRST REMINDER: Industry/domain are RANKING BOOSTERS ONLY. Same/closely-related function family + skills + responsibilities = strong/recommended. Different function family = transferable at best, regardless of industry pedigree.

CANDIDATES (prefiltered by deterministic engine; YOU re-rank by recruiter realism):
${JSON.stringify(payload)}`;

  const tool = {
    type: "function",
    function: {
      name: "rerank_shortlist",
      description: "Return recruiter-grade discovery ranking for each candidate.",
      parameters: {
        type: "object",
        properties: {
          results: {
            type: "array",
            items: {
              type: "object",
              properties: {
                candidate_id: { type: "string" },
                discovery_classification: {
                  type: "string",
                  enum: ["strong_shortlist","recommended_shortlist","transferable_shortlist","adjacent_ecosystem","needs_validation","low_relevance"],
                },
                interview_probability: { type: "integer", minimum: 0, maximum: 100 },
                summary: { type: "string", description: "1-2 sentence recruiter summary, proportional tone, no score numbers." },
                why_ranked: { type: "array", items: { type: "string" }, maxItems: 4, description: "Evidence-backed recruiter-trust bullets." },
                functional_ownership: { type: "array", items: { type: "string" }, maxItems: 5 },
                ecosystem_signals: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      company: { type: "string" },
                      industry: { type: "string" },
                      tier: { type: "string", enum: ["tier1","tier2"] },
                    },
                    required: ["company","industry","tier"],
                  },
                },
                strengths: { type: "array", items: { type: "string" }, maxItems: 3 },
                gaps: { type: "array", items: { type: "string" }, maxItems: 3 },
              },
              required: ["candidate_id","discovery_classification","interview_probability","summary","why_ranked","functional_ownership","ecosystem_signals","strengths","gaps"],
            },
          },
        },
        required: ["results"],
      },
    },
  };

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.2,
      messages: [
        { role: "system", content: DISCOVERY_SYSTEM_PROMPT },
        { role: "user", content: user },
      ],
      tools: [tool],
      tool_choice: { type: "function", function: { name: "rerank_shortlist" } },
    }),
  });
  if (!resp.ok) {
    const txt = await resp.text();
    console.error("OpenAI rerank error:", resp.status, txt);
    if (resp.status === 429) throw new Error("RATE_LIMIT");
    if (resp.status === 402) throw new Error("CREDITS_EXHAUSTED");
    return {};
  }
  const data = await resp.json();
  const call = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!call) return {};
  try {
    const args = JSON.parse(call.function.arguments);
    const map: Record<string, DiscoveryAIResult> = {};
    for (const r of (args.results ?? [])) map[r.candidate_id] = r;
    return map;
  } catch (e) {
    console.error("Failed to parse rerank args:", e);
    return {};
  }
}


// -------------------- EMBEDDINGS (prefilter only) --------------------

async function embedJobIfMissing(supabase: any, jobId: string) {
  const { data: existing } = await supabase.from("job_embeddings").select("job_id").eq("job_id", jobId).maybeSingle();
  if (existing) return true;
  const resp = await fetch(`${SUPABASE_URL}/functions/v1/embed-job`, {
    method: "POST",
    headers: { Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ job_id: jobId }),
  });
  return resp.ok;
}

async function embedMissingCandidates(supabase: any, tenantId: string, limit = 200) {
  const { data: candidates } = await supabase
    .from("candidates").select("id").eq("tenant_id", tenantId)
    .order("updated_at", { ascending: false }).limit(2000);
  if (!candidates?.length) return 0;
  const ids = candidates.map((r: any) => r.id);
  const { data: existing } = await supabase.from("candidate_embeddings").select("candidate_id").in("candidate_id", ids);
  const embedded = new Set((existing ?? []).map((r: any) => r.candidate_id));
  const missing = candidates.filter((r: any) => !embedded.has(r.id)).slice(0, limit);
  let count = 0;
  // Embed in parallel batches of 8 for speed
  const batchSize = 8;
  for (let i = 0; i < missing.length; i += batchSize) {
    const batch = missing.slice(i, i + batchSize);
    const results = await Promise.allSettled(batch.map((row: any) =>
      fetch(`${SUPABASE_URL}/functions/v1/embed-candidate`, {
        method: "POST",
        headers: { Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ candidate_id: row.id }),
      })
    ));
    count += results.filter(r => r.status === "fulfilled" && (r.value as Response).ok).length;
  }
  return count;
}

// -------------------- HANDLER --------------------

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: userData } = await userClient.auth.getUser();
    const user = userData?.user;
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { job_id, force } = await req.json();
    if (!job_id) {
      return new Response(JSON.stringify({ error: "job_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    const rpcClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });

    const { data: profile } = await supabase.from("profiles").select("tenant_id").eq("id", user.id).maybeSingle();
    const callerTenant = profile?.tenant_id;
    const { data: job } = await supabase.from("jobs")
      .select("id, tenant_id, title, description, requirements, location, experience_level, skills, structured_jd")
      .eq("id", job_id).maybeSingle();

    if (!job) return new Response(JSON.stringify({ error: "Job not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (job.tenant_id !== callerTenant) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Cache: re-use if < 24h ago and not forced
    if (!force) {
      const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      const { data: recentRun } = await supabase.from("rediscovery_runs").select("id")
        .eq("job_id", job_id).eq("status", "success").gte("completed_at", since).limit(1).maybeSingle();
      if (recentRun) {
        return new Response(JSON.stringify({ ok: true, cached: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    const { data: run } = await supabase.from("rediscovery_runs").insert({
      job_id, tenant_id: job.tenant_id, triggered_by: user.id, status: "running",
    }).select("id").single();

    try {
      // 1. Embed prefilter — make sure the job is embedded and embed any missing candidates
      await embedJobIfMissing(supabase, job_id);
      const embedded = await embedMissingCandidates(supabase, job.tenant_id, 200);

      // 2. ANN prefilter — top 150 by semantic similarity.
      const { data: prefilter, error: matchErr } = await rpcClient.rpc("match_candidates_for_job", { p_job_id: job_id, p_match_count: 150 });
      if (matchErr) throw matchErr;

      const prefilterIds: string[] = (prefilter ?? []).map((m: any) => m.candidate_id);

      // 2b. RECALL BOOSTER (role_first_v1 fix).
      // Embedding ANN often misses direct functional matches whose CVs use
      // adjacent vocabulary (e.g. Compliance Officer vs Compliance Analyst).
      // Pull the job's structured_jd to grab its function_family + title
      // tokens, then union in any tenant candidate whose structured_profile
      // shares the same family OR whose current_title contains a key token.
      const recallIds = new Set<string>(prefilterIds);
      try {
        const { data: jobStructured } = await supabase
          .from("jobs").select("structured_jd").eq("id", job_id).maybeSingle();
        const sjd: any = jobStructured?.structured_jd ?? null;
        const family: string | null = sjd?.title?.function_family ?? null;
        const titleTokens: string[] = [];
        const pushTok = (s: any) => {
          if (typeof s !== "string") return;
          for (const t of s.toLowerCase().split(/[^a-z0-9+#]+/).filter(Boolean)) {
            if (t.length >= 4 && !["and","with","the","for","role","team","work","year","years","senior","junior","lead","analyst","manager","officer","specialist","engineer","developer","associate"].includes(t)) {
              titleTokens.push(t);
            }
          }
        };
        pushTok(sjd?.title?.canonical);
        for (const a of sjd?.title?.aliases ?? []) pushTok(a);
        for (const r of sjd?.title?.related ?? []) pushTok(r);
        pushTok(job.title);
        const uniqTokens = [...new Set(titleTokens)].slice(0, 8);

        // Same function_family candidates
        if (family) {
          const { data: famRows } = await supabase
            .from("candidates")
            .select("id")
            .eq("tenant_id", job.tenant_id)
            .filter("structured_profile->current_title->>function_family", "eq", family)
            .limit(80);
          for (const r of famRows ?? []) recallIds.add(r.id);
        }
        // Title-token candidates (catches unstructured profiles too)
        if (uniqTokens.length) {
          const orExpr = uniqTokens.map((t) => `current_title.ilike.%${t}%`).join(",");
          const { data: titleRows } = await supabase
            .from("candidates")
            .select("id")
            .eq("tenant_id", job.tenant_id)
            .or(orExpr)
            .limit(80);
          for (const r of titleRows ?? []) recallIds.add(r.id);
        }
      } catch (e) {
        console.warn("recall booster failed (non-fatal)", e);
      }

      const scanned = recallIds.size;

      // 3. Exclude candidates already in pipeline
      const { data: existingJC } = await supabase.from("job_candidates").select("candidate_id").eq("job_id", job_id);
      const exclude = new Set((existingJC ?? []).map((x: any) => x.candidate_id));
      const eligibleIds = [...recallIds].filter((id: string) => !exclude.has(id));

      if (eligibleIds.length === 0) {
        await supabase.from("rediscovery_runs").update({
          status: "success", candidates_scanned: scanned, matches_found: 0, completed_at: new Date().toISOString(),
        }).eq("id", run.id);
        return new Response(JSON.stringify({ ok: true, matches: 0, embedded, scanned }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // 4. Load full profiles (including structured_profile for downstream validator + family boost).
      const { data: candidates } = await supabase.from("candidates")
        .select("id, full_name, current_title, location, experience_years, skills, summary, updated_at, structured_profile")
        .in("id", eligibleIds);

      // 5. STAGE 1: Deterministic prefilter + ecosystem signal detection.
      const similarityMap = new Map((prefilter ?? []).map((m: any) => [m.candidate_id, Number(m.similarity ?? 0)]));
      const scored = (candidates ?? []).map((c: any) => {
        const result = computeScore(job, c);
        const sim = similarityMap.get(c.id) ?? 0;
        const blended = Math.min(100, Math.round(result.final * 0.9 + sim * 100 * 0.1));
        const cvHaystack = [c.current_title, c.summary, JSON.stringify(c.skills ?? [])].join(" ");
        const detectedEcosystem = detectEcosystemSignals(cvHaystack);
        return { candidate: c, result: { ...result, final: blended }, detectedEcosystem };
      });

      // 6. Cast a WIDER prefilter net for the AI re-ranker — recruiters care about
      // ecosystem-relevant profiles even when keyword score is thin. The AI will
      // demote noise via discovery_classification="low_relevance".
      // role_first_v1 recall fix: ALSO admit candidates whose structured_profile
      // function_family matches the job's structured family, even if the legacy
      // keyword score is weak. The validator v2 will then do the final ranking.
      const jobFamilyStructured: string | null =
        ((candidates ?? [])[0] as any)?.structured_profile?.current_title?.function_family ?? null;
      // Re-pull job structured to know its family without re-querying.
      let jobFunctionFamily: string | null = null;
      try {
        const { data: jr } = await supabase.from("jobs").select("structured_jd").eq("id", job_id).maybeSingle();
        jobFunctionFamily = (jr?.structured_jd as any)?.title?.function_family ?? null;
      } catch (_) { /* non-fatal */ }

      const candFamOf = (s: typeof scored[number]) =>
        (s.candidate as any)?.structured_profile?.current_title?.function_family ?? null;
      const isSameFamily = (s: typeof scored[number]) =>
        !!(jobFunctionFamily && candFamOf(s) && candFamOf(s) === jobFunctionFamily);

      const sorted = scored.sort((a, b) => b.result.final - a.result.final);
      const prefilterPool = sorted.filter((s) => {
        if (s.detectedEcosystem.some((e) => e.tier === "tier1")) return true;
        // Same function family always passes recall (high-recall first, then validator ranks)
        if (isSameFamily(s)) return true;
        if (!s.result.jobFamily) return s.result.final >= 30;
        return s.result.final >= 35;
      });

      // 7. STAGE 2: OpenAI recruiter re-ranker (cap at 30 to keep recall high).
      // CRITICAL: pin same-function-family candidates to the front of the slice.
      // The legacy keyword engine under-scores roles like Compliance / Legal whose
      // skills aren't in SKILL_ALIASES, so without this they get cut by slice(0,30)
      // and never reach Validator v2 — producing Primary Matches = 0 for those roles.
      const familyMatches = prefilterPool.filter(isSameFamily);
      const others = prefilterPool.filter((s) => !isSameFamily(s));
      const orderedForRerank = [...familyMatches, ...others];

      let aiMap: Record<string, DiscoveryAIResult> = {};
      const rerankInput = orderedForRerank.slice(0, 30);
      if (rerankInput.length > 0) {
        try {
          aiMap = await rerankBatch(job, rerankInput);
        } catch (e: any) {
          if (e?.message === "RATE_LIMIT" || e?.message === "CREDITS_EXHAUSTED") {
            await supabase.from("rediscovery_runs").update({ status: "failed", error: e.message, completed_at: new Date().toISOString() }).eq("id", run.id);
            return new Response(JSON.stringify({ error: e.message }), { status: e.message === "RATE_LIMIT" ? 429 : 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }
          console.error("Rerank failure (continuing with deterministic only):", e);
        }
      }

      // 8. Build rows — DROP low_relevance entries (recruiter would not surface them).
      const { data: recentEmails } = await supabase.from("candidate_emails")
        .select("candidate_id").in("candidate_id", rerankInput.map((s) => s.candidate.id));
      const contacted = new Set((recentEmails ?? []).map((r: any) => r.candidate_id));

      const rows = rerankInput
        .map(({ candidate: c, result: r, detectedEcosystem }) => {
          const ai = aiMap[c.id];
          // No AI verdict → fallback to "needs_validation" so we surface but flag.
          const cls: DiscoveryClassification = ai?.discovery_classification ?? "needs_validation";
          if (cls === "low_relevance") return null;

          const insights: string[] = [];
          if (c.updated_at && Date.now() - new Date(c.updated_at).getTime() < 30 * 86400 * 1000) insights.push("Recently active");
          if (contacted.has(c.id)) insights.push("Previously contacted");
          if (detectedEcosystem.some((e) => e.tier === "tier1")) insights.push("Tier-1 ecosystem employer");

          return {
            job_id,
            candidate_id: c.id,
            tenant_id: job.tenant_id,
            match_score: r.final,
            semantic_score: similarityMap.get(c.id) ?? null,
            ai_score: ai?.interview_probability ?? r.final,
            ai_summary: ai?.summary ?? null,
            strengths: ai?.strengths ?? [],
            gaps: ai?.gaps ?? [],
            confidence: r.confidence,
            insights,
            discovery_classification: cls,
            interview_probability: ai?.interview_probability ?? null,
            ecosystem_signals: (ai?.ecosystem_signals?.length ? ai.ecosystem_signals : detectedEcosystem),
            why_ranked: ai?.why_ranked ?? [],
            functional_ownership: ai?.functional_ownership ?? [],
            dismissed: false,
            sub_scores: {
              role: r.sub.role, skills: r.sub.skills, industry: r.sub.industry,
              seniority: r.sub.seniority, experience: r.sub.experience, location: r.sub.location,
              penalty: r.sub.penalty, job_family: r.jobFamily, candidate_family: r.candFamily,
            },
            model_version: MODEL_VERSION,
            updated_at: new Date().toISOString(),
          };
        })
        .filter((r): r is NonNullable<typeof r> => r !== null)
        // Final ordering: by AI classification rank, then interview probability, then deterministic score.
        .sort((a, b) => {
          const ra = CLASSIFICATION_RANK[a.discovery_classification as DiscoveryClassification] ?? 0;
          const rb = CLASSIFICATION_RANK[b.discovery_classification as DiscoveryClassification] ?? 0;
          if (ra !== rb) return rb - ra;
          const pa = a.interview_probability ?? a.match_score;
          const pb = b.interview_probability ?? b.match_score;
          return pb - pa;
        });


      // 9. Replace prior matches for this job (so removed candidates disappear)
      await supabase.from("rediscovered_matches").delete().eq("job_id", job_id).eq("dismissed", false);
      if (rows.length) {
        const { error: upErr } = await supabase.from("rediscovered_matches").upsert(rows, { onConflict: "job_id,candidate_id" });
        if (upErr) throw upErr;
      }

      // 9b. Validator v2 fan-out — enqueue top-N for asynchronous validation.
      // The process-validation-queue worker (cron) drains these and writes
      // final_score / recommendation_tier back through the single authority.
      let enqueuedForValidation = 0;
      try {
        const TOP_N = 25;
        const top = rows.slice(0, TOP_N);
        if (top.length) {
          const ids = top.map((r) => r.candidate_id);
          const { data: existing } = await supabase
            .from("validation_queue")
            .select("candidate_id")
            .eq("job_id", job_id)
            .in("candidate_id", ids)
            .in("status", ["pending", "in_progress"]);
          const skip = new Set((existing ?? []).map((e: any) => e.candidate_id));
          const toInsert = top
            .filter((r) => !skip.has(r.candidate_id))
            .map((r) => ({
              tenant_id: r.tenant_id, job_id: r.job_id, candidate_id: r.candidate_id,
              status: "pending", priority: 10,
            }));
          if (toInsert.length) {
            const { error: qErr } = await supabase.from("validation_queue").insert(toInsert);
            if (qErr) console.warn("validation_queue enqueue failed", qErr);
            else enqueuedForValidation = toInsert.length;
          }
        }
      } catch (e) {
        console.warn("fan-out enqueue failed (non-fatal)", e);
      }


      await supabase.from("rediscovery_runs").update({
        status: "success", candidates_scanned: scanned, matches_found: rows.length, completed_at: new Date().toISOString(),
      }).eq("id", run.id);

      return new Response(JSON.stringify({ ok: true, matches: rows.length, embedded, scanned, model_version: MODEL_VERSION, enqueued_for_validation: enqueuedForValidation }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } catch (innerErr: any) {
      console.error("ai-talent-match inner error:", innerErr);
      await supabase.from("rediscovery_runs").update({
        status: "failed", error: innerErr?.message ?? "unknown", completed_at: new Date().toISOString(),
      }).eq("id", run.id);
      throw innerErr;
    }
  } catch (e: any) {
    console.error("ai-talent-match error:", e);
    return new Response(JSON.stringify({ error: e?.message ?? "unknown" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
