// Apollo Integration: save / test / disconnect / status
// Owner only for mutations. Owner/Manager for status. Stores API key AES-GCM encrypted.
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

async function getKey(): Promise<CryptoKey> {
  const raw = Deno.env.get("APOLLO_ENCRYPTION_KEY") ?? "";
  if (!raw) throw new Error("APOLLO_ENCRYPTION_KEY not configured");
  // Derive a 256-bit key from the secret via SHA-256
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  return crypto.subtle.importKey("raw", hash, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

function b64(buf: ArrayBuffer | Uint8Array) {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}
function fromB64(s: string) {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function encrypt(plain: string) {
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(plain));
  return { ct: b64(ct), iv: b64(iv) };
}
async function decrypt(ct: string, iv: string) {
  const key = await getKey();
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromB64(iv) }, key, fromB64(ct));
  return new TextDecoder().decode(pt);
}

async function testApolloKey(apiKey: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch("https://api.apollo.io/v1/auth/health", {
      method: "GET",
      headers: { "Cache-Control": "no-cache", "Content-Type": "application/json", "X-Api-Key": apiKey },
    });
    if (!res.ok) return { ok: false, error: `Apollo returned ${res.status}` };
    const data = await res.json().catch(() => ({}));
    if (data && data.is_logged_in === false) return { ok: false, error: "Apollo rejected the API key" };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Network error" };
  }
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

    // Resolve tenant + role
    const { data: profile } = await admin
      .from("profiles")
      .select("tenant_id")
      .eq("id", userId)
      .maybeSingle();
    if (!profile?.tenant_id) return json({ error: "No tenant" }, 403);
    const tenantId = profile.tenant_id as string;

    const { data: roles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("tenant_id", tenantId);
    const roleSet = new Set((roles ?? []).map((r: any) => r.role));
    const isOwner = roleSet.has("owner");
    const isManager = roleSet.has("manager");
    if (!isOwner && !isManager) return json({ error: "Forbidden" }, 403);

    const body = await req.json().catch(() => ({}));
    const action = body.action as string;

    if (action === "status") {
      const { data } = await admin
        .from("apollo_integrations")
        .select("status,last_tested_at,last_error,api_key_last_four,connected_by,updated_at")
        .eq("tenant_id", tenantId)
        .maybeSingle();
      return json({ integration: data ?? { status: "disconnected" } });
    }

    if (!isOwner) return json({ error: "Only the workspace owner can manage this integration" }, 403);

    if (action === "save") {
      const apiKey = (body.apiKey ?? "").toString().trim();
      if (apiKey.length < 10) return json({ error: "API key looks invalid" }, 400);
      const test = await testApolloKey(apiKey);
      const enc = await encrypt(apiKey);
      const last4 = apiKey.slice(-4);
      const row = {
        tenant_id: tenantId,
        api_key_encrypted: enc.ct,
        api_key_iv: enc.iv,
        api_key_last_four: last4,
        status: test.ok ? "connected" : "error",
        last_tested_at: new Date().toISOString(),
        last_error: test.ok ? null : test.error ?? "Unknown error",
        connected_by: userId,
      };
      const { error } = await admin.from("apollo_integrations").upsert(row, { onConflict: "tenant_id" });
      if (error) return json({ error: error.message }, 500);
      return json({ ok: test.ok, status: row.status, error: row.last_error });
    }

    if (action === "test") {
      const { data: row } = await admin
        .from("apollo_integrations")
        .select("api_key_encrypted,api_key_iv")
        .eq("tenant_id", tenantId)
        .maybeSingle();
      if (!row?.api_key_encrypted) return json({ ok: false, error: "Not connected" }, 400);
      const apiKey = await decrypt(row.api_key_encrypted, row.api_key_iv);
      const test = await testApolloKey(apiKey);
      await admin
        .from("apollo_integrations")
        .update({
          status: test.ok ? "connected" : "error",
          last_tested_at: new Date().toISOString(),
          last_error: test.ok ? null : test.error ?? "Unknown error",
        })
        .eq("tenant_id", tenantId);
      return json({ ok: test.ok, error: test.error });
    }

    if (action === "disconnect") {
      const { error } = await admin.from("apollo_integrations").delete().eq("tenant_id", tenantId);
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Server error" }, 500);
  }
});
