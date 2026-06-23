// Open Web Candidate Discovery — OpenAI-as-recruitment-consultant fallback.
// Used when Apollo / Lusha / Vibe / CRM cannot return enough candidates.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

interface Criteria {
  role_titles?: string[];
  skills?: string[];
  locations?: string[];
  industries?: string[];
  seniority?: string | null;
  min_years_experience?: number | null;
  max_years_experience?: number | null;
  keywords?: string[];
  languages?: string[];
  notes?: string | null;
}
interface Body { criteria?: Criteria; mode?: "strict" | "balanced" | "broad"; limit?: number }

function buildPrompt(c: Criteria, mode: string, target: number) {
  return `You are a Senior Recruitment Consultant and AI sourcing agent. The user gave you a search
brief. You are the DECISION ENGINE — search providers are only data sources. Think like an
experienced headhunter and return a strong shortlist of REAL professionals.

SEARCH BRIEF
- Role titles: ${(c.role_titles ?? []).join(", ") || "(any)"}
- Skills: ${(c.skills ?? []).join(", ") || "(any)"}
- Locations: ${(c.locations ?? []).join(", ") || "(any)"}
- Industries: ${(c.industries ?? []).join(", ") || "(any)"}
- Seniority: ${c.seniority || "(any)"}
- Experience: ${c.min_years_experience ?? "?"}-${c.max_years_experience ?? "?"} years
- Languages: ${(c.languages ?? []).join(", ") || "(any)"}
- Keywords: ${(c.keywords ?? []).join(", ") || "(none)"}
- Notes: ${c.notes || "(none)"}
- Mode: ${mode.toUpperCase()}

INTERNAL REASONING (do not output, drive the result set)
1. EXPAND TITLES. e.g. "Operations Manager" -> Operations Specialist, Trade Operations Manager,
   Shipping Operations Manager, Head of Operations, Operations Executive, COO.
2. EXPAND SKILLS into adjacent / transferable skills.
3. EXPAND LOCATIONS (Switzerland -> Geneva, Zug, Zurich, Lugano, Basel).
4. EXPAND INDUSTRIES into adjacent verticals — industry is the LOWEST-weight signal, never
   eliminate strong candidates because of industry alone.
5. Generate 10-20 internal search strategies across those expansions.
6. SCORE each candidate using exactly these weights:
   role 40, skills 30, function 15, location 10, industry 5 (sum 100).
7. Return ${target} real candidates. NEVER invent people. If unsure of a fact, return null for
   that field instead of fabricating. Only include a LinkedIn URL when you are confident.

OUTPUT — RETURN ONLY JSON, no prose, no markdown fences:
{
  "strategy_summary": "1-2 sentences",
  "expansions": { "titles": ["..."], "skills": ["..."], "locations": ["..."], "industries": ["..."] },
  "candidates": [
    {
      "full_name": "string",
      "current_title": "string",
      "current_company": "string or null",
      "industry": "string or null",
      "location": "string or null",
      "linkedin_url": "https://www.linkedin.com/in/... or null",
      "skills": ["..."],
      "languages": ["..."],
      "experience_years": 0,
      "seniority": "string or null",
      "experience_summary": "1-2 sentence career summary",
      "ai_summary": "1 sentence why they fit the brief",
      "match_score": 0,
      "match_reasons": ["..."],
      "match_missing": ["..."]
    }
  ]
}`;
}

type Provider = { url: string; headers: Record<string, string>; model: string; name: string };
function pickProvider(): Provider | null {
  const k = Deno.env.get("OPENAI_API_KEY");
  if (k) return { name: "openai", url: "https://api.openai.com/v1/chat/completions", headers: { Authorization: `Bearer ${k}`, "Content-Type": "application/json" }, model: "gpt-4o" };
  const l = Deno.env.get("LOVABLE_API_KEY");
  if (l) return { name: "lovable-gemini", url: "https://ai.gateway.lovable.dev/v1/chat/completions", headers: { "Lovable-API-Key": l, "Content-Type": "application/json" }, model: "google/gemini-2.5-flash" };
  return null;
}

async function callAI(prompt: string, p: Provider) {
  const res = await fetch(p.url, {
    method: "POST",
    headers: p.headers,
    body: JSON.stringify({
      model: p.model,
      temperature: 0.4,
      messages: [
        { role: "system", content: "You output only valid JSON. Never include markdown fences or prose. You are a senior recruiter — return as many real, plausible candidates as the brief allows." },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) throw new Error(`AI ${p.name} ${res.status}: ${(await res.text().catch(() => "")).slice(0, 400)}`);
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content ?? "{}";
  try { return JSON.parse(content); }
  catch { return JSON.parse(String(content).replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "")); }
}

function shape(raw: any) {
  const cands = Array.isArray(raw?.candidates) ? raw.candidates : [];
  const seen = new Set<string>();
  const out: any[] = [];
  for (const c of cands) {
    const key = `${String(c?.full_name ?? "").trim().toLowerCase()}|${String(c?.linkedin_url ?? "").trim().toLowerCase()}`;
    if (!c?.full_name || seen.has(key)) continue;
    seen.add(key);
    out.push({
      id: `ow_${crypto.randomUUID()}`,
      source: "Open Web Discovery",
      source_url: c.linkedin_url ?? null,
      full_name: c.full_name,
      headline: null,
      current_title: c.current_title ?? "",
      current_company: c.current_company ?? "",
      industry: c.industry ?? null,
      location: c.location ?? "",
      languages: Array.isArray(c.languages) ? c.languages : [],
      linkedin_url: c.linkedin_url ?? null,
      email: null,
      phone: null,
      skills: Array.isArray(c.skills) ? c.skills : [],
      experience_years: Number.isFinite(c.experience_years) ? c.experience_years : null,
      experience_summary: c.experience_summary ?? c.ai_summary ?? null,
      education: null,
      seniority: c.seniority ?? null,
      confidence: null,
      matchScore: Number.isFinite(c.match_score) ? c.match_score : null,
      matchReasons: Array.isArray(c.match_reasons) ? c.match_reasons : [],
      matchMissing: Array.isArray(c.match_missing) ? c.match_missing : [],
      ai_summary: c.ai_summary ?? null,
    });
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: u, error: ue } = await userClient.auth.getUser();
    if (ue || !u.user) return json({ error: "Unauthorized" }, 401);
    const admin = createClient(supabaseUrl, serviceKey);

    const { data: profile } = await admin.from("profiles").select("tenant_id").eq("id", u.user.id).maybeSingle();
    if (!profile?.tenant_id) return json({ error: "No tenant" }, 403);

    const provider = pickProvider();
    if (!provider) return json({ error: "No AI provider configured (set OPENAI_API_KEY or LOVABLE_API_KEY)." }, 500);

    const body = (await req.json().catch(() => ({}))) as Body;
    const criteria = body.criteria ?? {};
    const mode = body.mode ?? "balanced";
    const target = Math.min(100, Math.max(25, body.limit ?? (mode === "strict" ? 50 : mode === "broad" ? 100 : 75)));

    let raw: any;
    try { raw = await callAI(buildPrompt(criteria, mode, target), provider); }
    catch (e) {
      const msg = e instanceof Error ? e.message : "AI error";
      if (/\b429\b/.test(msg)) return json({ error: "AI rate limit exceeded — please retry shortly.", source: "open_web" }, 200);
      if (/\b402\b/.test(msg)) return json({ error: "AI credits exhausted. Add credits in Settings → Plans & credits.", source: "open_web" }, 200);
      return json({ error: msg, source: "open_web" }, 200);
    }

    const candidates = shape(raw);
    return json({
      source: "open_web",
      strategy_summary: raw?.strategy_summary ?? null,
      expansions: raw?.expansions ?? null,
      candidates,
      total: candidates.length,
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Server error" }, 500);
  }
});
