import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { token, full_name, password } = await req.json();
    if (!token || !full_name || !password || password.length < 8) {
      return new Response(JSON.stringify({ error: "Invalid input" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    const { data: invitation } = await admin
      .from("client_invitations")
      .select("id, email, role, tenant_id, client_org_id, status, expires_at, invited_by")
      .eq("token", token)
      .eq("status", "pending")
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (!invitation) {
      return new Response(JSON.stringify({ error: "Invitation invalid or expired" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create or reuse auth user
    let userId: string | null = null;
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: invitation.email,
      password,
      email_confirm: true,
      user_metadata: { full_name, is_client_user: true },
    });

    if (createErr) {
      const msg = (createErr as any)?.message ?? "";
      if (/already|exists|duplicate/i.test(msg)) {
        // Find existing user
        const { data: list } = await admin.auth.admin.listUsers();
        const existing = list?.users?.find((u: any) => u.email?.toLowerCase() === invitation.email.toLowerCase());
        if (!existing) {
          return new Response(JSON.stringify({ error: "Account exists. Please sign in." }), {
            status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        userId = existing.id;
      } else {
        return new Response(JSON.stringify({ error: msg || "Failed to create account" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      userId = created.user?.id ?? null;
    }

    if (!userId) {
      return new Response(JSON.stringify({ error: "Failed to provision user" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Ensure profile row exists (without tenant - client users belong to client_org, not the agency tenant)
    await admin.from("profiles").upsert(
      { id: userId, email: invitation.email, full_name, is_active: true },
      { onConflict: "id" }
    );

    // Attach to client_portal_users
    await admin.from("client_portal_users").upsert({
      user_id: userId,
      client_org_id: invitation.client_org_id,
      tenant_id: invitation.tenant_id,
      role: invitation.role,
      is_active: true,
      invited_by: invitation.invited_by,
    }, { onConflict: "user_id,client_org_id" });

    // Mark invitation accepted
    await admin.from("client_invitations").update({
      status: "accepted",
      accepted_at: new Date().toISOString(),
      accepted_by: userId,
    }).eq("id", invitation.id);

    return new Response(JSON.stringify({ success: true, email: invitation.email }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[accept-client-invitation]", e);
    return new Response(JSON.stringify({ error: e?.message || "Unexpected error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
