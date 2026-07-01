// Apollo prospect search proxy. Owner/Manager/Recruiter can call (view-only).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

async function getKey() {
  const raw = Deno.env.get("APOLLO_ENCRYPTION_KEY") ?? "";
  if (!raw) throw new Error("APOLLO_ENCRYPTION_KEY not configured");
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  return crypto.subtle.importKey("raw", hash, { name: "AES-GCM" }, false, ["decrypt"]);
}
const fromB64 = (s: string) => {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};
async function decrypt(ct: string, iv: string) {
  const key = await getKey();
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromB64(iv) }, key, fromB64(ct));
  return new TextDecoder().decode(pt);
}

// Apollo employee count ranges
const EMPLOYEE_RANGES: Record<string, string> = {
  "1-10": "1,10",
  "11-50": "11,50",
  "51-200": "51,200",
  "201-500": "201,500",
  "501-1000": "501,1000",
  "1001-5000": "1001,5000",
  "5001-10000": "5001,10000",
  "10001+": "10001,1000000",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  let __meterAdmin: ReturnType<typeof createClient> | null = null;
  let __meterTenant: string | null = null;
  let __meterUser: string | null = null;
  let __meterReserved = false;
  const __meterFeatureKey = "ai_prospect_search";
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
    __meterAdmin = admin; __meterTenant = tenantId; __meterUser = userId;

    const { data: roles } = await admin
      .from("user_roles").select("role,tenant_id").eq("user_id", userId);
    const roleSet = new Set((roles ?? []).map((r: any) => r.role));
    const tenantRoleSet = new Set((roles ?? []).filter((r: any) => r.tenant_id === tenantId).map((r: any) => r.role));
    // Recruiters cannot run Apollo searches. Super Admin allowed only within their own tenant (demo workspace).
    const allowed = tenantRoleSet.has("owner") || tenantRoleSet.has("manager") || roleSet.has("super_admin");
    if (!allowed) {
      return json({ error: "Forbidden: Apollo search requires Owner or Manager role." }, 403);
    }

    // Server-side metering (Batch A / Phase 2)
    const __r = await admin.rpc("check_and_reserve_feature_usage", {
      _tenant_id: tenantId, _feature_key: __meterFeatureKey, _amount: 1, _user_id: userId,
    });
    if (__r.error) {
      const m = __r.error.message ?? "";
      if (m.includes("FEATURE_LIMIT_EXCEEDED")) {
        return new Response(JSON.stringify({
          error: `Plan limit reached for ${__meterFeatureKey}. Upgrade to continue.`,
          code: "FEATURE_LIMIT_EXCEEDED", feature_key: __meterFeatureKey, upgrade_required: true,
        }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      console.error("[meter] reserve error", m);
    } else { __meterReserved = true; }


    const encKey = Deno.env.get("APOLLO_ENCRYPTION_KEY");
    console.log("[apollo-search] tenant", tenantId, "hasEncKey", !!encKey);
    if (!encKey) return json({ error: "APOLLO_ENCRYPTION_KEY secret is not configured on the edge function." }, 500);

    const { data: row, error: rowErr } = await admin
      .from("apollo_integrations")
      .select("api_key_encrypted,api_key_iv,status,plan_tier,capabilities")
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (rowErr) {
      console.error("[apollo-search] integration lookup error", rowErr);
      return json({ error: `Integration lookup failed: ${rowErr.message}` }, 500);
    }
    console.log("[apollo-search] row", { hasRow: !!row, hasCt: !!row?.api_key_encrypted, hasIv: !!row?.api_key_iv, status: row?.status });
    if (!row?.api_key_encrypted || !row?.api_key_iv) {
      return json({ error: "Apollo is not connected. Ask an owner to set it up in Settings → Integrations." }, 400);
    }

    let apiKey: string;
    try {
      apiKey = await decrypt(row.api_key_encrypted, row.api_key_iv);
    } catch (decErr) {
      console.error("[apollo-search] decrypt failed", decErr);
      return json({ error: `Failed to decrypt Apollo API key. The APOLLO_ENCRYPTION_KEY may have changed since the key was saved. Reconnect Apollo in Settings → Integrations.` }, 500);
    }

    const body = await req.json().catch(() => ({}));
    const {
      keywords = "",
      industry = "",
      employeeRange = "",
      revenueMin,
      revenueMax,
      country = "",
      city = "",
      page = 1,
      perPage = 25,
      mode: requestedMode,
    } = body ?? {};

    const caps = (row.capabilities ?? {}) as { people_search?: boolean; org_search?: boolean };
    const planTier = (row.plan_tier ?? "unknown") as string;

    // Free plans cannot use any Apollo search endpoint — short-circuit with upgrade message.
    if (planTier === "free") {
      return json({
        error: "Prospect Search requires a paid Apollo subscription. Your connected Apollo account is on the Free plan, which does not include API search access. Upgrade your Apollo plan to continue.",
        apolloStatus: 403,
        planTier: "free",
        capabilities: caps,
        upgradeRequired: true,
      }, 200);
    }

    // Default: people search if allowed, else fall back to companies
    let mode: "people" | "companies" = requestedMode === "companies" || requestedMode === "people"
      ? requestedMode
      : (caps.people_search === false ? "companies" : "people");

    if (mode === "people" && caps.people_search === false) {
      return json({
        error: "Your Apollo plan does not support advanced people search. Showing companies instead, or upgrade your Apollo account.",
        apolloStatus: 403,
        planTier,
        capabilities: caps,
        fallback: "companies",
      }, 200);
    }


    const apolloBody: Record<string, unknown> = {
      page: Math.max(1, Number(page) || 1),
      per_page: Math.min(100, Math.max(1, Number(perPage) || 25)),
    };
    if (keywords) apolloBody.q_keywords = keywords;
    if (industry) apolloBody.q_organization_keyword_tags = [industry];
    if (employeeRange && EMPLOYEE_RANGES[employeeRange]) {
      apolloBody.organization_num_employees_ranges = [EMPLOYEE_RANGES[employeeRange]];
    }
    if (revenueMin || revenueMax) {
      apolloBody.revenue_range = { min: revenueMin ? Number(revenueMin) : undefined, max: revenueMax ? Number(revenueMax) : undefined };
    }
    const locations: string[] = [];
    if (city) locations.push(city);
    if (country) locations.push(country);
    if (locations.length) {
      if (mode === "people") apolloBody.person_locations = locations;
      else apolloBody.organization_locations = locations;
    }

    const endpoint = mode === "people"
      ? "https://api.apollo.io/v1/mixed_people/search"
      : "https://api.apollo.io/v1/mixed_companies/search";

    console.log("[apollo-search] mode", mode, "endpoint", endpoint, "body", JSON.stringify(apolloBody));
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Cache-Control": "no-cache", "X-Api-Key": apiKey },
      body: JSON.stringify(apolloBody),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      console.error("[apollo-search] Apollo non-2xx", res.status, txt.slice(0, 1000));
      let errCode: string | null = null;
      try { errCode = JSON.parse(txt)?.error_code ?? null; } catch { /* noop */ }
      // Detect plan-restriction and update cached capabilities + offer fallback
      if (res.status === 403 && (errCode === "API_INACCESSIBLE" || /not accessible/i.test(txt))) {
        const newCaps = { ...(caps as any), [mode === "people" ? "people_search" : "org_search"]: false };
        await admin.from("apollo_integrations")
          .update({ plan_tier: "free", capabilities: newCaps })
          .eq("tenant_id", tenantId);
        return json({
          error: "Prospect Search requires a paid Apollo subscription. Your Apollo account is on the Free plan and does not include API search access. Upgrade your Apollo plan to continue.",
          apolloStatus: 403,
          planTier: "free",
          capabilities: newCaps,
          upgradeRequired: true,
        }, 200);
      }

      return json({ error: `Apollo API ${res.status}: ${txt.slice(0, 500) || res.statusText}`, apolloStatus: res.status }, 200);
    }

    const data = await res.json();

    let people: any[] = [];
    let companies: any[] = [];

    if (mode === "people") {
      people = (data.people ?? data.contacts ?? []).map((p: any) => {
        const org = p.organization ?? {};
        return {
          id: p.id,
          first_name: p.first_name,
          last_name: p.last_name,
          name: p.name ?? `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim(),
          title: p.title ?? null,
          linkedin_url: p.linkedin_url ?? null,
          city: p.city ?? null,
          state: p.state ?? null,
          country: p.country ?? null,
          company: {
            id: org.id ?? null,
            name: org.name ?? null,
            website_url: org.website_url ?? null,
            linkedin_url: org.linkedin_url ?? null,
            industry: org.industry ?? null,
            estimated_num_employees: org.estimated_num_employees ?? null,
            city: org.city ?? null,
            country: org.country ?? null,
          },
        };
      });
    } else {
      companies = (data.organizations ?? data.accounts ?? []).map((o: any) => ({
        id: o.id,
        name: o.name ?? null,
        website_url: o.website_url ?? null,
        linkedin_url: o.linkedin_url ?? null,
        industry: o.industry ?? null,
        estimated_num_employees: o.estimated_num_employees ?? null,
        city: o.city ?? null,
        state: o.state ?? null,
        country: o.country ?? null,
        short_description: o.short_description ?? null,
      }));
    }

    const pagination = data.pagination ?? {};
    const totalEntries = pagination.total_entries ?? (mode === "people" ? people.length : companies.length);
    const result = {
      mode,
      planTier,
      capabilities: caps,
      people,
      companies,
      page: pagination.page ?? apolloBody.page,
      per_page: pagination.per_page ?? apolloBody.per_page,
      total_entries: totalEntries,
      total_pages: pagination.total_pages ?? 1,
    };

    await admin.from("lead_search_history").insert({
      tenant_id: tenantId,
      searched_by: userId,
      query_text: keywords || null,
      filters: { mode, industry, employeeRange, revenueMin, revenueMax, country, city },
      result_count: totalEntries,
    }).then(() => {}, () => {});

    return json(result);
  } catch (e) {
    const msg = e instanceof Error ? `${e.name}: ${e.message}\n${e.stack ?? ""}` : String(e);
    console.error("[apollo-search] fatal", msg);
    if (__meterReserved && __meterAdmin && __meterTenant) {
      try {
        await __meterAdmin.rpc("refund_feature_usage", {
          _tenant_id: __meterTenant, _feature_key: __meterFeatureKey,
          _amount: 1, _user_id: __meterUser, _reason: (e instanceof Error ? e.message : "err").slice(0, 200),
        });
      } catch (_) { /* noop */ }
    }
    return json({ error: e instanceof Error ? e.message : "Server error" }, 500);
  }

});
