// Manage tenant-owned API keys (Apollo, Lusha, Vibe) with AES-GCM at rest.
// Actions: list | save | test | disconnect
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { encryptSecret, decryptSecret, maskKey } from "../_shared/crypto.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PROVIDERS = new Set(["apollo", "lusha", "vibe"]);

async function testProvider(provider: string, apiKey: string): Promise<{ ok: boolean; detail?: string }> {
  try {
    if (provider === "apollo") {
      const r = await fetch("https://api.apollo.io/v1/auth/health", {
        method: "GET",
        headers: { "X-Api-Key": apiKey, "Cache-Control": "no-cache" },
      });
      return { ok: r.ok, detail: `HTTP ${r.status}` };
    }
    if (provider === "lusha") {
      const r = await fetch("https://api.lusha.com/person?email=test@example.com", {
        method: "GET",
        headers: { "api_key": apiKey },
      });
      // 401 = bad key, 200/404/422 = key accepted
      return { ok: r.status !== 401 && r.status !== 403, detail: `HTTP ${r.status}` };
    }
    if (provider === "vibe") {
      // Vibe Prospecting — generic auth ping
      const r = await fetch("https://api.vibeprospecting.com/v1/me", {
        method: "GET",
        headers: { "Authorization": `Bearer ${apiKey}` },
      });
      return { ok: r.status !== 401 && r.status !== 403, detail: `HTTP ${r.status}` };
    }
    return { ok: false, detail: "Unknown provider" };
  } catch (err) {
    return { ok: false, detail: (err as Error).message };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );

    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    const { data: userData } = await supabase.auth.getUser(token);
    const user = userData?.user;
    if (!user) throw new Error("Not authenticated");

    const { data: profile } = await supabase
      .from("profiles").select("tenant_id").eq("id", user.id).single();
    const tenantId = profile?.tenant_id;
    if (!tenantId) throw new Error("No tenant");

    const body = await req.json().catch(() => ({}));
    const action = body.action as string;
    const provider = (body.provider || "").toLowerCase();

    if (action === "list") {
      const { data, error } = await supabase
        .from("tenant_api_connections")
        .select("id, provider, status, last_tested_at, last_error, label, created_at, updated_at, key_hint")
        .eq("tenant_id", tenantId);
      if (error) throw error;
      return new Response(JSON.stringify({ connections: data ?? [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!PROVIDERS.has(provider)) throw new Error(`Invalid provider: ${provider}`);

    if (action === "save") {
      const apiKey = (body.apiKey || "").trim();
      if (!apiKey) throw new Error("apiKey required");

      const encrypted = await encryptSecret(apiKey);
      const hint = maskKey(apiKey);

      const { error } = await supabase
        .from("tenant_api_connections")
        .upsert({
          tenant_id: tenantId,
          provider,
          api_key_encrypted: encrypted,
          key_hint: hint,
          label: body.label ?? null,
          status: "pending",
          last_error: null,
          updated_at: new Date().toISOString(),
        }, { onConflict: "tenant_id,provider" });

      if (error) throw error;
      return new Response(JSON.stringify({ ok: true, key_hint: hint }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "test") {
      const { data: row, error } = await supabase
        .from("tenant_api_connections")
        .select("api_key_encrypted")
        .eq("tenant_id", tenantId).eq("provider", provider).single();
      if (error || !row?.api_key_encrypted) throw new Error("Connection not found");
      const apiKey = await decryptSecret(row.api_key_encrypted);
      const result = await testProvider(provider, apiKey);
      await supabase.from("tenant_api_connections").update({
        status: result.ok ? "connected" : "error",
        last_tested_at: new Date().toISOString(),
        last_error: result.ok ? null : (result.detail ?? "Unknown error"),
      }).eq("tenant_id", tenantId).eq("provider", provider);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "disconnect") {
      const { error } = await supabase
        .from("tenant_api_connections")
        .delete().eq("tenant_id", tenantId).eq("provider", provider);
      if (error) throw error;
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("Unknown action");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: msg }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
