import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import {
  sendTeamEmail,
  wrapOperationalEmail,
  emailHeading,
  emailParagraph,
  buildEmailButton,
  emailInfoBox,
  getOrgBranding,
} from "../_shared/smtp-sender.ts";
import { getAppBaseUrl } from "../_shared/app-url.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Body = {
  client_org_id?: string;
  client_id?: string | null;
  org_name?: string;
  email: string;
  role?: "client_user" | "hiring_manager";
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    const { data: userRes } = await userClient.auth.getUser();
    const inviter = userRes?.user;
    if (!inviter) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: Body = await req.json();
    const email = (body.email || "").trim().toLowerCase();
    const role = body.role === "hiring_manager" ? "hiring_manager" : "client_user";
    if (!email || !email.includes("@")) {
      return new Response(JSON.stringify({ error: "Valid email required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Inviter profile/role
    const { data: inviterProfile } = await admin
      .from("profiles").select("tenant_id, full_name, email").eq("id", inviter.id).single();
    if (!inviterProfile?.tenant_id) {
      return new Response(JSON.stringify({ error: "Inviter has no tenant" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const tenantId = inviterProfile.tenant_id as string;

    const { data: roleRow } = await admin
      .from("user_roles").select("role").eq("user_id", inviter.id).eq("tenant_id", tenantId).maybeSingle();
    if (!roleRow || !["owner", "manager", "recruiter"].includes(roleRow.role)) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Resolve / create client_organization
    let clientOrgId = body.client_org_id || null;
    let orgName = body.org_name?.trim() || "";

    if (!clientOrgId) {
      if (!orgName) {
        return new Response(JSON.stringify({ error: "client_org_id or org_name required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: org, error: orgErr } = await admin
        .from("client_organizations")
        .insert({
          tenant_id: tenantId,
          name: orgName,
          client_id: body.client_id ?? null,
          created_by: inviter.id,
        })
        .select("id, name")
        .single();
      if (orgErr || !org) {
        return new Response(JSON.stringify({ error: orgErr?.message || "Failed to create org" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      clientOrgId = org.id;
      orgName = org.name;
    } else {
      const { data: org } = await admin
        .from("client_organizations").select("name, tenant_id").eq("id", clientOrgId).single();
      if (!org || org.tenant_id !== tenantId) {
        return new Response(JSON.stringify({ error: "Org not found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      orgName = org.name;
    }

    // Create invitation
    const { data: invite, error: inviteErr } = await admin
      .from("client_invitations")
      .insert({
        tenant_id: tenantId,
        client_org_id: clientOrgId,
        email,
        role,
        invited_by: inviter.id,
      })
      .select("id, token")
      .single();
    if (inviteErr || !invite) {
      return new Response(JSON.stringify({ error: inviteErr?.message || "Failed to create invitation" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const acceptUrl = `${getAppBaseUrl(req)}/accept-client-invitation?token=${invite.token}`;
    const branding = await getOrgBranding(admin, tenantId);

    const html = wrapOperationalEmail(`
      ${emailHeading(`You've been invited to collaborate on hiring`, 1)}
      ${emailParagraph(`<strong>${inviterProfile.full_name || inviterProfile.email}</strong> has invited you to the <strong>${orgName}</strong> Client Portal on HireMetrics.`)}
      ${emailInfoBox(`
        <div style="color:#374151;font-size:14px;"><strong>Role:</strong> ${role === "hiring_manager" ? "Hiring Manager" : "Client User"}</div>
        <div style="color:#374151;font-size:14px;margin-top:4px;"><strong>Organisation:</strong> ${orgName}</div>
      `, "info")}
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:32px 0;">
        <tr><td align="center">${buildEmailButton("Accept Invitation", acceptUrl)}</td></tr>
      </table>
      <p style="margin:0;font-family:Arial,sans-serif;font-size:12px;color:#9ca3af;text-align:center;line-height:1.6;">
        This invitation expires in 7 days. If the button doesn't work, paste this link:<br/>
        <a href="${acceptUrl}" style="color:#00008B;word-break:break-all;">${acceptUrl}</a>
      </p>
    `, branding);

    try {
      await sendTeamEmail({
        tenantId,
        to: email,
        subject: `You're invited to ${orgName} on HireMetrics`,
        html,
        replyTo: inviterProfile.email || undefined,
      });
    } catch (e) {
      console.error("[invite-client-user] email failed", e);
    }

    return new Response(
      JSON.stringify({ success: true, client_org_id: clientOrgId, invitation_id: invite.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("[invite-client-user] error", e);
    return new Response(JSON.stringify({ error: e?.message || "Unexpected error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
