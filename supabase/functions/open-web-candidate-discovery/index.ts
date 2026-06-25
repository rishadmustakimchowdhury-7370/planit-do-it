// Open Web Candidate Discovery — OpenAI-as-recruitment-consultant with multi-pass recall.
// Strategy: expand brief -> run parallel batches across title families x locations
// -> collect raw -> dedupe -> rank -> return top N.
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
interface Body { criteria?: Criteria; mode?: "strict" | "balanced" | "broad"; limit?: number; target?: number }

type Provider = { url: string; headers: Record<string, string>; model: string; name: string };
function pickProvider(): Provider | null {
  const k = Deno.env.get("OPENAI_API_KEY");
  if (k) return { name: "openai", url: "https://api.openai.com/v1/chat/completions", headers: { Authorization: `Bearer ${k}`, "Content-Type": "application/json" }, model: "gpt-4o-mini" };
  const l = Deno.env.get("LOVABLE_API_KEY");
  if (l) return { name: "lovable-gemini", url: "https://ai.gateway.lovable.dev/v1/chat/completions", headers: { "Lovable-API-Key": l, "Content-Type": "application/json" }, model: "google/gemini-2.5-flash" };
  return null;
}

async function callAI(messages: { role: string; content: string }[], p: Provider, temperature = 0.5) {
  const res = await fetch(p.url, {
    method: "POST",
    headers: p.headers,
    body: JSON.stringify({
      model: p.model,
      temperature,
      messages,
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) throw new Error(`AI ${p.name} ${res.status}: ${(await res.text().catch(() => "")).slice(0, 400)}`);
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content ?? "{}";
  try { return JSON.parse(content); }
  catch { return JSON.parse(String(content).replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "")); }
}

// Step 1 — expansion plan
async function expandBrief(c: Criteria, p: Provider) {
  const prompt = `You are a senior recruitment sourcing strategist. Expand this search brief into a sourcing plan.

BRIEF
- Role titles: ${(c.role_titles ?? []).join(", ") || "(any)"}
- Skills: ${(c.skills ?? []).join(", ") || "(any)"}
- Locations: ${(c.locations ?? []).join(", ") || "(any)"}
- Industries: ${(c.industries ?? []).join(", ") || "(any)"}
- Languages: ${(c.languages ?? []).join(", ") || "(any)"}
- Seniority: ${c.seniority || "(any)"}
- Keywords: ${(c.keywords ?? []).join(", ") || "(none)"}
- Notes: ${c.notes || "(none)"}

Generate aggressive expansions to maximize recall. Return ONLY JSON:
{
  "title_families": ["10-15 closely related job titles"],
  "location_expansions": ["5-10 cities/regions/countries to search"],
  "language_expansions": ["3-6 ways the language requirement is phrased"],
  "industry_expansions": ["5-10 adjacent industries/verticals"],
  "strategy_summary": "1-2 sentences"
}`;
  return await callAI([
    { role: "system", content: "Output only valid JSON. No prose." },
    { role: "user", content: prompt },
  ], p, 0.4);
}

// Step 2 — single batch focused on one (title, location) combo
function buildBatchPrompt(c: Criteria, exp: any, focusTitle: string, focusLocation: string, batchSize: number) {
  return `You are a senior headhunter. Source REAL plausible candidates for this focused search.

ORIGINAL BRIEF
- Role titles: ${(c.role_titles ?? []).join(", ")}
- Languages required: ${(c.languages ?? []).join(", ") || "(any)"}
- Industries: ${(c.industries ?? []).join(", ") || "(any)"}
- Skills: ${(c.skills ?? []).join(", ") || "(any)"}
- Seniority: ${c.seniority || "(any)"}

FOCUS THIS BATCH ON
- Title family: "${focusTitle}"
- Location: "${focusLocation}"
- Language variants: ${(exp?.language_expansions ?? []).join(", ") || "(none)"}

Return ${batchSize} DIFFERENT real candidates who match this focus. Use full names, current title,
company, LinkedIn URL (only when confident — else null). NEVER invent people; if unsure of a field
return null instead of fabricating. Score each candidate 0-100 against the ORIGINAL brief using:
role 40, skills 30, function 15, location 10, industry 5.

OUTPUT — only JSON:
{
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
      "ai_summary": "1 sentence why they fit",
      "match_score": 0,
      "match_reasons": ["..."],
      "match_missing": ["..."]
    }
  ]
}`;
}

function shapeOne(c: any) {
  if (!c?.full_name) return null;
  return {
    id: `ow_${crypto.randomUUID()}`,
    source: "Open Web Discovery",
    source_url: c.linkedin_url ?? null,
    full_name: String(c.full_name).trim(),
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
  };
}

function dedupeKey(r: any) {
  const li = String(r.linkedin_url ?? "").trim().toLowerCase().replace(/\/+$/, "");
  if (li) return `li:${li}`;
  return `nc:${String(r.full_name).trim().toLowerCase()}|${String(r.current_company ?? "").trim().toLowerCase()}`;
}

const ALLOWED_TARGETS = [25, 50, 100, 250, 500];
function clampTarget(t: number) {
  if (!Number.isFinite(t)) return 100;
  let best = 100;
  for (const v of ALLOWED_TARGETS) if (Math.abs(v - t) < Math.abs(best - t)) best = v;
  return best;
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
    const target = clampTarget(body.target ?? body.limit ?? 100);

    // Step 1 — expansion plan
    let exp: any = {};
    try { exp = await expandBrief(criteria, provider); }
    catch (e) {
      const msg = e instanceof Error ? e.message : "AI error";
      if (/\b429\b/.test(msg)) return json({ error: "AI rate limit exceeded — please retry shortly.", source: "open_web" }, 200);
      if (/\b402\b/.test(msg)) return json({ error: "AI credits exhausted. Add credits in Settings → Plans & credits.", source: "open_web" }, 200);
      return json({ error: msg, source: "open_web" }, 200);
    }

    const titleFamilies: string[] = Array.isArray(exp?.title_families) && exp.title_families.length
      ? exp.title_families
      : (criteria.role_titles?.length ? criteria.role_titles : ["candidate"]);
    const locationExpansions: string[] = Array.isArray(exp?.location_expansions) && exp.location_expansions.length
      ? exp.location_expansions
      : (criteria.locations?.length ? criteria.locations : ["(any)"]);

    // Step 2 — build batch matrix sized to target
    // raw quota = ~target * 2.5 to absorb dedupe + low-score loss
    const rawQuota = Math.ceil(target * 2.5);
    const batchSize = 25; // per AI call
    const batchesNeeded = Math.min(20, Math.ceil(rawQuota / batchSize));

    const combos: { title: string; location: string }[] = [];
    outer: for (const t of titleFamilies) {
      for (const l of locationExpansions) {
        combos.push({ title: t, location: l });
        if (combos.length >= batchesNeeded) break outer;
      }
    }
    // If not enough combos, pad by repeating with variation
    while (combos.length < batchesNeeded) {
      const t = titleFamilies[combos.length % titleFamilies.length];
      const l = locationExpansions[combos.length % locationExpansions.length];
      combos.push({ title: t, location: l });
    }

    // Run batches with bounded concurrency (5 at a time)
    const CONCURRENCY = 5;
    const rawCandidates: any[] = [];
    const batchErrors: string[] = [];
    for (let i = 0; i < combos.length; i += CONCURRENCY) {
      const slice = combos.slice(i, i + CONCURRENCY);
      const results = await Promise.allSettled(slice.map((cmb) =>
        callAI([
          { role: "system", content: "Output only valid JSON. Never invent people — return null for uncertain fields." },
          { role: "user", content: buildBatchPrompt(criteria, exp, cmb.title, cmb.location, batchSize) },
        ], provider, 0.6)
      ));
      for (const r of results) {
        if (r.status === "fulfilled") {
          const arr = Array.isArray(r.value?.candidates) ? r.value.candidates : [];
          for (const c of arr) {
            const shaped = shapeOne(c);
            if (shaped) rawCandidates.push(shaped);
          }
        } else {
          batchErrors.push(r.reason instanceof Error ? r.reason.message : String(r.reason));
        }
      }
      // Early stop if we have plenty
      if (rawCandidates.length >= rawQuota) break;
    }

    // Dedupe
    const seen = new Set<string>();
    const deduped: any[] = [];
    for (const c of rawCandidates) {
      const k = dedupeKey(c);
      if (seen.has(k)) continue;
      seen.add(k);
      deduped.push(c);
    }

    // Sort by matchScore desc, nulls last
    deduped.sort((a, b) => {
      const sa = typeof a.matchScore === "number" ? a.matchScore : -1;
      const sb = typeof b.matchScore === "number" ? b.matchScore : -1;
      return sb - sa;
    });

    const returned = deduped.slice(0, target);

    return json({
      source: "open_web",
      strategy_summary: exp?.strategy_summary ?? null,
      expansions: {
        titles: titleFamilies,
        locations: locationExpansions,
        languages: exp?.language_expansions ?? [],
        industries: exp?.industry_expansions ?? [],
      },
      stats: {
        target,
        raw_found: rawCandidates.length,
        deduped: deduped.length,
        scored: deduped.length,
        returned: returned.length,
        batches_run: Math.min(combos.length, Math.ceil(rawCandidates.length / batchSize) || combos.length),
        batch_errors: batchErrors.length,
      },
      candidates: returned,
      total: returned.length,
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Server error" }, 500);
  }
});
