// AI Candidate Search — Lusha v3 + Vibe Prospecting (Explorium) with hard
// pre-ranking filters and OpenAI scoring. Only real candidates are returned.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// ---------------- AES-GCM decrypt -----------------------------------------
async function getKey(): Promise<CryptoKey> {
  const raw = Deno.env.get("APOLLO_ENCRYPTION_KEY") ?? "";
  if (!raw) throw new Error("APOLLO_ENCRYPTION_KEY not configured");
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  return crypto.subtle.importKey("raw", hash, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}
function fromB64(s: string) {
  const bin = atob(s); const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
async function decryptKey(ct: string, iv: string): Promise<string> {
  const key = await getKey();
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromB64(iv) }, key, fromB64(ct));
  return new TextDecoder().decode(pt);
}

// ---------------- Shared types --------------------------------------------
interface UnifiedCandidate {
  id: string;
  source: "Lusha" | "Vibe Prospecting";
  source_url?: string | null;
  full_name: string;
  current_title: string;
  current_company: string;
  industry?: string | null;
  location: string;
  country?: string | null;
  languages: string[];
  linkedin_url?: string | null;
  email?: string | null;
  phone?: string | null;
  skills: string[];
  experience_years?: number | null;
  seniority?: string | null;
  matchScore?: number;
  matchReasons?: string[];
}

interface LushaFilterDebug {
  titles: string[];
  industries: string[];
  locations: string[];
  countries: string[];
  searchText?: string | null;
  skipped?: boolean;
  skipReason?: string;
}

type SearchResult = { candidates: UnifiedCandidate[]; error?: string; debug?: { generatedFilters?: LushaFilterDebug; requestPayload?: unknown } };

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

const COUNTRY_TO_ALPHA2: Record<string, string> = {
  "united kingdom": "GB", uk: "GB", "great britain": "GB", england: "GB", britain: "GB",
  "united states": "US", usa: "US", america: "US",
  switzerland: "CH", germany: "DE", france: "FR", spain: "ES", italy: "IT",
  netherlands: "NL", ireland: "IE", "united arab emirates": "AE", uae: "AE", emirates: "AE",
  dubai: "AE", "abu dhabi": "AE",
  singapore: "SG", canada: "CA", australia: "AU", india: "IN", china: "CN",
  japan: "JP", brazil: "BR", poland: "PL", portugal: "PT", sweden: "SE",
  norway: "NO", denmark: "DK", finland: "FI", belgium: "BE", luxembourg: "LU",
  austria: "AT", "saudi arabia": "SA", qatar: "QA", "hong kong": "HK",
  russia: "RU", "russian federation": "RU", moscow: "RU",
  ukraine: "UA", turkey: "TR", greece: "GR", romania: "RO", czechia: "CZ",
  hungary: "HU", "south africa": "ZA", mexico: "MX", argentina: "AR",
};
function locationsToCountryCodes(locations: string[] = []): string[] {
  const out = new Set<string>();
  for (const loc of locations) {
    const lower = loc.toLowerCase();
    for (const [name, code] of Object.entries(COUNTRY_TO_ALPHA2)) {
      if (lower.includes(name)) { out.add(code); break; }
    }
  }
  return Array.from(out);
}
function seniorityToVibeLevels(seniority?: string | null): string[] {
  if (!seniority) return [];
  const s = seniority.toLowerCase();
  if (s.includes("intern") || s.includes("junior") || s.includes("entry")) return ["junior", "entry"];
  if (s.includes("mid")) return ["non-managerial", "senior non-managerial", "manager"];
  if (s.includes("senior") && !s.includes("manager")) return ["senior non-managerial", "senior manager", "manager"];
  if (s.includes("lead") || s.includes("manager")) return ["manager", "senior manager"];
  if (s.includes("director")) return ["director"];
  if (s.includes("vp") || s.includes("vice")) return ["vice president"];
  if (s.includes("head") || s.includes("chief") || s.includes("cxo")) return ["c-suite"];
  return [];
}

// ---------------- Vibe Prospecting (Explorium) ----------------------------
async function searchVibe(apiKey: string, criteria: Criteria, size = 50): Promise<SearchResult> {
  const titles = (criteria.role_titles ?? []).map((t) => t.toLowerCase()).filter(Boolean).slice(0, 10);
  const filters: Record<string, unknown> = {};
  if (titles.length) filters.job_title = { values: titles };
  const countryCodes = locationsToCountryCodes(criteria.locations);
  if (countryCodes.length) filters.country_code = { values: countryCodes };
  const levels = seniorityToVibeLevels(criteria.seniority);
  if (levels.length) filters.job_level = { values: levels };
  if (criteria.min_years_experience != null) {
    filters.total_experience_months = {
      gte: Math.max(0, Math.floor(criteria.min_years_experience * 12)),
      ...(criteria.max_years_experience != null ? { lte: Math.floor(criteria.max_years_experience * 12) } : {}),
    };
  }
  const body = { mode: "full", size, page_size: size, page: 1, filters };
  try {
    const res = await fetch("https://api.explorium.ai/v1/prospects", {
      method: "POST",
      headers: { "api_key": apiKey, "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    if (!res.ok) {
      console.error("[vibe] search failed", res.status, text.slice(0, 400));
      return { candidates: [], error: `Vibe Prospecting ${res.status}: ${text.slice(0, 200)}` };
    }
    const data = JSON.parse(text);
    const rows: any[] = data?.data ?? [];
    const candidates: UnifiedCandidate[] = rows.map((p) => {
      const linkedin = p.linkedin || (Array.isArray(p.linkedin_url_array) ? p.linkedin_url_array[0] : null);
      const location = [p.city, p.region_name, p.country_name].filter(Boolean).join(", ");
      return {
        id: `vibe-${p.prospect_id}`,
        source: "Vibe Prospecting",
        source_url: linkedin ?? (p.business_id ? `https://app.vibeprospecting.ai/prospects/${p.prospect_id}` : null),
        full_name: p.full_name || `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim(),
        current_title: p.job_title ?? "",
        current_company: p.company_name ?? "",
        industry: p.job_department_main ?? p.job_department ?? null,
        location,
        country: p.country_name ?? null,
        languages: [],
        linkedin_url: linkedin,
        email: null,
        phone: null,
        skills: Array.isArray(p.skills) ? p.skills.slice(0, 12) : [],
        experience_years: Array.isArray(p.experience) && p.experience.length
          ? Math.max(0, Math.round(p.experience.reduce((acc: number, e: any) => acc + (e?.duration_months ?? 0), 0) / 12))
          : null,
        seniority: p.job_seniority_level ?? p.job_level_main ?? null,
      };
    });
    console.log(`[vibe] returned ${candidates.length} raw candidates`);
    return { candidates };
  } catch (e) {
    return { candidates: [], error: e instanceof Error ? e.message : "Network error" };
  }
}

// ---------------- Lusha v3 Prospecting ------------------------------------
async function searchLusha(apiKey: string, criteria: Criteria, size = 50): Promise<{ candidates: UnifiedCandidate[]; error?: string }> {
  const include: Record<string, unknown> = {};
  const titles = (criteria.role_titles ?? []).filter(Boolean).slice(0, 10);
  if (titles.length) include.jobTitles = titles;

  const countryCodes = locationsToCountryCodes(criteria.locations);
  if (countryCodes.length) include.countries = countryCodes;

  const industries = (criteria.industries ?? []).filter(Boolean).slice(0, 10);
  if (industries.length) include.industries = industries;

  if (criteria.seniority) {
    const s = criteria.seniority.toLowerCase();
    const map: Array<[string, string]> = [
      ["intern", "Intern"], ["junior", "Junior"], ["entry", "Entry"],
      ["manager", "Manager"], ["lead", "Manager"], ["senior", "Senior"], ["mid", "Senior"],
      ["director", "Director"], ["vp", "Vice President"], ["vice", "Vice President"],
      ["head", "CXO"], ["chief", "CXO"], ["cxo", "CXO"],
    ];
    for (const [k, v] of map) { if (s.includes(k)) { include.seniority = [v]; break; } }
  }

  // VALIDATE: Lusha requires at least one of titles / industries / countries / locations
  const hasValid =
    (include.jobTitles as unknown[] | undefined)?.length ||
    (include.industries as unknown[] | undefined)?.length ||
    (include.countries as unknown[] | undefined)?.length;
  if (!hasValid) {
    console.warn("[lusha] skipping — no valid filter (need title/industry/location)");
    return { candidates: [], error: "Lusha skipped: no valid filter present" };
  }

  const body = {
    pagination: { page: 0, size: Math.min(size, 50) },
    filters: { contacts: { include } },
  };
  console.log("[lusha] request filters:", JSON.stringify(body.filters));
  try {
    const res = await fetch("https://api.lusha.com/v3/contacts/prospecting", {
      method: "POST",
      headers: { "api_key": apiKey, "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    if (!res.ok) {
      console.error("[lusha] search failed", res.status, text.slice(0, 400));
      return { candidates: [], error: `Lusha ${res.status}: ${text.slice(0, 200)}` };
    }
    const data = JSON.parse(text);
    const rows: any[] = data?.results ?? [];
    const candidates: UnifiedCandidate[] = rows.map((c) => {
      const linkedin = c.socialLinks?.linkedin ?? null;
      const loc = c.location ?? {};
      const location = [loc.city, loc.state, loc.country].filter(Boolean).join(", ");
      return {
        id: `lusha-${c.id}`,
        source: "Lusha",
        source_url: linkedin ?? `https://dashboard.lusha.com/enrich/contacts/${c.id}`,
        full_name: `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim(),
        current_title: c.jobTitle?.title ?? "",
        current_company: c.company?.name ?? "",
        industry: Array.isArray(c.jobTitle?.departments) ? c.jobTitle.departments[0] : null,
        location,
        country: loc.country ?? null,
        languages: [],
        linkedin_url: linkedin,
        email: null,
        phone: null,
        skills: [],
        experience_years: null,
        seniority: c.jobTitle?.seniority ?? null,
      };
    });
    console.log(`[lusha] returned ${candidates.length} raw candidates`);
    return { candidates };
  } catch (e) {
    return { candidates: [], error: e instanceof Error ? e.message : "Network error" };
  }
}

// ---------------- Hard pre-ranking filters --------------------------------
function tokenize(s: string): string[] {
  return (s ?? "").toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length >= 3);
}

function passesHardFilters(c: UnifiedCandidate, criteria: Criteria, requiredCountries: string[]): boolean {
  // Title: at least one criterion title keyword present
  const titleTokens = new Set(tokenize(c.current_title));
  const wantedTitleTokens = (criteria.role_titles ?? []).flatMap(tokenize);
  if (wantedTitleTokens.length) {
    const titleOk = wantedTitleTokens.some((t) => titleTokens.has(t));
    if (!titleOk) return false;
  }
  // Country: must intersect requested countries (when any criteria locations supplied)
  if (requiredCountries.length) {
    const candCountryCode =
      (c.country ? COUNTRY_TO_ALPHA2[c.country.toLowerCase()] : null) ??
      (c.location ? locationsToCountryCodes([c.location])[0] : null);
    if (!candCountryCode || !requiredCountries.includes(candCountryCode)) return false;
  }
  // Industry: only filter when both sides have signal
  const wantedIndustryTokens = (criteria.industries ?? []).flatMap(tokenize);
  if (wantedIndustryTokens.length) {
    const haystack = `${c.industry ?? ""} ${c.current_company ?? ""} ${(c.skills ?? []).join(" ")}`.toLowerCase();
    const industryOk = wantedIndustryTokens.some((t) => haystack.includes(t));
    if (!industryOk) return false;
  }
  return true;
}

// ---------------- OpenAI scoring ------------------------------------------
async function scoreWithOpenAI(criteria: Criteria, candidates: UnifiedCandidate[]): Promise<UnifiedCandidate[]> {
  const key = Deno.env.get("OPENAI_API_KEY");
  if (!key || candidates.length === 0) return candidates;

  const slim = candidates.map((c, i) => ({
    i, name: c.full_name, title: c.current_title, company: c.current_company,
    industry: c.industry, location: c.location, skills: c.skills.slice(0, 10),
    years: c.experience_years, seniority: c.seniority, source: c.source,
  }));

  const schema = {
    type: "object", additionalProperties: false,
    properties: {
      scored: {
        type: "array",
        items: {
          type: "object", additionalProperties: false,
          properties: {
            i: { type: "integer" },
            matchScore: { type: "integer", minimum: 0, maximum: 100 },
            matchReasons: { type: "array", items: { type: "string" }, minItems: 3, maxItems: 6 },
          },
          required: ["i", "matchScore", "matchReasons"],
        },
      },
    },
    required: ["scored"],
  };

  const system = `You are a senior recruitment match-scoring engine. Score each candidate 0-100 against the search criteria.
Heavy weight to: Industry Match, Language Match (when languages are required), Operational/Functional fit, Seniority, Location, Skills, Experience.
Be honest and strict — penalise mismatches in industry, language, or seniority. Do NOT inflate scores.

Return 3-6 concise recruiter-grade reasons per candidate, each:
- prefixed "✓ " when the candidate clearly meets the criterion (e.g. "✓ Operations Management", "✓ Commodity Trading", "✓ UAE Experience", "✓ Russian Speaker")
- prefixed "✗ " when a clear gap is identified (e.g. "✗ Missing Russian language")
Use only data provided; never invent skills or languages.`;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0,
        messages: [
          { role: "system", content: system },
          { role: "user", content: `Search criteria:\n${JSON.stringify(criteria)}\n\nCandidates:\n${JSON.stringify(slim)}` },
        ],
        response_format: { type: "json_schema", json_schema: { name: "scored", strict: true, schema } },
      }),
    });
    const text = await res.text();
    if (!res.ok) { console.error("[score] OpenAI error", res.status, text.slice(0, 300)); return candidates; }
    const data = JSON.parse(text);
    const parsed = JSON.parse(data?.choices?.[0]?.message?.content ?? "{}");
    const scored: { i: number; matchScore: number; matchReasons: string[] }[] = parsed.scored ?? [];
    const byIdx = new Map(scored.map((s) => [s.i, s]));
    return candidates.map((c, i) => {
      const s = byIdx.get(i);
      return s ? { ...c, matchScore: s.matchScore, matchReasons: s.matchReasons } : c;
    });
  } catch (e) {
    console.error("[score] failed", e);
    return candidates;
  }
}

// ---------------- Multi-pass search strategy ------------------------------
function uniq<T>(arr: T[]): T[] { return Array.from(new Set(arr)); }

interface SearchPass {
  id: string;
  label: string;
  boolean: string;
  criteria: Criteria;
}

function buildBoolean(titles: string[], extras: string[] = []): string {
  const titlePart = titles.length ? `(${titles.map((t) => `"${t}"`).join(" OR ")})` : "";
  const extraPart = extras.length ? extras.map((e) => `"${e}"`).join(" AND ") : "";
  return [titlePart, extraPart].filter(Boolean).join(" AND ");
}

function buildSearchPasses(base: Criteria): SearchPass[] {
  const titles = (base.role_titles ?? []).filter(Boolean);
  const industries = (base.industries ?? []).filter(Boolean);
  const locations = (base.locations ?? []);
  const languages = (base.languages ?? []);

  // Title variants: original + sibling roles
  const root = titles[0] ?? "";
  const titleSets: string[][] = [];
  if (titles.length) titleSets.push(titles);
  if (root) {
    const sibling = root.includes("Manager")
      ? [root, root.replace("Manager", "Specialist"), root.replace("Manager", "Executive")]
      : [root, `Head of ${root.replace(/^Head of /i, "")}`, `${root} Lead`];
    titleSets.push(uniq(sibling));
  }

  const passes: SearchPass[] = [];

  // Pass 1: title + industry + location (full)
  passes.push({
    id: "p1",
    label: "Pass 1: Title + Industry + Location",
    boolean: buildBoolean(titleSets[0] ?? [], [...industries, ...locations, ...languages]),
    criteria: base,
  });

  // Pass 2: sibling titles + same filters
  if (titleSets[1]) {
    passes.push({
      id: "p2",
      label: "Pass 2: Sibling Titles",
      boolean: buildBoolean(titleSets[1], [...industries, ...locations]),
      criteria: { ...base, role_titles: titleSets[1] },
    });
  }

  // Pass 3..N: title + each industry individually (no location)
  industries.slice(0, 3).forEach((ind, i) => {
    passes.push({
      id: `p${3 + i}`,
      label: `Pass ${3 + i}: Title + ${ind}`,
      boolean: buildBoolean(titleSets[0] ?? [], [ind]),
      criteria: { ...base, industries: [ind], locations: [] },
    });
  });

  return passes.slice(0, 5);
}

function buildBroaderPasses(base: Criteria): SearchPass[] {
  const titles = base.role_titles ?? [];
  const industries = base.industries ?? [];
  return [
    {
      id: "b1",
      label: "Broaden: drop location",
      boolean: buildBoolean(titles, industries),
      criteria: { ...base, locations: [] },
    },
    {
      id: "b2",
      label: "Broaden: industries only",
      boolean: buildBoolean([], industries),
      criteria: { ...base, role_titles: [], locations: [] },
    },
    {
      id: "b3",
      label: "Broaden: title only",
      boolean: buildBoolean(titles),
      criteria: { ...base, industries: [], locations: [] },
    },
  ];
}

interface ProviderRow {
  provider: "lusha" | "vibe_prospecting";
  api_key_encrypted: string;
  api_key_iv: string;
}

async function runPass(
  pass: SearchPass,
  providers: ProviderRow[],
  perProvider: number,
  errors: Record<string, string>,
): Promise<UnifiedCandidate[]> {
  const results = await Promise.allSettled(providers.map(async (row) => {
    const key = await decryptKey(row.api_key_encrypted, row.api_key_iv);
    const r = row.provider === "lusha"
      ? await searchLusha(key, pass.criteria, perProvider)
      : await searchVibe(key, pass.criteria, perProvider);
    if (r.error) {
      // Don't abort: record the failure and continue with whatever did come back.
      errors[row.provider] = r.error;
      console.warn(`[search][${pass.id}] ${row.provider} unavailable: ${r.error}`);
    }
    return r.candidates;
  }));
  return results.flatMap((r) => r.status === "fulfilled" ? r.value : []);
}

// ---------------- Handler -------------------------------------------------
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: profile } = await admin.from("profiles").select("tenant_id").eq("id", userData.user.id).maybeSingle();
    if (!profile?.tenant_id) return json({ error: "No tenant" }, 403);
    const tenantId = profile.tenant_id as string;

    const body = await req.json().catch(() => ({}));
    const criteria = (body.criteria ?? {}) as Criteria;
    const perProviderLimit = Math.min(50, Math.max(10, Number(body.limit ?? 25)));
    console.log("[search] criteria", JSON.stringify(criteria));

    const { data: integrations } = await admin
      .from("candidate_source_integrations")
      .select("provider,status,api_key_encrypted,api_key_iv")
      .eq("tenant_id", tenantId)
      .eq("status", "connected");

    const connected = (integrations ?? []) as ProviderRow[];
    console.log(`[search] connected providers: ${connected.map((i) => i.provider).join(", ") || "none"}`);

    if (connected.length === 0) {
      return json({
        candidates: [], errors: {}, queries: [],
        message: "No candidate source is connected. Connect Lusha or Vibe Prospecting in Settings → Integrations.",
      });
    }

    const errors: Record<string, string> = {};
    const passes = buildSearchPasses(criteria);
    const requiredCountries = locationsToCountryCodes(criteria.locations);

    // Run primary passes
    let pool: UnifiedCandidate[] = [];
    const ranQueries: { id: string; label: string; boolean: string; raw: number }[] = [];

    for (const pass of passes) {
      const got = await runPass(pass, connected, perProviderLimit, errors);
      ranQueries.push({ id: pass.id, label: pass.label, boolean: pass.boolean, raw: got.length });
      pool = pool.concat(got);
    }

    // Dedupe
    const dedupe = (arr: UnifiedCandidate[]) => {
      const seen = new Set<string>();
      return arr.filter((c) => {
        const k = (c.linkedin_url || `${c.full_name}|${c.current_company}`).toLowerCase();
        if (seen.has(k)) return false;
        seen.add(k); return true;
      });
    };
    pool = dedupe(pool);
    let hardFiltered = pool.filter((c) => passesHardFilters(c, criteria, requiredCountries));
    console.log(`[search] primary passes: raw=${pool.length} hard=${hardFiltered.length}`);

    // Auto-broaden if too few matches
    if (hardFiltered.length < 5) {
      const broader = buildBroaderPasses(criteria);
      for (const pass of broader) {
        const got = await runPass(pass, connected, perProviderLimit, errors);
        ranQueries.push({ id: pass.id, label: pass.label, boolean: pass.boolean, raw: got.length });
        pool = dedupe(pool.concat(got));
        hardFiltered = pool.filter((c) => passesHardFilters(c, pass.criteria, locationsToCountryCodes(pass.criteria.locations)));
        if (hardFiltered.length >= 10) break;
      }
      console.log(`[search] after broadening: raw=${pool.length} hard=${hardFiltered.length}`);
    }

    // Score with OpenAI
    const scored = await scoreWithOpenAI(criteria, hardFiltered.slice(0, 100));

    const final = scored
      .filter((c) => (c.matchScore ?? 0) >= 60)
      .sort((a, b) => (b.matchScore ?? 0) - (a.matchScore ?? 0));

    console.log(`[search] returning ${final.length} candidates (>=60%) from ${scored.length} scored`);

    return json({
      candidates: final,
      errors,
      queries: ranQueries,
      stats: { raw: pool.length, after_hard_filters: hardFiltered.length, returned: final.length },
      message: final.length
        ? null
        : (Object.keys(errors).length
            ? `Search ran across ${ranQueries.length} strategies but no candidates met the 60% relevance bar. Provider issues: ${Object.entries(errors).map(([p, e]) => `${p}: ${e}`).join("; ")}`
            : `Search ran across ${ranQueries.length} strategies but no candidates met the 60% relevance bar. Try broadening the criteria.`),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    console.error("[search] error", msg);
    // Always return 200 so the client can render fallback UI
    return json({ candidates: [], errors: { server: msg }, queries: [], message: msg });
  }
});
