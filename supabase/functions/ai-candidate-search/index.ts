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
  source: "Lusha" | "Vibe Prospecting" | "Internal CRM";
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
  matchMissing?: string[];
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
function uniq<T>(arr: T[]): T[] { return Array.from(new Set(arr)); }

function cleanList(values: (string | null | undefined)[] = [], limit = 10): string[] {
  return uniq(values.map((v) => (v ?? "").trim()).filter(Boolean)).slice(0, limit);
}

function expandTitleFilters(criteria: Criteria): string[] {
  const titles = cleanList(criteria.role_titles ?? [], 8);
  const out = new Set(titles);
  for (const title of titles) {
    if (/operations?/i.test(title)) {
      ["Operations Manager", "Operations Specialist", "Operations Executive", "Head of Operations"].forEach((t) => out.add(t));
    }
    if (/manager/i.test(title)) {
      out.add(title.replace(/manager/ig, "Specialist"));
      out.add(title.replace(/manager/ig, "Executive"));
    }
  }
  return cleanList(Array.from(out), 10);
}

function expandIndustryFilters(criteria: Criteria): string[] {
  const values = [...(criteria.industries ?? []), ...(criteria.keywords ?? []), criteria.notes ?? ""];
  const text = values.join(" ").toLowerCase();
  const out = new Set(cleanList(criteria.industries ?? [], 10));
  if (/ship|maritime|freight|logistics|supply chain/.test(text)) ["Shipping", "Logistics", "Maritime", "Freight"].forEach((v) => out.add(v));
  if (/commod|trading|energy|oil|gas|metal|agri/.test(text)) ["Commodity Trading", "Commodities", "Trading", "Energy"].forEach((v) => out.add(v));
  return cleanList(Array.from(out), 10);
}

function expandLocationFilters(criteria: Criteria): string[] {
  const values = [...(criteria.locations ?? []), ...(criteria.languages ?? []), ...(criteria.keywords ?? []), criteria.notes ?? ""];
  const text = values.join(" ").toLowerCase();
  const out = new Set(cleanList(criteria.locations ?? [], 10));
  if (/uae|dubai|abu dhabi|emirates/.test(text)) ["UAE", "Dubai", "United Arab Emirates"].forEach((v) => out.add(v));
  if (/russia|russian/.test(text)) out.add("Russia");
  return cleanList(Array.from(out), 10);
}

// Location hierarchy: city -> metro -> state -> country. Used to broaden
// progressively rather than jumping straight to country.
interface LocationLevels { city?: string; metro?: string; state?: string; country?: string; }
const CITY_HIERARCHY: Record<string, LocationLevels> = {
  "san francisco": { city: "San Francisco", metro: "Bay Area", state: "California", country: "United States" },
  "oakland": { city: "Oakland", metro: "Bay Area", state: "California", country: "United States" },
  "san jose": { city: "San Jose", metro: "Bay Area", state: "California", country: "United States" },
  "palo alto": { city: "Palo Alto", metro: "Bay Area", state: "California", country: "United States" },
  "los angeles": { city: "Los Angeles", metro: "Greater Los Angeles", state: "California", country: "United States" },
  "new york": { city: "New York", metro: "New York Metropolitan Area", state: "New York", country: "United States" },
  "manhattan": { city: "New York", metro: "New York Metropolitan Area", state: "New York", country: "United States" },
  "chicago": { city: "Chicago", metro: "Chicagoland", state: "Illinois", country: "United States" },
  "boston": { city: "Boston", metro: "Greater Boston", state: "Massachusetts", country: "United States" },
  "seattle": { city: "Seattle", metro: "Puget Sound", state: "Washington", country: "United States" },
  "austin": { city: "Austin", state: "Texas", country: "United States" },
  "miami": { city: "Miami", state: "Florida", country: "United States" },
  "london": { city: "London", metro: "Greater London", country: "United Kingdom" },
  "manchester": { city: "Manchester", country: "United Kingdom" },
  "birmingham": { city: "Birmingham", country: "United Kingdom" },
  "dubai": { city: "Dubai", country: "United Arab Emirates" },
  "abu dhabi": { city: "Abu Dhabi", country: "United Arab Emirates" },
  "singapore": { city: "Singapore", country: "Singapore" },
  "hong kong": { city: "Hong Kong", country: "Hong Kong" },
  "zurich": { city: "Zurich", country: "Switzerland" },
  "geneva": { city: "Geneva", country: "Switzerland" },
  "berlin": { city: "Berlin", country: "Germany" },
  "frankfurt": { city: "Frankfurt", country: "Germany" },
  "munich": { city: "Munich", country: "Germany" },
  "paris": { city: "Paris", country: "France" },
  "amsterdam": { city: "Amsterdam", country: "Netherlands" },
  "moscow": { city: "Moscow", country: "Russia" },
  "mumbai": { city: "Mumbai", country: "India" },
  "bangalore": { city: "Bangalore", country: "India" },
  "sydney": { city: "Sydney", country: "Australia" },
  "toronto": { city: "Toronto", country: "Canada" },
};
function resolveLocation(raw: string): LocationLevels {
  const key = raw.toLowerCase().trim();
  if (CITY_HIERARCHY[key]) return CITY_HIERARCHY[key];
  for (const [k, v] of Object.entries(CITY_HIERARCHY)) {
    if (key.includes(k)) return v;
  }
  // No known city — treat as country.
  return { country: raw };
}
function locationLevelsForCriteria(criteria: Criteria): LocationLevels[] {
  return (criteria.locations ?? []).map(resolveLocation);
}

function toLushaLocationObjects(locations: string[]): Array<{ city?: string; state?: string; country?: string; continent?: string; countryGrouping?: string }> {
  return locations.map(resolveLocation).map((lvl) => {
    const obj: { city?: string; state?: string; country?: string } = {};
    if (lvl.city) obj.city = lvl.city;
    if (lvl.state) obj.state = lvl.state;
    if (lvl.country) obj.country = lvl.country;
    return obj;
  });
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
async function searchLusha(apiKey: string, criteria: Criteria, size = 50): Promise<SearchResult> {
  const include: Record<string, unknown> = {};
  const companyInclude: Record<string, unknown> = {};
  const titles = expandTitleFilters(criteria);
  if (titles.length) include.jobTitles = titles;

  const locationLabels = expandLocationFilters(criteria);
  const countryCodes = locationsToCountryCodes(locationLabels);
  if (countryCodes.length) include.countries = countryCodes;
  const locationObjects = toLushaLocationObjects(locationLabels);
  if (locationObjects.length) include.locations = locationObjects;

  const industries = expandIndustryFilters(criteria);
  const companySearchText = industries.length ? industries.join(", ") : null;
  if (companySearchText) companyInclude.searchText = companySearchText;
  const contactSearchTerms = cleanList([...(criteria.languages ?? []), ...(criteria.skills ?? []), ...(criteria.keywords ?? [])], 8);
  if (!titles.length && industries.length) contactSearchTerms.push(...industries.slice(0, 3));
  if (contactSearchTerms.length) include.searchText = cleanList(contactSearchTerms, 10).join(" ");

  if (criteria.seniority) {
    const s = criteria.seniority.toLowerCase();
    const map: Array<[string, string]> = [
      ["intern", "Intern"], ["junior", "Junior"], ["entry", "Entry"],
      ["manager", "Manager"], ["lead", "Manager"], ["senior", "Senior"], ["mid", "Senior"],
      ["director", "Director"], ["vp", "Vice President"], ["vice", "Vice President"],
      ["head", "Head"], ["chief", "Executive"], ["cxo", "Executive"],
    ];
    for (const [k, v] of map) { if (s.includes(k)) { include.searchText = cleanList([include.searchText as string | undefined, v], 10).join(" "); break; } }
  }

  const generatedFilters: LushaFilterDebug = {
    titles,
    industries,
    locations: locationLabels,
    countries: countryCodes,
    searchText: (include.searchText as string | undefined) ?? companySearchText,
  };

  // VALIDATE: Lusha requires at least one contact include filter before the API call.
  const hasValid =
    (include.jobTitles as unknown[] | undefined)?.length ||
    (include.countries as unknown[] | undefined)?.length ||
    (include.locations as unknown[] | undefined)?.length ||
    typeof include.searchText === "string";
  if (!hasValid) {
    const skipReason = "Lusha skipped: filters.contacts.include is empty after mapping criteria";
    console.warn("[lusha] skipping —", JSON.stringify({ ...generatedFilters, skipped: true, skipReason }));
    return { candidates: [], error: skipReason, debug: { generatedFilters: { ...generatedFilters, skipped: true, skipReason } } };
  }

  const body = {
    pagination: { page: 0, size: Math.min(size, 50) },
    filters: {
      contacts: { include },
      ...(Object.keys(companyInclude).length ? { companies: { include: companyInclude } } : {}),
    },
    options: { includePartialProfiles: true },
  };
  console.log("[lusha] generated filters:", JSON.stringify(generatedFilters));
  console.log("[lusha] exact request payload:", JSON.stringify(body));
  try {
    const res = await fetch("https://api.lusha.com/v3/contacts/prospecting", {
      method: "POST",
      headers: { "api_key": apiKey, "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    if (!res.ok) {
      console.error("[lusha] search failed", res.status, text.slice(0, 400));
      return { candidates: [], error: `Lusha ${res.status}: ${text.slice(0, 200)}`, debug: { generatedFilters, requestPayload: body } };
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
    return { candidates, debug: { generatedFilters, requestPayload: body } };
  } catch (e) {
    return { candidates: [], error: e instanceof Error ? e.message : "Network error", debug: { generatedFilters, requestPayload: body } };
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
            matched: { type: "array", items: { type: "string" }, minItems: 0, maxItems: 8 },
            missing: { type: "array", items: { type: "string" }, minItems: 0, maxItems: 6 },
          },
          required: ["i", "matchScore", "matched", "missing"],
        },
      },
    },
    required: ["scored"],
  };

  const system = `You are a senior recruitment match-scoring engine. Score each candidate 0-100 against the search criteria.
Heavy weight to: Industry Match, Language Match (when languages are required), Operational/Functional fit, Seniority, Location, Skills, Experience.
Be honest and strict — penalise mismatches in industry, language, or seniority. Do NOT inflate scores.

Return two short arrays per candidate:
- "matched": 3-8 criteria the candidate clearly meets (e.g. "Operations Management", "Commodity Trading", "UAE Experience", "Russian Speaker"). Plain text, no symbols.
- "missing": 0-6 criteria the candidate clearly lacks (e.g. "Russian language", "Freight experience"). Plain text, no symbols.
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
    const scored: { i: number; matchScore: number; matched: string[]; missing: string[] }[] = parsed.scored ?? [];
    const byIdx = new Map(scored.map((s) => [s.i, s]));
    return candidates.map((c, i) => {
      const s = byIdx.get(i);
      if (!s) return c;
      return {
        ...c,
        matchScore: s.matchScore,
        matchReasons: (s.matched ?? []).map((m) => `✓ ${m}`),
        matchMissing: s.missing ?? [],
      };
    });

  } catch (e) {
    console.error("[score] failed", e);
    return candidates;
  }
}

// ---------------- Multi-pass search strategy ------------------------------
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

type SearchMode = "strict" | "balanced" | "broad";

function locationHierarchyPasses(criteria: Criteria): { label: string; locations: string[] }[] {
  const levels = locationLevelsForCriteria(criteria);
  if (!levels.length) return [{ label: "Any location", locations: [] }];
  const tiers: { label: string; locations: string[] }[] = [];
  const cities = uniq(levels.map((l) => l.city).filter(Boolean) as string[]);
  const metros = uniq(levels.map((l) => l.metro).filter(Boolean) as string[]);
  const states = uniq(levels.map((l) => l.state).filter(Boolean) as string[]);
  const countries = uniq(levels.map((l) => l.country).filter(Boolean) as string[]);
  if (cities.length) tiers.push({ label: `City: ${cities.join(", ")}`, locations: cities });
  if (metros.length) tiers.push({ label: `Metro: ${metros.join(", ")}`, locations: metros });
  if (states.length) tiers.push({ label: `State: ${states.join(", ")}`, locations: states });
  if (countries.length) tiers.push({ label: `Country: ${countries.join(", ")}`, locations: countries });
  return tiers;
}

function buildSearchPasses(base: Criteria, mode: SearchMode = "balanced"): SearchPass[] {
  const titles = (base.role_titles ?? []).filter(Boolean);
  const industries = (base.industries ?? []).filter(Boolean);
  const languages = (base.languages ?? []);

  const root = titles[0] ?? "";
  const titleSets: string[][] = [];
  if (titles.length) titleSets.push(titles);
  if (root) {
    const sibling = root.includes("Manager")
      ? [root, root.replace("Manager", "Specialist"), root.replace("Manager", "Executive")]
      : [root, `Head of ${root.replace(/^Head of /i, "")}`, `${root} Lead`];
    titleSets.push(uniq(sibling));
  }

  const locTiers = locationHierarchyPasses(base);
  const passes: SearchPass[] = [];
  let n = 1;
  const tightLoc = locTiers[0];

  passes.push({
    id: `p${n}`,
    label: `Pass ${n}: ${tightLoc.label} + Titles + Industries`,
    boolean: buildBoolean(titleSets[0] ?? [], [...industries, ...tightLoc.locations, ...languages]),
    criteria: { ...base, locations: tightLoc.locations },
  });
  n++;

  if (mode === "strict") {
    for (const tier of locTiers.slice(1)) {
      passes.push({
        id: `p${n}`,
        label: `Pass ${n}: ${tier.label} + Titles`,
        boolean: buildBoolean(titleSets[0] ?? [], [...industries, ...tier.locations]),
        criteria: { ...base, locations: tier.locations },
      });
      n++;
    }
    return passes.slice(0, 4);
  }

  if (titleSets[1]) {
    passes.push({
      id: `p${n}`,
      label: `Pass ${n}: Sibling Titles + ${tightLoc.label}`,
      boolean: buildBoolean(titleSets[1], [...industries, ...tightLoc.locations]),
      criteria: { ...base, role_titles: titleSets[1], locations: tightLoc.locations },
    });
    n++;
  }

  for (const tier of locTiers.slice(1)) {
    passes.push({
      id: `p${n}`,
      label: `Pass ${n}: ${tier.label} + Titles`,
      boolean: buildBoolean(titleSets[0] ?? [], [...industries, ...tier.locations]),
      criteria: { ...base, locations: tier.locations },
    });
    n++;
  }

  if (mode === "broad") {
    industries.slice(0, 2).forEach((ind) => {
      passes.push({
        id: `p${n}`,
        label: `Pass ${n}: Title + ${ind}`,
        boolean: buildBoolean(titleSets[0] ?? [], [ind]),
        criteria: { ...base, industries: [ind], locations: [] },
      });
      n++;
    });
  }

  const cap = mode === "broad" ? 7 : 5;
  return passes.slice(0, cap);
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

// Internal CRM: search the tenant's own candidate database. Always runs (free) so
// recruiters still get results when external sources fail or credits are exhausted.
async function searchInternalCrm(admin: ReturnType<typeof createClient>, tenantId: string, criteria: Criteria, limit = 50): Promise<SearchResult> {
  try {
    let q = admin.from("candidates").select("*").eq("tenant_id", tenantId).limit(limit);
    const titles = (criteria.role_titles ?? []).filter(Boolean);
    if (titles.length) {
      const or = titles.map((t) => `current_title.ilike.%${t.replace(/[%,]/g, "")}%`).join(",");
      q = q.or(or);
    }
    const { data, error } = await q;
    if (error) return { candidates: [], error: error.message };
    const wantedLocs = (criteria.locations ?? []).map((l) => l.toLowerCase());
    const candidates: UnifiedCandidate[] = ((data ?? []) as Array<Record<string, unknown>>)
      .filter((r) => {
        if (!wantedLocs.length) return true;
        const loc = String(r.location ?? "").toLowerCase();
        return wantedLocs.some((w) => loc.includes(w));
      })
      .map((r) => ({
        id: `crm-${r.id}`,
        source: "Internal CRM" as const,
        source_url: r.linkedin_url ? String(r.linkedin_url) : null,
        full_name: String(r.full_name ?? ""),
        current_title: String(r.current_title ?? ""),
        current_company: String(r.current_company ?? ""),
        industry: null,
        location: String(r.location ?? ""),
        country: null,
        languages: [],
        linkedin_url: r.linkedin_url ? String(r.linkedin_url) : null,
        email: r.email ? String(r.email) : null,
        phone: r.phone ? String(r.phone) : null,
        skills: Array.isArray(r.skills) ? (r.skills as string[]).slice(0, 12) : [],
        experience_years: typeof r.experience_years === "number" ? r.experience_years : null,
        seniority: null,
      }));
    return { candidates };
  } catch (e) {
    return { candidates: [], error: e instanceof Error ? e.message : "CRM search failed" };
  }
}



interface ProviderPassDiagnostic {
  provider: "lusha" | "vibe_prospecting";
  records: number;
  error?: string;
  generatedFilters?: LushaFilterDebug;
  requestPayload?: unknown;
}

interface PassDiagnostic {
  id: string;
  label: string;
  boolean: string;
  raw: number;
  accepted: number;
  rejected: number;
  generatedFilters?: LushaFilterDebug;
  requestPayload?: unknown;
  providers: ProviderPassDiagnostic[];
}

async function runPass(
  pass: SearchPass,
  providers: ProviderRow[],
  perProvider: number,
  errors: Record<string, string>,
): Promise<{ candidates: UnifiedCandidate[]; providers: ProviderPassDiagnostic[] }> {
  const results = await Promise.all(providers.map(async (row): Promise<{ candidates: UnifiedCandidate[]; diagnostic: ProviderPassDiagnostic }> => {
    try {
      const key = await decryptKey(row.api_key_encrypted, row.api_key_iv);
      const r = row.provider === "lusha"
        ? await searchLusha(key, pass.criteria, perProvider)
        : await searchVibe(key, pass.criteria, perProvider);
    if (r.error) {
      // Don't abort: record the failure and continue with whatever did come back.
      errors[row.provider] = r.error;
      console.warn(`[search][${pass.id}] ${row.provider} unavailable: ${r.error}`);
    }
      return {
        candidates: r.candidates,
        diagnostic: {
          provider: row.provider,
          records: r.candidates.length,
          ...(r.error ? { error: r.error } : {}),
          ...(r.debug?.generatedFilters ? { generatedFilters: r.debug.generatedFilters } : {}),
          ...(r.debug?.requestPayload ? { requestPayload: r.debug.requestPayload } : {}),
        },
      };
    } catch (e) {
      const error = e instanceof Error ? e.message : "Provider search failed";
      errors[row.provider] = error;
      console.warn(`[search][${pass.id}] ${row.provider} unavailable: ${error}`);
      return { candidates: [], diagnostic: { provider: row.provider, records: 0, error } };
    }
  }));
  return {
    candidates: results.flatMap((r) => r.candidates),
    providers: results.map((r) => r.diagnostic),
  };
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
    const mode: SearchMode = (["strict", "balanced", "broad"].includes(body.mode) ? body.mode : "balanced") as SearchMode;
    console.log("[search] criteria", JSON.stringify(criteria), "mode=", mode);

    const { data: integrations } = await admin
      .from("candidate_source_integrations")
      .select("provider,status,api_key_encrypted,api_key_iv")
      .eq("tenant_id", tenantId)
      .eq("status", "connected");

    const connected = (integrations ?? []) as ProviderRow[];
    console.log(`[search] connected providers: ${connected.map((i) => i.provider).join(", ") || "none"} (+ internal CRM always)`);

    const errors: Record<string, string> = {};
    const passes = buildSearchPasses(criteria, mode);
    const requiredCountries = locationsToCountryCodes(criteria.locations);

    let pool: UnifiedCandidate[] = [];
    const ranQueries: PassDiagnostic[] = [];

    // Internal CRM runs once up-front against the full criteria — cheap, always on.
    try {
      const crm = await searchInternalCrm(admin, tenantId, criteria, 50);
      if (crm.error) errors["internal_crm"] = crm.error;
      pool = pool.concat(crm.candidates);
      ranQueries.push({
        id: "crm",
        label: "Internal CRM",
        boolean: "(tenant candidates)",
        raw: crm.candidates.length,
        accepted: crm.candidates.filter((c) => passesHardFilters(c, criteria, requiredCountries)).length,
        rejected: Math.max(0, crm.candidates.length - crm.candidates.filter((c) => passesHardFilters(c, criteria, requiredCountries)).length),
        providers: [{ provider: "internal_crm" as unknown as "lusha", records: crm.candidates.length, ...(crm.error ? { error: crm.error } : {}) }],
      });
    } catch (e) {
      console.warn("[search] internal CRM failed:", e);
    }

    for (const pass of passes) {

      const result = await runPass(pass, connected, perProviderLimit, errors);
      const accepted = result.candidates.filter((c) => passesHardFilters(c, pass.criteria, locationsToCountryCodes(pass.criteria.locations))).length;
      const lushaDebug = result.providers.find((p) => p.provider === "lusha");
      ranQueries.push({
        id: pass.id,
        label: pass.label,
        boolean: pass.boolean,
        raw: result.candidates.length,
        accepted,
        rejected: Math.max(0, result.candidates.length - accepted),
        ...(lushaDebug?.generatedFilters ? { generatedFilters: lushaDebug.generatedFilters } : {}),
        ...(lushaDebug?.requestPayload ? { requestPayload: lushaDebug.requestPayload } : {}),
        providers: result.providers,
      });
      const got = result.candidates;
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
        const result = await runPass(pass, connected, perProviderLimit, errors);
        const accepted = result.candidates.filter((c) => passesHardFilters(c, pass.criteria, locationsToCountryCodes(pass.criteria.locations))).length;
        const lushaDebug = result.providers.find((p) => p.provider === "lusha");
        ranQueries.push({
          id: pass.id,
          label: pass.label,
          boolean: pass.boolean,
          raw: result.candidates.length,
          accepted,
          rejected: Math.max(0, result.candidates.length - accepted),
          ...(lushaDebug?.generatedFilters ? { generatedFilters: lushaDebug.generatedFilters } : {}),
          ...(lushaDebug?.requestPayload ? { requestPayload: lushaDebug.requestPayload } : {}),
          providers: result.providers,
        });
        const got = result.candidates;
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
