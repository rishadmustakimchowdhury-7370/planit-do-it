// AI Talent Match — unified scoring engine (hybrid_v1)
// Deterministic hybrid score = role(40) + skills(25) + industry(10) + seniority(10) + experience(10) + location(5) − penalties
// AI (gpt-4o-mini) is used ONLY for natural-language explanations, never to alter the score.
// This guarantees the same candidate shows the same score everywhere in the app.

import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const MODEL_VERSION = "hybrid_v1";

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
  if (!candFamily) return 0.2;
  if (jobFamily === candFamily) return 1.0;
  const adj = ROLE_FAMILIES[jobFamily]?.adjacent ?? [];
  if (adj.includes(candFamily)) return 0.5;
  return 0.1;
}

function scoreSkills(jobSkills: Set<string>, candSkills: Set<string>): { score: number; matched: string[]; missing: string[] } {
  if (jobSkills.size === 0) return { score: 0.5, matched: [], missing: [] };
  const matched: string[] = [];
  const missing: string[] = [];
  for (const s of jobSkills) {
    if (candSkills.has(s)) matched.push(s); else missing.push(s);
  }
  const score = matched.length / jobSkills.size;
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
  const jobFamily = detectRoleFamily(job.title ?? "", job.description ?? "");
  const candFamily = detectRoleFamily(cand.current_title ?? "", cand.summary ?? "");

  const jobSkills = normalizeSkills(job.skills);
  const candSkills = normalizeSkills(cand.skills);
  const skillRes = scoreSkills(jobSkills, candSkills);

  const jobRank = detectSeniority(`${job.title ?? ""} ${job.experience_level ?? ""}`, null);
  const candRank = detectSeniority(cand.current_title ?? "", cand.experience_years);

  const jobYears = extractRequiredYears(`${job.requirements ?? ""} ${job.description ?? ""}`);

  const sub: SubScores = {
    role: scoreRole(jobFamily, candFamily),
    skills: skillRes.score,
    industry: 0.5, // no structured industry field yet — neutral
    seniority: scoreSeniority(jobRank, candRank),
    experience: scoreExperience(jobYears, cand.experience_years ?? null),
    location: scoreLocation(job.location ?? "", cand.location ?? ""),
    penalty: 0,
  };

  let base =
    0.40 * sub.role +
    0.25 * sub.skills +
    0.10 * sub.industry +
    0.10 * sub.seniority +
    0.10 * sub.experience +
    0.05 * sub.location;

  // Penalties
  let penalty = 0;
  if (jobFamily && candFamily && jobFamily !== candFamily) {
    const adj = ROLE_FAMILIES[jobFamily]?.adjacent ?? [];
    if (!adj.includes(candFamily)) penalty += 0.25; // wrong role family
  }
  if (jobSkills.size > 0 && skillRes.matched.length / jobSkills.size < 0.5) penalty += 0.15;
  if (Math.abs(jobRank - candRank) >= 2) penalty += 0.15;
  sub.penalty = penalty;

  let final = Math.round(Math.max(0, base - penalty) * 100);
  if (final > 100) final = 100;

  // Confidence
  let confidence: "low" | "medium" | "high" = "low";
  const roleOk = !jobFamily || !candFamily || sub.role >= 0.5;
  const skillsOk = jobSkills.size === 0 || skillRes.score >= 0.7;
  if (final >= 80 && roleOk && skillsOk) confidence = "high";
  else if (final >= 65) confidence = "medium";

  return { final, confidence, sub, matched: skillRes.matched, missing: skillRes.missing, jobFamily, candFamily, jobRank, candRank };
}

// -------------------- AI EXPLANATIONS (no score) --------------------

async function explainBatch(job: any, scored: Array<{ candidate: any; result: ReturnType<typeof computeScore> }>): Promise<Record<string, { strengths: string[]; gaps: string[]; summary: string }>> {
  if (scored.length === 0) return {};
  const payload = scored.map(({ candidate: c, result: r }) => ({
    id: c.id,
    name: c.full_name,
    title: c.current_title,
    score: r.final,
    matched_skills: r.matched.slice(0, 8),
    missing_skills: r.missing.slice(0, 8),
    role_family: r.candFamily,
    job_family: r.jobFamily,
    experience_years: c.experience_years,
  }));

  const system = `You write short, recruiter-facing match explanations. Be specific and honest. DO NOT change or quote the score. Return ONLY through the provided tool.`;
  const user = `JOB: ${job.title}\nRequired skills: ${toArray(job.skills).slice(0, 12).join(", ")}\nJob family: ${detectRoleFamily(job.title ?? "", job.description ?? "")}\n\nCANDIDATES (with their deterministic scores):\n${JSON.stringify(payload)}`;

  const tool = {
    type: "function",
    function: {
      name: "write_explanations",
      parameters: {
        type: "object",
        properties: {
          results: {
            type: "array",
            items: {
              type: "object",
              properties: {
                candidate_id: { type: "string" },
                summary: { type: "string", description: "1-2 sentence recruiter-facing summary, no score numbers" },
                strengths: { type: "array", items: { type: "string" }, maxItems: 3 },
                gaps: { type: "array", items: { type: "string" }, maxItems: 3 },
              },
              required: ["candidate_id", "summary", "strengths", "gaps"],
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
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
      tools: [tool],
      tool_choice: { type: "function", function: { name: "write_explanations" } },
    }),
  });
  if (!resp.ok) {
    const txt = await resp.text();
    console.error("OpenAI explain error:", resp.status, txt);
    if (resp.status === 429) throw new Error("RATE_LIMIT");
    if (resp.status === 402) throw new Error("CREDITS_EXHAUSTED");
    return {};
  }
  const data = await resp.json();
  const call = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!call) return {};
  try {
    const args = JSON.parse(call.function.arguments);
    const map: Record<string, any> = {};
    for (const r of (args.results ?? [])) map[r.candidate_id] = r;
    return map;
  } catch (e) {
    console.error("Failed to parse explain args:", e);
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

async function embedMissingCandidates(supabase: any, tenantId: string, limit = 30) {
  const { data: candidates } = await supabase
    .from("candidates").select("id").eq("tenant_id", tenantId)
    .order("updated_at", { ascending: false }).limit(limit * 2);
  if (!candidates?.length) return 0;
  const ids = candidates.map((r: any) => r.id);
  const { data: existing } = await supabase.from("candidate_embeddings").select("candidate_id").in("candidate_id", ids);
  const embedded = new Set((existing ?? []).map((r: any) => r.candidate_id));
  const missing = candidates.filter((r: any) => !embedded.has(r.id)).slice(0, limit);
  let count = 0;
  for (const row of missing) {
    try {
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/embed-candidate`, {
        method: "POST",
        headers: { Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ candidate_id: row.id }),
      });
      if (resp.ok) count++;
    } catch (_) { /* continue */ }
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
      .select("id, tenant_id, title, description, requirements, location, experience_level, skills")
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
      // 1. Embed prefilter
      await embedJobIfMissing(supabase, job_id);
      const embedded = await embedMissingCandidates(supabase, job.tenant_id, 25);

      // 2. ANN prefilter — top 50 by semantic similarity
      const { data: prefilter, error: matchErr } = await rpcClient.rpc("match_candidates_for_job", { p_job_id: job_id, p_match_count: 50 });
      if (matchErr) throw matchErr;

      const prefilterIds = (prefilter ?? []).map((m: any) => m.candidate_id);
      const scanned = prefilterIds.length;

      // 3. Exclude candidates already in pipeline
      const { data: existingJC } = await supabase.from("job_candidates").select("candidate_id").eq("job_id", job_id);
      const exclude = new Set((existingJC ?? []).map((x: any) => x.candidate_id));
      const eligibleIds = prefilterIds.filter((id: string) => !exclude.has(id));

      if (eligibleIds.length === 0) {
        await supabase.from("rediscovery_runs").update({
          status: "success", candidates_scanned: scanned, matches_found: 0, completed_at: new Date().toISOString(),
        }).eq("id", run.id);
        return new Response(JSON.stringify({ ok: true, matches: 0, embedded, scanned }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // 4. Load full profiles
      const { data: candidates } = await supabase.from("candidates")
        .select("id, full_name, current_title, location, experience_years, skills, summary, updated_at")
        .in("id", eligibleIds);

      // 5. Deterministic hybrid scoring
      const scored = (candidates ?? []).map((c: any) => ({ candidate: c, result: computeScore(job, c) }));

      // 6. Quality threshold — only persist medium/high (≥65). Quality > quantity.
      const qualified = scored.filter((s) => s.result.final >= 65).sort((a, b) => b.result.final - a.result.final);

      // 7. AI explanations for the qualified set (cap at 15 to control cost)
      let explainMap: Record<string, { strengths: string[]; gaps: string[]; summary: string }> = {};
      if (qualified.length > 0) {
        try {
          explainMap = await explainBatch(job, qualified.slice(0, 15));
        } catch (e: any) {
          if (e?.message === "RATE_LIMIT" || e?.message === "CREDITS_EXHAUSTED") {
            await supabase.from("rediscovery_runs").update({ status: "failed", error: e.message, completed_at: new Date().toISOString() }).eq("id", run.id);
            return new Response(JSON.stringify({ error: e.message }), { status: e.message === "RATE_LIMIT" ? 429 : 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }
          // explanations are non-fatal — continue with empty
          console.error("Explain failure (continuing):", e);
        }
      }

      // 8. Build rows
      const similarityMap = new Map((prefilter ?? []).map((m: any) => [m.candidate_id, Number(m.similarity ?? 0)]));
      const { data: recentEmails } = await supabase.from("candidate_emails").select("candidate_id").in("candidate_id", qualified.map((s) => s.candidate.id));
      const contacted = new Set((recentEmails ?? []).map((r: any) => r.candidate_id));

      const rows = qualified.map(({ candidate: c, result: r }) => {
        const explain = explainMap[c.id] ?? { strengths: [], gaps: [], summary: "" };
        const insights: string[] = [];
        if (c.updated_at && Date.now() - new Date(c.updated_at).getTime() < 30 * 86400 * 1000) insights.push("Recently active");
        if (contacted.has(c.id)) insights.push("Previously contacted");

        // Strengths/gaps fallback from deterministic data if AI returned nothing
        const strengths = explain.strengths.length > 0 ? explain.strengths : r.matched.slice(0, 3).map((s) => `Has ${s}`);
        const gaps = explain.gaps.length > 0 ? explain.gaps : r.missing.slice(0, 2).map((s) => `Missing ${s}`);

        return {
          job_id,
          candidate_id: c.id,
          tenant_id: job.tenant_id,
          match_score: r.final,
          semantic_score: similarityMap.get(c.id) ?? null,
          ai_score: r.final, // kept for backwards compat with existing readers
          ai_summary: explain.summary || null,
          strengths,
          gaps,
          confidence: r.confidence,
          insights,
          dismissed: false,
          sub_scores: {
            role: r.sub.role,
            skills: r.sub.skills,
            industry: r.sub.industry,
            seniority: r.sub.seniority,
            experience: r.sub.experience,
            location: r.sub.location,
            penalty: r.sub.penalty,
            job_family: r.jobFamily,
            candidate_family: r.candFamily,
          },
          model_version: MODEL_VERSION,
          updated_at: new Date().toISOString(),
        };
      });

      // 9. Replace prior matches for this job (so removed candidates disappear)
      await supabase.from("rediscovered_matches").delete().eq("job_id", job_id).eq("dismissed", false);
      if (rows.length) {
        const { error: upErr } = await supabase.from("rediscovered_matches").upsert(rows, { onConflict: "job_id,candidate_id" });
        if (upErr) throw upErr;
      }

      await supabase.from("rediscovery_runs").update({
        status: "success", candidates_scanned: scanned, matches_found: rows.length, completed_at: new Date().toISOString(),
      }).eq("id", run.id);

      return new Response(JSON.stringify({ ok: true, matches: rows.length, embedded, scanned, model_version: MODEL_VERSION }), {
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
