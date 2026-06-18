// Candidate Source Integrations: Lusha & Vibe Prospecting
// Owner/Manager can manage; Recruiters can read status only.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

type Provider = "lusha" | "vibe_prospecting";

async function getKey(): Promise<CryptoKey> {
  // Reuse the Apollo encryption secret to avoid configuring a second key.
  const raw = Deno.env.get("APOLLO_ENCRYPTION_KEY") ?? "";
  if (!raw) throw new Error("APOLLO_ENCRYPTION_KEY not configured");
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  return crypto.subtle.importKey("raw", hash, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}
function b64(buf: ArrayBuffer | Uint8Array) {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = ""; for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}
function fromB64(s: string) {
  const bin = atob(s); const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
async function encrypt(plain: string) {
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(plain));
  return { ct: b64(ct), iv: b64(iv) };
}

async function testLusha(apiKey: string) {
  try {
    // Lush v2 contact search is a cheap auth probe
    const res = await fetch("https://api.lusha.com/v2/person", {
      method: "POST",
      headers: { "api_key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ contacts: [{ contactId: "probe", linkedinUrl: "https://www.linkedin.com/in/williamhgates" }] }),
    });
    if (res.status === 401 || res.status === 403) {
      const t = await res.text().catch(() => "");
      return { ok: false, error: `Lusha rejected the API key (${res.status})`, body: t.slice(0, 200) };
    }
    // 200, 400 (bad input but auth ok), 429 (rate-limited but valid key) all mean key is valid
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Network error" };
  }
}

async function testVibeProspecting(apiKey: string) {
  try {
    // Generic auth probe — Vibe Prospecting exposes /v1/account for key verification
    const res = await fetch("https://api.vibeprospecting.com/v1/account", {
      method: "GET",
      headers: { "Authorization": `Bearer ${apiKey}`, "Accept": "application/json" },
    });
    if (res.status === 401 || res.status === 403) {
      return { ok: false, error: `Vibe Prospecting rejected the API key (${res.status})` };
    }
    if (!res.ok && res.status !== 404) {
      return { ok: false, error: `Vibe Prospecting returned ${res.status}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Network error" };
  }
}

async function testProvider(provider: Provider, apiKey: string) {
  if (provider === "lusha") return await testLusha(apiKey);
  if (provider === "vibe_prospecting") return await testVibeProspecting(apiKey);
  return { ok: false, error: "Unknown provider" };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Unauthorized" }, 401);
    const userId = userData.user.id;

    const admin = createClient(supabaseUrl, serviceKey);

    const { data: profile } = await admin
      .from("profiles").select("tenant_id").eq("id", userId).maybeSingle();
    if (!profile?.tenant_id) return json({ error: "No tenant" }, 403);
    const tenantId = profile.tenant_id as string;

    const { data: roles } = await admin
      .from("user_roles").select("role").eq("user_id", userId).eq("tenant_id", tenantId);
    const roleSet = new Set((roles ?? []).map((r: { role: string }) => r.role));
    const isOwner = roleSet.has("owner");
    const isManager = roleSet.has("manager");
    const isRecruiter = roleSet.has("recruiter");
    if (!isOwner && !isManager && !isRecruiter) return json({ error: "Forbidden" }, 403);

    const body = await req.json().catch(() => ({}));
    const action = body.action as string;
    const provider = body.provider as Provider;
    if (!provider || (provider !== "lusha" && provider !== "vibe_prospecting")) {
      return json({ error: "Invalid provider" }, 400);
    }

    if (action === "status") {
      const { data } = await admin
        .from("candidate_source_integrations")
        .select("provider,status,last_tested_at,last_sync_at,last_error,api_key_last_four,connected_by,updated_at,capabilities")
        .eq("tenant_id", tenantId)
        .eq("provider", provider)
        .maybeSingle();
      return json({ integration: data ?? { provider, status: "disconnected" } });
    }

    if (!isOwner && !isManager) {
      return json({ error: "Only owners and managers can manage this integration" }, 403);
    }

    if (action === "save") {
      const apiKey = (body.apiKey ?? "").toString().trim();
      if (apiKey.length < 8) return json({ error: "API key looks invalid" }, 400);
      const test = await testProvider(provider, apiKey);
      const enc = await encrypt(apiKey);
      const now = new Date().toISOString();
      const row = {
        tenant_id: tenantId,
        provider,
        api_key_encrypted: enc.ct,
        api_key_iv: enc.iv,
        api_key_last_four: apiKey.slice(-4),
        status: test.ok ? "connected" : "error",
        last_tested_at: now,
        last_sync_at: test.ok ? now : null,
        last_error: test.ok ? null : test.error ?? "Unknown error",
        connected_by: userId,
        capabilities: {},
      };
      const { error } = await admin
        .from("candidate_source_integrations")
        .upsert(row, { onConflict: "tenant_id,provider" });
      if (error) return json({ error: error.message }, 500);
      return json({ ok: test.ok, status: row.status, error: row.last_error });
    }

    if (action === "test") {
      const { data: row } = await admin
        .from("candidate_source_integrations")
        .select("api_key_encrypted,api_key_iv")
        .eq("tenant_id", tenantId).eq("provider", provider).maybeSingle();
      if (!row?.api_key_encrypted) return json({ ok: false, error: "Not connected" }, 400);
      const key = await getKey();
      const pt = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: fromB64(row.api_key_iv) },
        key,
        fromB64(row.api_key_encrypted),
      );
      const apiKey = new TextDecoder().decode(pt);
      const test = await testProvider(provider, apiKey);
      const now = new Date().toISOString();
      await admin.from("candidate_source_integrations").update({
        status: test.ok ? "connected" : "error",
        last_tested_at: now,
        last_sync_at: test.ok ? now : undefined,
        last_error: test.ok ? null : test.error ?? "Unknown error",
      }).eq("tenant_id", tenantId).eq("provider", provider);
      return json({ ok: test.ok, error: test.error });
    }

    if (action === "disconnect") {
      const { error } = await admin
        .from("candidate_source_integrations")
        .delete().eq("tenant_id", tenantId).eq("provider", provider);
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Server error" }, 500);
  }
});
