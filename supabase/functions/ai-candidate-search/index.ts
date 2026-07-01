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
  source: "Apollo" | "Lusha" | "Vibe Prospecting" | "LinkedIn" | "Internal CRM" | "Open Web Discovery";
  source_url?: string | null;
  full_name: string;
  headline?: string | null;
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
  experience_summary?: string | null;
  education?: string | null;
  seniority?: string | null;
  confidence?: number | null;
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
  const out = new Set(cleanList(criteria.industries ?? [], 20));
  // Commodity trading family
  if (/commod|physical trad|trading desk|energy trad|oil trad|gas trad|metal|agri|grain|softs/.test(text)) {
    ["Commodity Trading", "Physical Trading", "Energy Trading", "Oil Trading", "Gas Trading", "Metals Trading", "Agricultural Trading"].forEach((v) => out.add(v));
  }
  // Shipping family
  if (/ship|maritime|charter|vessel|dry bulk|tanker|container|port operations/.test(text)) {
    ["Shipping", "Maritime", "Chartering", "Vessel Operations", "Dry Bulk", "Tanker", "Container Shipping"].forEach((v) => out.add(v));
  }
  // Freight & logistics family
  if (/freight|logistics|supply chain|forwarder|3pl|4pl|warehous/.test(text)) {
    ["Freight Forwarding", "Logistics", "Supply Chain", "Transportation"].forEach((v) => out.add(v));
  }
  return cleanList(Array.from(out), 20);
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
        linkedin_url: normalizeLinkedInUrlServer(linkedin),
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
        linkedin_url: normalizeLinkedInUrlServer(linkedin),
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

// ---------------- LinkedIn URL normalization ------------------------------
function normalizeLinkedInUrlServer(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== "string") return null;
  let s = raw.trim();
  if (!s) return null;
  const mdLabel = s.match(/^\[([^\]]+)\]\([^)]*\)$/i);
  if (mdLabel) s = mdLabel[1].trim();
  const md = s.match(/\((https?:[^)]+)\)/i);
  if (md) s = md[1];
  if (s.startsWith("//")) s = "https:" + s;
  if (/^linkedin\.com\//i.test(s)) s = s.replace(/^linkedin\.com\//i, "https://www.linkedin.com/");
  if (/^www\.linkedin\.com\//i.test(s)) s = s.replace(/^www\.linkedin\.com\//i, "https://www.linkedin.com/");
  if (/^[a-z]{2}\.linkedin\.com\//i.test(s)) s = s.replace(/^[a-z]{2}\.linkedin\.com\//i, "https://www.linkedin.com/");
  if (s.startsWith("/in/")) s = "https://www.linkedin.com" + s;
  let url: URL;
  try { url = new URL(s); } catch { return null; }
  if (!/(^|\.)linkedin\.com$/i.test(url.hostname)) return null;
  url.hostname = "www.linkedin.com";
  url.protocol = "https:";
  url.search = "";
  url.hash = "";
  const m = url.pathname.match(/^\/in\/([^/?#]+)\/?/i);
  if (!m) return null;
  url.pathname = `/in/${m[1]}`;
  return url.toString();
}

// ---------------- Hard pre-ranking filters --------------------------------
function tokenize(s: string): string[] {
  return (s ?? "").toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length >= 3);
}

type IndustryMode = "strict" | "preferred" | "open";

function isTransferableIndustry(c: UnifiedCandidate, criteria: Criteria): boolean {
  const wantedIndustryTokens = (criteria.industries ?? []).flatMap(tokenize);
  if (!wantedIndustryTokens.length) return false;
  const haystack = `${c.industry ?? ""} ${c.current_company ?? ""} ${(c.skills ?? []).join(" ")}`.toLowerCase();
  const directMatch = wantedIndustryTokens.some((t) => haystack.includes(t));
  return !directMatch; // cross-industry candidate that still passed title/location
}

function passesHardFilters(
  c: UnifiedCandidate,
  criteria: Criteria,
  requiredCountries: string[],
  industryMode: IndustryMode = "open",
): boolean {
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
  // Industry: SOFT signal by default. Only hard-filter when mode === "strict".
  if (industryMode === "strict") {
    const wantedIndustryTokens = (criteria.industries ?? []).flatMap(tokenize);
    if (wantedIndustryTokens.length) {
      const haystack = `${c.industry ?? ""} ${c.current_company ?? ""} ${(c.skills ?? []).join(" ")}`.toLowerCase();
      const industryOk = wantedIndustryTokens.some((t) => haystack.includes(t));
      if (!industryOk) return false;
    }
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

// ---------------- Open Web Discovery (recruiter-grade) --------------------
// Generates 10-20 search strategies by expanding titles, skills and location
// hierarchy, runs them in parallel batches, targets 100-500 raw profiles,
// dedupes by LinkedIn URL, AI-scores, and returns top 50-100 candidates.

// Title synonym families. Hits a token in any family -> add all members.
const TITLE_SYNONYM_FAMILIES: string[][] = [
  ["Software Engineer", "Software Developer", "Software Development Engineer", "SDE"],
  ["Backend Engineer", "Backend Developer", "Back-End Engineer", "Back-End Developer", "Server Engineer"],
  ["Frontend Engineer", "Frontend Developer", "Front-End Engineer", "Front-End Developer", "UI Engineer"],
  ["Full Stack Engineer", "Full Stack Developer", "Fullstack Engineer", "Fullstack Developer"],
  ["React Developer", "React Engineer", "ReactJS Developer", "React.js Developer"],
  ["Node Developer", "Node.js Developer", "NodeJS Developer", "Node Engineer"],
  ["Mobile Engineer", "Mobile Developer", "iOS Developer", "Android Developer", "React Native Developer"],
  ["Data Engineer", "Data Platform Engineer", "Analytics Engineer", "ETL Developer"],
  ["Data Scientist", "Applied Scientist", "Research Scientist"],
  ["Machine Learning Engineer", "ML Engineer", "AI Engineer", "MLOps Engineer", "Applied ML Engineer"],
  ["DevOps Engineer", "Site Reliability Engineer", "SRE", "Platform Engineer", "Cloud Engineer"],
  ["Security Engineer", "Application Security Engineer", "AppSec Engineer", "Cybersecurity Engineer"],
  ["QA Engineer", "Test Engineer", "SDET", "Quality Engineer", "Automation Engineer"],
  ["Product Manager", "Product Owner", "Technical Product Manager"],
  ["Project Manager", "Programme Manager", "Program Manager", "Delivery Manager"],
  ["Engineering Manager", "Tech Lead", "Technical Lead", "Lead Engineer", "Staff Engineer", "Principal Engineer"],
  ["Solutions Architect", "Software Architect", "Cloud Architect", "Enterprise Architect"],
  ["UX Designer", "Product Designer", "UI/UX Designer", "Interaction Designer"],
];

// Skill synonym dictionary.
const SKILL_SYNONYMS: Record<string, string[]> = {
  "react": ["React", "ReactJS", "React.js"],
  "reactjs": ["React", "ReactJS", "React.js"],
  "react.js": ["React", "ReactJS", "React.js"],
  "react native": ["React Native", "ReactNative"],
  "node": ["Node.js", "NodeJS", "Node"],
  "node.js": ["Node.js", "NodeJS", "Node"],
  "nodejs": ["Node.js", "NodeJS", "Node"],
  "javascript": ["JavaScript", "JS", "ECMAScript"],
  "typescript": ["TypeScript", "TS"],
  "python": ["Python", "Py"],
  "machine learning": ["Machine Learning", "ML", "ML Engineering", "Applied ML"],
  "ml": ["Machine Learning", "ML", "ML Engineering"],
  "ai": ["Artificial Intelligence", "AI", "Machine Learning"],
  "deep learning": ["Deep Learning", "Neural Networks", "DL"],
  "nlp": ["NLP", "Natural Language Processing", "LLM"],
  "llm": ["LLM", "Large Language Models", "Generative AI", "GenAI"],
  "aws": ["AWS", "Amazon Web Services"],
  "gcp": ["GCP", "Google Cloud", "Google Cloud Platform"],
  "azure": ["Azure", "Microsoft Azure"],
  "kubernetes": ["Kubernetes", "K8s"],
  "docker": ["Docker", "Containers"],
  "postgres": ["PostgreSQL", "Postgres"],
  "postgresql": ["PostgreSQL", "Postgres"],
  "graphql": ["GraphQL", "Apollo GraphQL"],
  "nextjs": ["Next.js", "NextJS"],
  "next.js": ["Next.js", "NextJS"],
  "vue": ["Vue", "Vue.js", "VueJS"],
  "angular": ["Angular", "AngularJS"],
  "django": ["Django"],
  "flask": ["Flask"],
  "spring": ["Spring", "Spring Boot"],
  ".net": [".NET", "dotnet", "C#"],
  "c#": ["C#", ".NET", "dotnet"],
  "golang": ["Go", "Golang"],
  "go": ["Go", "Golang"],
  "rust": ["Rust"],
  "java": ["Java", "JVM"],
  "kotlin": ["Kotlin"],
  "swift": ["Swift", "iOS"],
};

function expandTitleVariants(titles: string[]): string[] {
  const out = new Set<string>();
  for (const t of titles) {
    if (!t) continue;
    out.add(t);
    const low = t.toLowerCase();
    for (const family of TITLE_SYNONYM_FAMILIES) {
      if (family.some((f) => low.includes(f.toLowerCase()) || f.toLowerCase().includes(low))) {
        family.forEach((f) => out.add(f));
      }
    }
    if (/manager/i.test(t)) {
      out.add(t.replace(/manager/gi, "Lead"));
      out.add(t.replace(/manager/gi, "Specialist"));
      out.add(`Head of ${t.replace(/manager/gi, "").trim()}`);
    }
  }
  return Array.from(out).filter(Boolean).slice(0, 20);
}

function expandSkillVariants(skills: string[]): string[] {
  const out = new Set<string>();
  for (const s of skills) {
    if (!s) continue;
    out.add(s);
    const low = s.toLowerCase().trim();
    const syns = SKILL_SYNONYMS[low];
    if (syns) syns.forEach((v) => out.add(v));
  }
  return Array.from(out).filter(Boolean).slice(0, 25);
}

function expandLocationHierarchy(locations: string[]): string[] {
  const out = new Set<string>();
  for (const raw of locations) {
    if (!raw) continue;
    out.add(raw);
    const lvl = resolveLocation(raw);
    if (lvl.city) out.add(lvl.city);
    if (lvl.metro) out.add(lvl.metro);
    if (lvl.state) out.add(lvl.state);
    if (lvl.country) out.add(lvl.country);
  }
  return Array.from(out).filter(Boolean).slice(0, 10);
}

async function searchOpenWeb(
  criteria: Criteria,
  limit: number,
): Promise<{
  candidates: UnifiedCandidate[];
  error?: string;
  debug?: {
    query: string;
    passes: number;
    rawFound: number;
    deduped: number;
    scored: number;
    returned: number;
    titleVariants: number;
    skillVariants: number;
    locationLevels: number;
  };
}> {
  const key = Deno.env.get("OPENAI_API_KEY");
  if (!key) return { candidates: [], error: "OpenAI key not configured" };

  const rawTitles = (criteria.role_titles ?? []).filter(Boolean);
  const rawSkills = (criteria.skills ?? []).filter(Boolean);
  const rawLocations = (criteria.locations ?? []).filter(Boolean);
  const industries = (criteria.industries ?? []).filter(Boolean).slice(0, 4);

  const titles = expandTitleVariants(rawTitles);
  const skills = expandSkillVariants(rawSkills);
  const locations = expandLocationHierarchy(rawLocations);

  console.log(`[openweb] expanded: ${titles.length} titles, ${skills.length} skills, ${locations.length} locations`);

  // Build 10-20 strategies. Mix title-variants × location-tiers, layering skills.
  const strategies: { label: string; query: string }[] = [];
  const seenStrategies = new Set<string>();
  const pushStrategy = (label: string, parts: string[]) => {
    const q = ["site:linkedin.com/in", ...parts.filter(Boolean)].join(" ");
    if (seenStrategies.has(q)) return;
    seenStrategies.add(q);
    strategies.push({ label, query: q });
  };

  const titlePool = titles.length ? titles : [""];
  const locPool = locations.length ? locations : [""];
  const skillPool = skills.length ? skills : [""];

  // Strategy 1: title × location × top skill (the recruiter's primary intent)
  for (const t of titlePool.slice(0, 6)) {
    for (const loc of locPool.slice(0, 3)) {
      const sk = skillPool[0] ?? "";
      pushStrategy(
        `${t || "Any title"} @ ${loc || "anywhere"}${sk ? ` + ${sk}` : ""}`,
        [t ? `"${t}"` : "", loc ? `"${loc}"` : "", sk ? `"${sk}"` : ""],
      );
      if (strategies.length >= 20) break;
    }
    if (strategies.length >= 20) break;
  }
  // Strategy 2: title × skill variants (drop location)
  for (const t of titlePool.slice(0, 4)) {
    for (const sk of skillPool.slice(0, 3)) {
      pushStrategy(`${t || "Any title"} + ${sk || "skill"}`, [t ? `"${t}"` : "", sk ? `"${sk}"` : ""]);
      if (strategies.length >= 20) break;
    }
    if (strategies.length >= 20) break;
  }
  // Strategy 3: location × top skill (catch atypical titles)
  for (const loc of locPool.slice(0, 3)) {
    for (const sk of skillPool.slice(0, 2)) {
      pushStrategy(`${loc || "anywhere"} + ${sk || "skill"}`, [loc ? `"${loc}"` : "", sk ? `"${sk}"` : ""]);
      if (strategies.length >= 20) break;
    }
  }
  // Strategy 4: industry sweep
  for (const ind of industries.slice(0, 2)) {
    pushStrategy(`Industry: ${ind}`, [titlePool[0] ? `"${titlePool[0]}"` : "", `"${ind}"`]);
  }

  if (strategies.length === 0) {
    pushStrategy("Fallback", [...rawTitles, ...rawLocations, ...rawSkills].slice(0, 5).map((x) => `"${x}"`));
  }

  // Ensure we have at least 10
  while (strategies.length < 10 && strategies.length < titlePool.length * locPool.length * skillPool.length) {
    const t = titlePool[strategies.length % titlePool.length];
    const loc = locPool[(strategies.length + 1) % locPool.length];
    const sk = skillPool[(strategies.length + 2) % skillPool.length];
    pushStrategy(`Extra ${strategies.length + 1}`, [t ? `"${t}"` : "", loc ? `"${loc}"` : "", sk ? `"${sk}"` : ""]);
  }

  const RAW_TARGET = 100;
  const RAW_CAP = 500;
  const perPassLimit = 15;

  const system = `You are a senior recruitment sourcing assistant. Use web search to find REAL public LinkedIn profiles matching the boolean query.
Return up to ${perPassLimit} candidates per query. Each MUST have a real linkedin.com/in/<slug> URL.
PRIORITISE LinkedIn member profiles. AVOID job boards, blog posts, press releases, company pages.
For each candidate provide: full_name, headline, current_title, current_company, industry, location, profile_url, linkedin_url, skills[], experience_years (number if known), experience_summary, education, languages[], confidence (0-100), why.
Do NOT invent profiles. Return ONLY JSON wrapped in \`\`\`json fences:
{"candidates":[{"full_name":"","headline":"","current_title":"","current_company":"","industry":"","location":"","profile_url":"","linkedin_url":"","skills":[],"experience_years":0,"experience_summary":"","education":"","languages":[],"confidence":0,"why":""}]}`;

  async function runOne(query: string): Promise<UnifiedCandidate[]> {
    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gpt-4o-search-preview",
          messages: [
            { role: "system", content: system },
            { role: "user", content: `Boolean query:\n${query}\n\nCriteria context:\n${JSON.stringify({ titles: rawTitles, locations: rawLocations, skills: rawSkills, industries })}` },
          ],
        }),
      });
      const text = await res.text();
      if (!res.ok) { console.warn("[openweb] pass failed", res.status, text.slice(0, 200)); return []; }
      const data = JSON.parse(text);
      const content: string = data?.choices?.[0]?.message?.content ?? "";
      const m = content.match(/```json\s*([\s\S]+?)\s*```/i) ?? content.match(/(\{[\s\S]+\})/);
      if (!m) return [];
      const parsed = JSON.parse(m[1]);
      const raw: unknown[] = Array.isArray(parsed?.candidates) ? parsed.candidates : [];
      return raw.map((r, i) => {
        const o = r as Record<string, unknown>;
        const url = typeof o.profile_url === "string" ? o.profile_url : null;
        const liRaw = typeof o.linkedin_url === "string" ? o.linkedin_url : (url && url.includes("linkedin.com") ? url : null);
        const li = normalizeLinkedInUrlServer(liRaw);
        const conf = Math.max(0, Math.min(100, Number(o.confidence ?? 65)));
        const why = typeof o.why === "string" ? o.why : "";
        const skillsArr = Array.isArray(o.skills) ? (o.skills as unknown[]).map((s) => String(s)).filter(Boolean).slice(0, 15) : [];
        const languages = Array.isArray(o.languages) ? (o.languages as unknown[]).map((s) => String(s)).filter(Boolean).slice(0, 8) : [];
        const years = Number(o.experience_years);
        return {
          id: `openweb-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
          source: li ? "LinkedIn" : "Open Web Discovery",
          source_url: li ?? url,
          full_name: String(o.full_name ?? "").trim(),
          headline: typeof o.headline === "string" ? o.headline : null,
          current_title: String(o.current_title ?? "").trim(),
          current_company: String(o.current_company ?? "").trim(),
          industry: typeof o.industry === "string" ? o.industry : null,
          location: String(o.location ?? "").trim(),
          languages,
          linkedin_url: li,
          skills: skillsArr,
          experience_years: Number.isFinite(years) && years > 0 ? years : null,
          experience_summary: typeof o.experience_summary === "string" ? o.experience_summary : null,
          education: typeof o.education === "string" ? o.education : null,
          confidence: conf,
          matchScore: conf,
          matchReasons: why ? [`✓ ${why}`] : ["✓ Public web signal match"],
          matchMissing: [],
        } as UnifiedCandidate;
      }).filter((c) => c.full_name && (c.linkedin_url || c.source_url));
    } catch (e) {
      console.warn("[openweb] pass error", e instanceof Error ? e.message : e);
      return [];
    }
  }

  // Run in parallel batches of 5. Stop once we have RAW_TARGET deduped profiles
  // or all strategies are exhausted (whichever comes first), but never exceed RAW_CAP.
  const all: UnifiedCandidate[] = [];
  const seenUrls = new Set<string>();
  const dedupedRunning: UnifiedCandidate[] = [];
  const batchSize = 5;
  let passesRun = 0;
  for (let i = 0; i < strategies.length; i += batchSize) {
    const batch = strategies.slice(i, i + batchSize);
    const results = await Promise.all(batch.map((s) => runOne(s.query)));
    passesRun += batch.length;
    for (const r of results) {
      for (const c of r) {
        all.push(c);
        const k = (c.linkedin_url || `${c.full_name}|${c.current_company}`).toLowerCase();
        if (!seenUrls.has(k)) {
          seenUrls.add(k);
          dedupedRunning.push(c);
        }
      }
    }
    if (dedupedRunning.length >= RAW_TARGET || all.length >= RAW_CAP) break;
  }

  // Final sort by confidence (already AI-scored per-pass). Return top N.
  const returnLimit = Math.min(Math.max(50, limit), 100);
  const final = dedupedRunning
    .sort((a, b) => (b.matchScore ?? 0) - (a.matchScore ?? 0))
    .slice(0, returnLimit);

  console.log(`[openweb] strategies=${strategies.length} ran=${passesRun} raw=${all.length} deduped=${dedupedRunning.length} scored=${dedupedRunning.length} returned=${final.length}`);

  return {
    candidates: final,
    debug: {
      query: strategies.map((s) => s.label).join(" || "),
      passes: passesRun,
      rawFound: all.length,
      deduped: dedupedRunning.length,
      scored: dedupedRunning.length,
      returned: final.length,
      titleVariants: titles.length,
      skillVariants: skills.length,
      locationLevels: locations.length,
    },
  };
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
        linkedin_url: r.linkedin_url ? normalizeLinkedInUrlServer(String(r.linkedin_url)) : null,
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
  // Hoisted so the outer catch can refund on failure (Batch A / Phase 2).
  let __meterAdmin: ReturnType<typeof createClient> | null = null;
  let __meterTenant: string | null = null;
  let __meterUser: string | null = null;
  let __meterReserved = false;
  const __meterFeatureKey = "ai_candidate_discovery";
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
    __meterAdmin = admin; __meterTenant = tenantId; __meterUser = userData.user.id;

    // ── Server-side metering (Batch A / Phase 2) ───────────────────────────────
    // Atomically checks plan limit + reserves 1 unit of ai_candidate_discovery.
    // Respects platform_settings.enforce_plan_limits toggle: while OFF (default)
    // this only meters; when ON it blocks over-limit callers with 402.
    const __reserve = await admin.rpc("check_and_reserve_feature_usage", {
      _tenant_id: tenantId, _feature_key: __meterFeatureKey, _amount: 1, _user_id: userData.user.id,
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
        const k = (normalizeLinkedInUrlServer(c.linkedin_url ?? undefined) || `${c.full_name}|${c.current_company}`).toLowerCase();
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

    // ---- Open Web Discovery fallback -------------------------------------
    // Trigger when no external provider is connected, or every external
    // provider errored / returned zero records. Internal CRM hits don't count
    // as "external" for fallback purposes.
    const externalProviders = connected.filter((p) => p.provider !== "internal_crm");
    const externalCandidates = pool.filter((c) => c.source === "Lusha" || c.source === "Vibe Prospecting");
    const externalErrored = externalProviders.length > 0
      && externalProviders.every((p) => errors[p.provider]);
    const shouldFallback = externalProviders.length === 0
      || externalErrored
      || externalCandidates.length === 0;

    let openWebCandidates: UnifiedCandidate[] = [];
    let openWebDebug: NonNullable<Awaited<ReturnType<typeof searchOpenWeb>>["debug"]> | undefined;
    if (shouldFallback) {
      console.log("[search] triggering Open Web Discovery (recruiter-grade sourcing)");
      const ow = await searchOpenWeb(criteria, 100);
      if (ow.error) errors["open_web"] = ow.error;
      openWebCandidates = ow.candidates;
      openWebDebug = ow.debug;
      ranQueries.push({
        id: "openweb",
        label: `Open Web Discovery (${ow.debug?.passes ?? 0} strategies, ${ow.debug?.rawFound ?? 0} raw → ${ow.debug?.deduped ?? 0} unique)`,
        boolean: ow.debug?.query ?? "(web search)",
        raw: ow.debug?.rawFound ?? ow.candidates.length,
        accepted: ow.candidates.length,
        rejected: Math.max(0, (ow.debug?.rawFound ?? 0) - ow.candidates.length),
        providers: [{ provider: "open_web" as unknown as "lusha", records: ow.candidates.length, ...(ow.error ? { error: ow.error } : {}) }],
      });
    }

    // Score with OpenAI (provider results — open web already self-scored)
    const scored = await scoreWithOpenAI(criteria, hardFiltered.slice(0, 100));

    const final = [...scored, ...openWebCandidates]
      .filter((c) => (c.matchScore ?? 0) >= 60)
      .sort((a, b) => (b.matchScore ?? 0) - (a.matchScore ?? 0));

    console.log(`[search] returning ${final.length} candidates (>=60%) from ${scored.length} scored + ${openWebCandidates.length} open-web`);

    return json({
      candidates: final,
      errors,
      queries: ranQueries,
      stats: {
        raw: pool.length + (openWebDebug?.rawFound ?? 0),
        after_hard_filters: hardFiltered.length,
        returned: final.length,
        open_web: openWebDebug
          ? {
              strategies: openWebDebug.passes,
              title_variants: openWebDebug.titleVariants,
              skill_variants: openWebDebug.skillVariants,
              location_levels: openWebDebug.locationLevels,
              raw_profiles_found: openWebDebug.rawFound,
              profiles_deduped: openWebDebug.deduped,
              profiles_scored: openWebDebug.scored,
              profiles_returned: openWebDebug.returned,
            }
          : undefined,
      },
      message: final.length
        ? null
        : (Object.keys(errors).length
            ? `Search ran across ${ranQueries.length} strategies but no candidates met the 60% relevance bar. Provider issues: ${Object.entries(errors).map(([p, e]) => `${p}: ${e}`).join("; ")}`
            : `Search ran across ${ranQueries.length} strategies but no candidates met the 60% relevance bar. Try broadening the criteria.`),
    });

  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    console.error("[search] error", msg);
    // Refund reservation — failed requests must never consume quota.
    if (__meterReserved && __meterAdmin && __meterTenant) {
      try {
        await __meterAdmin.rpc("refund_feature_usage", {
          _tenant_id: __meterTenant, _feature_key: __meterFeatureKey,
          _amount: 1, _user_id: __meterUser, _reason: msg.slice(0, 200),
        });
      } catch (_) { /* noop */ }
    }
    // Always return 200 so the client can render fallback UI
    return json({ candidates: [], errors: { server: msg }, queries: [], message: msg });
  }
});
