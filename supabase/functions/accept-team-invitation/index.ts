import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type AcceptInviteRequest = {
  token: string;
  full_name: string;
  password: string;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { token, full_name, password }: AcceptInviteRequest = await req.json();

    if (!token || !full_name || !password) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (password.length < 8) {
      return new Response(
        JSON.stringify({ error: "Password must be at least 8 characters" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !serviceKey) {
      console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
      return new Response(
        JSON.stringify({ error: "Server misconfiguration" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    // 1) Validate invitation
    const { data: invitation, error: invitationError } = await supabaseAdmin
      .from("team_invitations")
      .select("id, email, role, tenant_id, status, expires_at")
      .eq("token", token)
      .eq("status", "pending")
      .gt("expires_at", new Date().toISOString())
      .single();

    if (invitationError || !invitation) {
      return new Response(
        JSON.stringify({ error: "This invitation link is invalid or has expired" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2) Create user (auto-confirm to avoid Supabase confirmation email / SMTP issues)
    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: invitation.email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name,
      },
    });

    // If user already exists, allow UI to sign in instead
    if (createError) {
      const msg = (createError as any)?.message ?? "";
      const isDuplicate =
        msg.toLowerCase().includes("already registered") ||
        msg.toLowerCase().includes("duplicate") ||
        msg.toLowerCase().includes("exists");

      if (isDuplicate) {
        return new Response(
          JSON.stringify({
            success: true,
            action: "existing_user",
            email: invitation.email,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.error("Error creating user:", createError);
      return new Response(
        JSON.stringify({ error: msg || "Failed to create account" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = created.user?.id;
    if (!userId) {
      return new Response(
        JSON.stringify({ error: "Failed to create account" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3) Ensure profile + role exist (don’t rely on DB triggers)
    await supabaseAdmin
      .from("profiles")
      .upsert(
        {
          id: userId,
          email: invitation.email,
          full_name,
          tenant_id: invitation.tenant_id,
          is_active: true,
        },
        { onConflict: "id" }
      );

    await supabaseAdmin
      .from("user_roles")
      .upsert(
        {
          user_id: userId,
          role: invitation.role,
          tenant_id: invitation.tenant_id,
          ai_credits_allocated: 0,
          ai_credits_used: 0,
        },
        { onConflict: "user_id,role,tenant_id" }
      );

    // 4) Mark invitation(s) accepted
    await supabaseAdmin
      .from("team_invitations")
      .update({
        status: "accepted",
        accepted_at: new Date().toISOString(),
        accepted_by: userId,
      })
      .eq("email", invitation.email)
      .eq("tenant_id", invitation.tenant_id)
      .eq("status", "pending");

    return new Response(
      JSON.stringify({
        success: true,
        action: "created",
        email: invitation.email,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in accept-team-invitation:", error);
    return new Response(
      JSON.stringify({ error: error?.message ?? "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
