// Open Web Client Discovery — AI-powered fallback when Apollo is unavailable.
// Generates companies + decision makers from public web knowledge via Lovable AI Gateway.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

interface Filters {
  keywords?: string;
  industry?: string;
  employeeRange?: string;
  country?: string;
  city?: string;
  searchMode?: "strict" | "balanced" | "broad";
  page?: number;
  perPage?: number;
}

function buildPrompt(f: Filters) {
  const mode = f.searchMode ?? "balanced";
  const targetCompanies = mode === "strict" ? 50 : mode === "broad" ? 120 : 80;
  const minCompanies = mode === "strict" ? 40 : mode === "broad" ? 100 : 60;
  return `You are a senior B2B Business Development Manager and AI sourcing agent for a recruitment firm.
You are NOT a search tool — you are the DECISION ENGINE. The user gave you a brief; you must think
like an experienced BDM and produce a target account list with decision makers.

SEARCH BRIEF
- Industry / Type: ${f.industry || "(any)"}
- Keywords: ${f.keywords || "(none)"}
- Country: ${f.country || "(any)"}
- City: ${f.city || "(any)"}
- Employee size band: ${f.employeeRange || "(any)"}
- Search mode: ${mode.toUpperCase()} (strict = highly targeted, balanced = default, broad = maximum coverage)

INTERNAL REASONING (do not output, but use it to drive the result set)
1. EXPAND THE BRIEF.
   - Generate 10-20 alternative industry phrasings, sub-niches, and adjacent verticals.
     Example "commodity trading in Switzerland" -> commodity trading house, physical commodities trader,
     metals trader, energy trader, agri-commodities, oil trading, soft commodities, trade finance, etc.
   - Generate alternative location phrasings (Switzerland -> Geneva, Zug, Zurich, Lugano, Basel).
   - Generate alternative size/segment angles (boutique, mid-market, enterprise, family office).
2. RUN MULTIPLE INTERNAL SEARCH PASSES across those expansions to maximise coverage.
3. DECISION MAKERS: for each company list 3-6 likely decision makers covering CEO, Founder,
   Managing Director, Director, Head of HR, HR Manager, Talent Acquisition Manager, Recruitment
   Manager, Head of Talent, Operations Director. Include real names + LinkedIn URLs ONLY when you
   are confident; otherwise leave name and linkedin_url null and return just the title.
4. SCORE each company: high / medium / low based on industry+size+location fit and any hiring or
   growth signals you can infer.
5. DEDUPE by company name and website.

OUTPUT REQUIREMENTS
- Return ${minCompanies}-${targetCompanies} REAL companies. Never invent companies. If unsure of a
  fact, leave that field null rather than fabricating.
- Prefer breadth: it is better to return 80 plausible companies than 20 perfect ones.
- Return ONLY JSON, no prose, no markdown fences.

JSON SHAPE:
{
  "strategy_summary": "1-2 sentences describing the angles you searched",
  "expansions": {
    "industries": ["..."],
    "locations": ["..."],
    "titles": ["..."]
  },
  "companies": [
    {
      "name": "string",
      "website": "https://... or null",
      "linkedin_url": "https://www.linkedin.com/company/... or null",
      "industry": "string or null",
      "country": "string or null",
      "city": "string or null",
      "employee_count_range": "e.g. 51-200 or null",
      "short_description": "1 sentence or null",
      "hiring_signal": "string or null",
      "match_score": "high|medium|low",
      "match_reason": "1 short sentence explaining the BDM rationale",
      "decision_makers": [
        { "name": "string or null", "title": "string", "linkedin_url": "https://www.linkedin.com/in/... or null" }
      ]
    }
  ]
}`;
}

type AIProvider = { url: string; headers: Record<string, string>; model: string; name: string };

function pickProvider(): AIProvider | null {
  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  if (openaiKey) {
    return {
      name: "openai",
      url: "https://api.openai.com/v1/chat/completions",
      headers: { "Authorization": `Bearer ${openaiKey}`, "Content-Type": "application/json" },
      model: "gpt-4o",
    };
  }
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  if (lovableKey) {
    return {
      name: "lovable-gemini",
      url: "https://ai.gateway.lovable.dev/v1/chat/completions",
      headers: { "Lovable-API-Key": lovableKey, "Content-Type": "application/json" },
      model: "google/gemini-2.5-flash",
    };
  }
  return null;
}

async function callAI(prompt: string, provider: AIProvider) {
  const res = await fetch(provider.url, {
    method: "POST",
    headers: provider.headers,
    body: JSON.stringify({
      model: provider.model,
      messages: [
        { role: "system", content: "You output only valid JSON. Never include markdown fences or prose. You are an AI sourcing agent — return as many high-quality real companies as the brief allows." },
        { role: "user", content: prompt },
      ],
      temperature: 0.4,
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`AI ${provider.name} ${res.status}: ${t.slice(0, 400)}`);
  }
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content ?? "{}";
  try {
    return JSON.parse(content);
  } catch {
    const stripped = String(content).replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
    return JSON.parse(stripped);
  }
}

function shapeResults(raw: any, f: Filters) {
  const companies = Array.isArray(raw?.companies) ? raw.companies : [];
  const seen = new Set<string>();
  const peopleOut: any[] = [];
  const companiesOut: any[] = [];

  for (const c of companies) {
    const key = (c?.name || "").toString().trim().toLowerCase() + "|" + (c?.website || "").toString().trim().toLowerCase();
    if (!c?.name || seen.has(key)) continue;
    seen.add(key);

    const compId = `ow_${crypto.randomUUID()}`;
    const empCount = (() => {
      const r = c?.employee_count_range;
      if (!r || typeof r !== "string") return null;
      const m = r.match(/(\d+)/);
      return m ? Number(m[1]) : null;
    })();

    companiesOut.push({
      id: compId,
      name: c.name ?? null,
      website_url: c.website ?? null,
      linkedin_url: c.linkedin_url ?? null,
      industry: c.industry ?? null,
      estimated_num_employees: empCount,
      city: c.city ?? null,
      state: null,
      country: c.country ?? null,
      short_description: c.short_description ?? null,
      match_score: c.match_score ?? null,
      match_reason: c.match_reason ?? null,
      decision_makers: Array.isArray(c.decision_makers) ? c.decision_makers : [],
    });

    for (const dm of Array.isArray(c.decision_makers) ? c.decision_makers : []) {
      peopleOut.push({
        id: `ow_${crypto.randomUUID()}`,
        first_name: (dm?.name ?? "").split(" ")[0] || null,
        last_name: (dm?.name ?? "").split(" ").slice(1).join(" ") || null,
        name: dm?.name ?? (dm?.title ? `${dm.title} @ ${c.name}` : c.name),
        title: dm?.title ?? null,
        linkedin_url: dm?.linkedin_url ?? null,
        city: c.city ?? null,
        state: null,
        country: c.country ?? null,
        company: {
          id: compId,
          name: c.name ?? null,
          website_url: c.website ?? null,
          linkedin_url: c.linkedin_url ?? null,
          industry: c.industry ?? null,
          estimated_num_employees: empCount,
          city: c.city ?? null,
          country: c.country ?? null,
        },
      });
    }
  }

  const page = Math.max(1, Number(f.page) || 1);
  const perPage = Math.min(100, Math.max(1, Number(f.perPage) || 25));
  return { companiesOut, peopleOut, page, perPage };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  // Hoisted metering state for outer-catch refund (Batch A / Phase 2)
  let __meterAdmin: ReturnType<typeof createClient> | null = null;
  let __meterTenant: string | null = null;
  let __meterUser: string | null = null;
  let __meterReserved = false;
  const __meterFeatureKey = "open_web_discovery";
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Unauthorized" }, 401);
    const userId = userData.user.id;
    const admin = createClient(supabaseUrl, serviceKey);

    const { data: profile } = await admin.from("profiles").select("tenant_id").eq("id", userId).maybeSingle();
    if (!profile?.tenant_id) return json({ error: "No tenant" }, 403);
    const tenantId = profile.tenant_id as string;

    const { data: roles } = await admin.from("user_roles").select("role,tenant_id").eq("user_id", userId);
    const roleSet = new Set((roles ?? []).map((r: any) => r.role));
    const tenantRoleSet = new Set((roles ?? []).filter((r: any) => r.tenant_id === tenantId).map((r: any) => r.role));
    const allowed = tenantRoleSet.has("owner") || tenantRoleSet.has("manager") || roleSet.has("super_admin");
    if (!allowed) return json({ error: "Forbidden: Open Web discovery requires Owner or Manager role." }, 403);

    __meterAdmin = admin; __meterTenant = tenantId; __meterUser = userId;
    // ── Server-side metering ────────────────────────────────────────────────
    const __reserve = await admin.rpc("check_and_reserve_feature_usage", {
      _tenant_id: tenantId, _feature_key: __meterFeatureKey, _amount: 1, _user_id: userId,
    });
    if (__reserve.error) {
      const m = __reserve.error.message ?? "";
      if (m.includes("FEATURE_LIMIT_EXCEEDED")) {
        return new Response(JSON.stringify({
          error: `Plan limit reached for ${__meterFeatureKey}. Upgrade to continue.`,
          code: "FEATURE_LIMIT_EXCEEDED", feature_key: __meterFeatureKey, upgrade_required: true,
        }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      console.error("[meter] reserve error", m);
    } else { __meterReserved = true; }

    const provider = pickProvider();
    if (!provider) return json({ error: "No AI provider configured (set OPENAI_API_KEY or LOVABLE_API_KEY)." }, 500);

    const filters = (await req.json().catch(() => ({}))) as Filters;
    const prompt = buildPrompt(filters);

    let raw: any;
    try {
      raw = await callAI(prompt, provider);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "AI gateway error";
      if (/\b429\b/.test(msg)) return json({ error: "AI rate limit exceeded — please retry shortly.", source: "open_web" }, 200);
      if (/\b402\b/.test(msg)) return json({ error: "AI credits exhausted. Add credits in Settings → Plans & credits.", source: "open_web" }, 200);
      return json({ error: msg, source: "open_web" }, 200);
    }

    const { companiesOut, peopleOut, page, perPage } = shapeResults(raw, filters);

    await admin.from("lead_search_history").insert({
      tenant_id: tenantId,
      searched_by: userId,
      query_text: filters.keywords || null,
      filters: { ...filters, source: "open_web" },
      result_count: companiesOut.length,
    }).then(() => {}, () => {});

    return json({
      source: "open_web",
      mode: "companies",
      planTier: "open_web",
      capabilities: { people_search: true, org_search: true },
      strategy_summary: raw?.strategy_summary ?? null,
      expansions: raw?.expansions ?? null,
      people: peopleOut,
      companies: companiesOut,
      page,
      per_page: perPage,
      total_entries: companiesOut.length,
      total_pages: 1,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    console.error("[open-web-client-discovery] fatal", msg);
    return json({ error: msg }, 500);
  }
});
