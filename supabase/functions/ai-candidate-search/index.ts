// AI Candidate Search — queries real connected sources (Lusha, Vibe Prospecting)
// and scores the returned candidates with OpenAI. No synthetic candidates are
// ever produced. If no integration is connected, returns an empty result set
// with a clear message.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// ---------------- AES-GCM decrypt (same scheme as candidate-source-integration) ----
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

// ---------------- Common candidate shape ------------------------------------------
interface UnifiedCandidate {
  id: string;
  source: "Lusha" | "Vibe Prospecting";
  source_url?: string | null;
  full_name: string;
  current_title: string;
  current_company: string;
  industry?: string | null;
  location: string;
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

// ---------------- Vibe Prospecting (Explorium) search -----------------------------
const COUNTRY_TO_ALPHA2: Record<string, string> = {
  "united kingdom": "GB", uk: "GB", "great britain": "GB", england: "GB",
  "united states": "US", usa: "US", us: "US", america: "US",
  switzerland: "CH", germany: "DE", france: "FR", spain: "ES", italy: "IT",
  netherlands: "NL", ireland: "IE", "united arab emirates": "AE", uae: "AE",
  singapore: "SG", canada: "CA", australia: "AU", india: "IN", china: "CN",
  japan: "JP", brazil: "BR", poland: "PL", portugal: "PT", sweden: "SE",
  norway: "NO", denmark: "DK", finland: "FI", belgium: "BE", luxembourg: "LU",
  austria: "AT", "saudi arabia": "SA", qatar: "QA", "hong kong": "HK",
};
function locationsToCountryCodes(locations: string[] = []): string[] {
  const out = new Set<string>();
  for (const loc of locations) {
    const lower = loc.toLowerCase();
    for (const [name, code] of Object.entries(COUNTRY_TO_ALPHA2)) {
      if (lower.includes(name)) { out.add(code); break; }
    }
    // Direct alpha-2 like "UK", "US"
    const m = lower.match(/\b([a-z]{2})\b/);
    if (m && Object.values(COUNTRY_TO_ALPHA2).includes(m[1].toUpperCase())) {
      out.add(m[1].toUpperCase());
    }
  }
  return Array.from(out);
}
function seniorityToVibeLevels(seniority?: string | null): string[] {
  if (!seniority) return [];
  const s = seniority.toLowerCase();
  if (s.includes("intern") || s.includes("junior") || s.includes("entry")) return ["junior", "entry"];
  if (s.includes("mid")) return ["non-managerial", "senior non-managerial"];
  if (s.includes("senior") && !s.includes("manager")) return ["senior non-managerial", "senior manager"];
  if (s.includes("lead") || s.includes("manager")) return ["manager", "senior manager"];
  if (s.includes("director")) return ["director"];
  if (s.includes("vp") || s.includes("vice")) return ["vice president"];
  if (s.includes("head") || s.includes("chief") || s.includes("cxo") || s.includes("c-suite")) return ["c-suite"];
  return [];
}

async function searchVibe(apiKey: string, criteria: Criteria, size = 25): Promise<{ candidates: UnifiedCandidate[]; error?: string }> {
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
      const city = p.city ?? "";
      const region = p.region_name ?? "";
      const country = p.country_name ?? "";
      const location = [city, region, country].filter(Boolean).join(", ");
      return {
        id: `vibe-${p.prospect_id}`,
        source: "Vibe Prospecting",
        source_url: p.linkedin || (Array.isArray(p.linkedin_url_array) ? p.linkedin_url_array[0] : null),
        full_name: p.full_name || `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim(),
        current_title: p.job_title ?? "",
        current_company: p.company_name ?? "",
        industry: p.job_department_main ?? p.job_department ?? null,
        location,
        languages: [],
        linkedin_url: p.linkedin || (Array.isArray(p.linkedin_url_array) ? p.linkedin_url_array[0] : null),
        email: null, // Explorium returns hashed email only on this endpoint
        phone: null,
        skills: Array.isArray(p.skills) ? p.skills.slice(0, 12) : [],
        experience_years: Array.isArray(p.experience) && p.experience.length
          ? Math.max(0, Math.round(p.experience.reduce((acc: number, e: any) => acc + (e?.duration_months ?? 0), 0) / 12))
          : null,
        seniority: p.job_seniority_level ?? p.job_level_main ?? null,
      };
    });
    console.log(`[vibe] returned ${candidates.length} candidates`);
    return { candidates };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Network error";
    console.error("[vibe] error", msg);
    return { candidates: [], error: msg };
  }
}

// ---------------- Lusha Prospecting search ----------------------------------------
async function searchLusha(apiKey: string, criteria: Criteria, size = 25): Promise<{ candidates: UnifiedCandidate[]; error?: string }> {
  const include: Record<string, unknown> = {};
  if (criteria.role_titles?.length) include.jobTitles = criteria.role_titles.slice(0, 10);
  if (criteria.locations?.length) include.locations = criteria.locations.slice(0, 10).map((l) => ({ country: l }));
  if (criteria.seniority) include.seniority = [criteria.seniority];

  const body = {
    pages: { page: 0, size: Math.min(size, 40) },
    filters: { contacts: { include } },
  };
  try {
    const res = await fetch("https://api.lusha.com/prospecting/search", {
      method: "POST",
      headers: { "api_key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    if (!res.ok) {
      console.error("[lusha] search failed", res.status, text.slice(0, 400));
      return { candidates: [], error: `Lusha ${res.status}: ${text.slice(0, 200)}` };
    }
    const data = JSON.parse(text);
    const rows: any[] = data?.data ?? data?.contacts ?? [];
    const candidates: UnifiedCandidate[] = rows.map((c, i) => {
      const fullName = c.name?.full ?? `${c.name?.first ?? c.firstName ?? ""} ${c.name?.last ?? c.lastName ?? ""}`.trim();
      const location = [c.location?.city, c.location?.state, c.location?.country].filter(Boolean).join(", ") || c.location || "";
      return {
        id: `lusha-${c.contactId ?? c.id ?? i}`,
        source: "Lusha",
        source_url: c.linkedinUrl ?? c.linkedin ?? null,
        full_name: fullName,
        current_title: c.jobTitle ?? c.title ?? "",
        current_company: c.companyName ?? c.company?.name ?? "",
        industry: c.company?.industry ?? c.industry ?? null,
        location,
        languages: [],
        linkedin_url: c.linkedinUrl ?? c.linkedin ?? null,
        email: c.email ?? c.workEmail ?? null,
        phone: c.phone ?? c.phoneNumber ?? null,
        skills: [],
        experience_years: null,
        seniority: c.seniority ?? null,
      };
    });
    console.log(`[lusha] returned ${candidates.length} candidates`);
    return { candidates };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Network error";
    console.error("[lusha] error", msg);
    return { candidates: [], error: msg };
  }
}

// ---------------- OpenAI scoring --------------------------------------------------
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
            matchReasons: { type: "array", items: { type: "string" }, maxItems: 6 },
          },
          required: ["i", "matchScore", "matchReasons"],
        },
      },
    },
    required: ["scored"],
  };

  const system = `You are a recruitment match-scoring engine. Score each candidate 0-100 against the search criteria.
Weight: Industry Match, Language Match, Company Background, Skills Match, Seniority, Location, Experience.
Return short, concrete reasons (3-6) prefixed with "✓" for a match or "✗" for a clear gap. Examples:
"✓ Commodity Trading", "✓ UAE Experience", "✗ Missing Russian language".
Be honest — if criteria are not met, score lower. Use only the data provided; do not invent.`;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.1,
        messages: [
          { role: "system", content: system },
          { role: "user", content: `Criteria:\n${JSON.stringify(criteria)}\n\nCandidates:\n${JSON.stringify(slim)}` },
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

// ---------------- Handler ---------------------------------------------------------
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
    const limit = Math.min(50, Math.max(1, Number(body.limit ?? 25)));
    console.log("[search] criteria", JSON.stringify(criteria));

    const { data: integrations } = await admin
      .from("candidate_source_integrations")
      .select("provider,status,api_key_encrypted,api_key_iv")
      .eq("tenant_id", tenantId)
      .eq("status", "connected");

    const connected = integrations ?? [];
    console.log(`[search] connected providers: ${connected.map((i) => i.provider).join(", ") || "none"}`);

    if (connected.length === 0) {
      return json({
        candidates: [],
        errors: {},
        message: "No candidate source is connected. Connect Lusha or Vibe Prospecting in Settings → Integrations.",
      });
    }

    const errors: Record<string, string> = {};
    let all: UnifiedCandidate[] = [];

    await Promise.all(connected.map(async (row) => {
      try {
        const key = await decryptKey(row.api_key_encrypted as string, row.api_key_iv as string);
        const r = row.provider === "lusha"
          ? await searchLusha(key, criteria, limit)
          : await searchVibe(key, criteria, limit);
        if (r.error) errors[row.provider as string] = r.error;
        all = all.concat(r.candidates);
      } catch (e) {
        errors[row.provider as string] = e instanceof Error ? e.message : "Unknown error";
      }
    }));

    console.log(`[search] aggregated ${all.length} raw candidates`);

    // Dedupe by linkedin_url or normalized name+company
    const seen = new Set<string>();
    all = all.filter((c) => {
      const k = (c.linkedin_url || `${c.full_name}|${c.current_company}`).toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k); return true;
    });

    // Score with OpenAI
    const scored = await scoreWithOpenAI(criteria, all);
    scored.sort((a, b) => (b.matchScore ?? 0) - (a.matchScore ?? 0));

    return json({ candidates: scored, errors, message: scored.length ? null : "No matching candidates were returned by the connected sources." });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    console.error("[search] error", msg);
    return json({ error: msg }, 500);
  }
});
