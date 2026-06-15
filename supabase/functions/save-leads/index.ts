// Save Apollo prospects into lead_companies / lead_contacts. Dedupes per tenant.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

interface CompanyInput {
  name?: string | null;
  domain?: string | null;
  website?: string | null;
  linkedin_url?: string | null;
  industry?: string | null;
  employee_count?: number | null;
  city?: string | null;
  country?: string | null;
}
interface ContactInput {
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
  title?: string | null;
  email?: string | null;
  linkedin_url?: string | null;
  city?: string | null;
  country?: string | null;
}

const domainFromUrl = (url?: string | null) => {
  if (!url) return null;
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
};

async function findOrCreateCompany(
  admin: ReturnType<typeof createClient>,
  tenantId: string,
  userId: string,
  c: CompanyInput,
): Promise<{ id: string | null; created: boolean; skipped?: string }> {
  const name = (c.name ?? "").trim();
  if (!name) return { id: null, created: false, skipped: "missing company name" };
  const domain = (c.domain || domainFromUrl(c.website))?.toLowerCase() || null;

  // Lookup
  let existing: any = null;
  if (domain) {
    const { data } = await admin
      .from("lead_companies")
      .select("id")
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .ilike("domain", domain)
      .maybeSingle();
    existing = data;
  }
  if (!existing) {
    const { data } = await admin
      .from("lead_companies")
      .select("id")
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .ilike("name", name)
      .maybeSingle();
    existing = data;
  }
  if (existing) return { id: existing.id, created: false };

  const { data, error } = await admin
    .from("lead_companies")
    .insert({
      tenant_id: tenantId,
      created_by: userId,
      assigned_to: userId,
      name,
      domain,
      website: c.website ?? null,
      linkedin_url: c.linkedin_url ?? null,
      industry: c.industry ?? null,
      employee_count: c.employee_count ?? null,
      city: c.city ?? null,
      country: c.country ?? null,
      enrichment_source: "apollo",
      enriched_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error) return { id: null, created: false, skipped: error.message };
  return { id: data.id, created: true };
}

async function findOrCreateContact(
  admin: ReturnType<typeof createClient>,
  tenantId: string,
  userId: string,
  companyId: string | null,
  ct: ContactInput,
): Promise<{ id: string | null; created: boolean; skipped?: string }> {
  const email = ct.email?.toLowerCase() || null;
  const linkedin = ct.linkedin_url || null;
  if (!email && !linkedin && !ct.full_name) return { id: null, created: false, skipped: "no identifiers" };

  let existing: any = null;
  if (linkedin) {
    const { data } = await admin
      .from("lead_contacts")
      .select("id")
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .eq("linkedin_url", linkedin)
      .maybeSingle();
    existing = data;
  }
  if (!existing && email) {
    const { data } = await admin
      .from("lead_contacts")
      .select("id")
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .ilike("email", email)
      .maybeSingle();
    existing = data;
  }
  if (existing) {
    if (companyId) {
      await admin.from("lead_contacts").update({ company_id: companyId }).eq("id", existing.id).is("company_id", null);
    }
    return { id: existing.id, created: false };
  }

  const full_name = ct.full_name || [ct.first_name, ct.last_name].filter(Boolean).join(" ").trim() || null;
  const { data, error } = await admin
    .from("lead_contacts")
    .insert({
      tenant_id: tenantId,
      created_by: userId,
      assigned_to: userId,
      company_id: companyId,
      first_name: ct.first_name ?? null,
      last_name: ct.last_name ?? null,
      full_name,
      title: ct.title ?? null,
      email,
      linkedin_url: linkedin,
      city: ct.city ?? null,
      country: ct.country ?? null,
      enrichment_source: "apollo",
      enriched_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error) return { id: null, created: false, skipped: error.message };
  return { id: data.id, created: true };
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
    const { data: userData, error: uErr } = await userClient.auth.getUser();
    if (uErr || !userData.user) return json({ error: "Unauthorized" }, 401);
    const userId = userData.user.id;

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: profile } = await admin.from("profiles").select("tenant_id").eq("id", userId).maybeSingle();
    if (!profile?.tenant_id) return json({ error: "No tenant" }, 403);
    const tenantId = profile.tenant_id as string;

    // Role gate: recruiters cannot save leads.
    const { data: roles } = await admin.from("user_roles").select("role,tenant_id").eq("user_id", userId);
    const tenantRoles = new Set((roles ?? []).filter((r: any) => r.tenant_id === tenantId).map((r: any) => r.role));
    const isSuper = (roles ?? []).some((r: any) => r.role === "super_admin");
    if (!tenantRoles.has("owner") && !tenantRoles.has("manager") && !isSuper) {
      return json({ error: "Forbidden: Recruiters cannot save leads." }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const mode = body.mode as "company" | "contact" | "lead" | "leads";
    if (!mode) return json({ error: "Missing mode" }, 400);

    if (mode === "company") {
      const res = await findOrCreateCompany(admin, tenantId, userId, body.company ?? {});
      return json(res);
    }

    const items = (mode === "leads" ? body.items : [{ company: body.company, contact: body.contact }]) as Array<{
      company?: CompanyInput; contact?: ContactInput;
    }>;
    if (!Array.isArray(items) || items.length === 0) return json({ error: "No items" }, 400);

    let companiesCreated = 0, contactsCreated = 0, duplicates = 0, errors = 0;
    const details: any[] = [];
    for (const item of items) {
      const co = await findOrCreateCompany(admin, tenantId, userId, item.company ?? {});
      if (co.created) companiesCreated++; else if (co.id) duplicates += 0; // company dup doesn't count as lead skip
      if (!co.id && mode === "company") { errors++; details.push(co); continue; }

      if (mode === "contact" || mode === "lead" || mode === "leads") {
        const ct = await findOrCreateContact(admin, tenantId, userId, co.id, item.contact ?? {});
        if (ct.created) contactsCreated++;
        else if (ct.id) duplicates++;
        else errors++;
        details.push({ company: co, contact: ct });
      } else {
        details.push({ company: co });
      }
    }

    return json({ ok: true, companiesCreated, contactsCreated, duplicates, errors, details });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Server error" }, 500);
  }
});
