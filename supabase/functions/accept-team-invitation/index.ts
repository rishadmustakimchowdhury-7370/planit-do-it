import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  sendSystemEmail,
  sendTeamEmail,
  sendAuditEmail,
  SUPER_ADMIN_EMAIL,
} from "../_shared/smtp-sender.ts";
import {
  getDashboardUrl,
  getAdminUrl,
  getTeamUrl,
} from "../_shared/app-url.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[ACCEPT-TEAM-INVITATION] ${step}${detailsStr}`);
};

type AcceptInviteRequest = {
  token: string;
  full_name: string;
  password: string;
};

// ============================================================================
// EMAIL TEMPLATES
// ============================================================================

function generateWelcomeEmailHTML(data: {
  memberName: string;
  roleName: string;
  teamName: string;
  dashboardUrl: string;
}): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to ${data.teamName}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f4f4f5;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <div style="text-align: center; margin-bottom: 24px;">
      <span style="font-size: 24px; font-weight: 700; color: #0052CC;">HireMetrics</span>
    </div>
    <div style="background: white; border-radius: 12px; padding: 40px; border: 1px solid #e5e7eb;">
      <h1 style="color: #111827; font-size: 24px; margin: 0 0 16px 0;">Welcome to ${data.teamName}! 🎉</h1>
      
      <p style="color: #4b5563; margin: 0 0 24px 0; line-height: 1.6;">
        Congratulations, <strong>${data.memberName}</strong>! Your account has been successfully activated.
      </p>
      
      <div style="background: #f0fdf4; border-radius: 8px; padding: 16px; margin-bottom: 24px; border: 1px solid #bbf7d0;">
        <div style="margin: 4px 0;"><strong style="color: #166534;">✓ Account Status:</strong> <span style="color: #15803d;">Active</span></div>
        <div style="margin: 4px 0;"><strong style="color: #166534;">Role:</strong> <span style="color: #15803d;">${data.roleName}</span></div>
        <div style="margin: 4px 0;"><strong style="color: #166534;">Team:</strong> <span style="color: #15803d;">${data.teamName}</span></div>
      </div>

      <p style="color: #4b5563; margin: 0 0 24px 0; line-height: 1.6;">
        You now have full access to HireMetrics CRM. Here's what you can do:
      </p>

      <ul style="color: #4b5563; margin: 0 0 24px 0; padding-left: 20px; line-height: 1.8;">
        <li>View and manage candidates</li>
        <li>Access job listings assigned to you</li>
        <li>Track recruitment progress</li>
        <li>Collaborate with your team</li>
      </ul>

      <div style="text-align: center; margin: 32px 0;">
        <a href="${data.dashboardUrl}" 
           style="display: inline-block; background: #0052CC; color: white; padding: 14px 28px; border-radius: 6px; text-decoration: none; font-weight: 600;">
          Access Your Dashboard
        </a>
      </div>

      <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 24px 0 0 0;">
        If the button doesn't work, copy this link: <a href="${data.dashboardUrl}" style="color: #0052CC;">${data.dashboardUrl}</a>
      </p>
    </div>
    
    <div style="text-align: center; margin-top: 24px; font-size: 12px; color: #9ca3af;">
      <p>HireMetrics - Enterprise Recruitment Platform</p>
      <p>Questions? Contact us at admin@hiremetrics.co.uk</p>
    </div>
  </div>
</body>
</html>
  `;
}

function generateOwnerNotificationHTML(data: {
  memberName: string;
  memberEmail: string;
  roleName: string;
  teamName: string;
  activatedAt: string;
  teamUrl: string;
}): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Team Member Activated</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f4f4f5;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <div style="text-align: center; margin-bottom: 24px;">
      <span style="font-size: 24px; font-weight: 700; color: #0052CC;">HireMetrics</span>
    </div>
    <div style="background: white; border-radius: 12px; padding: 40px; border: 1px solid #e5e7eb;">
      <h1 style="color: #111827; font-size: 20px; margin: 0 0 16px 0;">Team Member Joined Successfully ✓</h1>
      
      <p style="color: #4b5563; margin: 0 0 24px 0; line-height: 1.6;">
        A team member has accepted their invitation and joined your organisation.
      </p>
      
      <div style="background: #f9fafb; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
        <div style="margin: 8px 0;"><strong style="color: #374151;">Name:</strong> <span style="color: #4b5563;">${data.memberName}</span></div>
        <div style="margin: 8px 0;"><strong style="color: #374151;">Email:</strong> <span style="color: #4b5563;">${data.memberEmail}</span></div>
        <div style="margin: 8px 0;"><strong style="color: #374151;">Role:</strong> <span style="color: #4b5563;">${data.roleName}</span></div>
        <div style="margin: 8px 0;"><strong style="color: #374151;">Activated:</strong> <span style="color: #4b5563;">${data.activatedAt}</span></div>
      </div>

      <div style="text-align: center; margin: 32px 0;">
        <a href="${data.teamUrl}" 
           style="display: inline-block; background: #0052CC; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500;">
          View Team
        </a>
      </div>
    </div>
    
    <div style="text-align: center; margin-top: 24px; font-size: 12px; color: #9ca3af;">
      <p>HireMetrics - Enterprise Recruitment Platform</p>
    </div>
  </div>
</body>
</html>
  `;
}

function generateAdminNotificationHTML(data: {
  memberName: string;
  memberEmail: string;
  roleName: string;
  teamName: string;
  ownerName: string;
  activatedAt: string;
  adminUrl: string;
}): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New User Activated</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f4f4f5;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <div style="text-align: center; margin-bottom: 24px;">
      <span style="font-size: 24px; font-weight: 700; color: #0052CC;">HireMetrics Admin</span>
    </div>
    <div style="background: white; border-radius: 12px; padding: 40px; border: 1px solid #e5e7eb;">
      <h1 style="color: #111827; font-size: 20px; margin: 0 0 16px 0;">New Team Member Activated</h1>
      
      <p style="color: #4b5563; margin: 0 0 24px 0; line-height: 1.6;">
        A new user has accepted their team invitation and activated their account.
      </p>
      
      <div style="background: #f9fafb; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
        <div style="margin: 8px 0;"><strong style="color: #374151;">Member Name:</strong> <span style="color: #4b5563;">${data.memberName}</span></div>
        <div style="margin: 8px 0;"><strong style="color: #374151;">Email:</strong> <span style="color: #4b5563;">${data.memberEmail}</span></div>
        <div style="margin: 8px 0;"><strong style="color: #374151;">Role:</strong> <span style="color: #4b5563;">${data.roleName}</span></div>
        <div style="margin: 8px 0;"><strong style="color: #374151;">Team:</strong> <span style="color: #4b5563;">${data.teamName}</span></div>
        <div style="margin: 8px 0;"><strong style="color: #374151;">Owner:</strong> <span style="color: #4b5563;">${data.ownerName}</span></div>
        <div style="margin: 8px 0;"><strong style="color: #374151;">Activated:</strong> <span style="color: #4b5563;">${data.activatedAt}</span></div>
      </div>

      <div style="text-align: center; margin: 32px 0;">
        <a href="${data.adminUrl}" 
           style="display: inline-block; background: #7c3aed; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500;">
          View in Admin Panel
        </a>
      </div>
    </div>
    
    <div style="text-align: center; margin-top: 24px; font-size: 12px; color: #9ca3af;">
      <p>HireMetrics Admin Notification</p>
    </div>
  </div>
</body>
</html>
  `;
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

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
      logStep("ERROR: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
      return new Response(
        JSON.stringify({ error: "Server misconfiguration" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    // 1) Validate and lock invitation (prevent race conditions)
    logStep("Validating invitation token");
    const { data: invitation, error: invitationError } = await supabaseAdmin
      .from("team_invitations")
      .select("id, email, role, tenant_id, status, expires_at, invited_by")
      .eq("token", token)
      .eq("status", "pending")
      .gt("expires_at", new Date().toISOString())
      .single();

    if (invitationError || !invitation) {
      logStep("Invalid or expired invitation", { error: invitationError });
      return new Response(
        JSON.stringify({ error: "This invitation link is invalid or has expired" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    logStep("Invitation validated", { email: invitation.email, role: invitation.role });

    // 2) Immediately mark token as processing to prevent reuse
    const { error: lockError } = await supabaseAdmin
      .from("team_invitations")
      .update({ status: "processing" })
      .eq("id", invitation.id)
      .eq("status", "pending");

    if (lockError) {
      logStep("Token already being processed", { error: lockError });
      return new Response(
        JSON.stringify({ error: "This invitation is already being processed" }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3) Get tenant info
    const { data: tenant } = await supabaseAdmin
      .from("tenants")
      .select("name")
      .eq("id", invitation.tenant_id)
      .single();

    const teamName = tenant?.name || "HireMetrics Team";

    // 4) Get owner info for notifications
    const { data: ownerRole } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("tenant_id", invitation.tenant_id)
      .eq("role", "owner")
      .limit(1)
      .single();

    let ownerEmail: string | null = null;
    let ownerName: string | null = null;

    if (ownerRole) {
      const { data: ownerProfile } = await supabaseAdmin
        .from("profiles")
        .select("email, full_name")
        .eq("id", ownerRole.user_id)
        .single();
      ownerEmail = ownerProfile?.email || null;
      ownerName = ownerProfile?.full_name || null;
    }

    // 5) Create user (auto-confirm to avoid Supabase confirmation email / SMTP issues)
    logStep("Creating user account", { email: invitation.email });
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
        logStep("User already exists, marking invitation accepted");
        
        // Mark invitation as accepted anyway
        await supabaseAdmin
          .from("team_invitations")
          .update({
            status: "accepted",
            accepted_at: new Date().toISOString(),
          })
          .eq("id", invitation.id);

        return new Response(
          JSON.stringify({
            success: true,
            action: "existing_user",
            email: invitation.email,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Rollback invitation status on error
      await supabaseAdmin
        .from("team_invitations")
        .update({ status: "pending" })
        .eq("id", invitation.id);

      logStep("Error creating user", { error: createError });
      return new Response(
        JSON.stringify({ error: msg || "Failed to create account" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = created.user?.id;
    if (!userId) {
      await supabaseAdmin
        .from("team_invitations")
        .update({ status: "pending" })
        .eq("id", invitation.id);

      return new Response(
        JSON.stringify({ error: "Failed to create account" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    logStep("User created", { userId });

    // 6) Ensure profile + role exist (don't rely on DB triggers)
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

    // 7) Mark invitation as accepted (token is now permanently invalidated)
    const acceptedAt = new Date().toISOString();
    await supabaseAdmin
      .from("team_invitations")
      .update({
        status: "accepted",
        accepted_at: acceptedAt,
        accepted_by: userId,
      })
      .eq("id", invitation.id);

    // Also mark any other pending invitations for same email in same tenant
    await supabaseAdmin
      .from("team_invitations")
      .update({
        status: "accepted",
        accepted_at: acceptedAt,
        accepted_by: userId,
      })
      .eq("email", invitation.email)
      .eq("tenant_id", invitation.tenant_id)
      .eq("status", "pending");

    logStep("Invitation marked as accepted");

    // 8) Create in-app notification for owner
    if (ownerRole) {
      await supabaseAdmin.from("notifications").insert({
        tenant_id: invitation.tenant_id,
        user_id: ownerRole.user_id,
        type: "team_member_accepted",
        title: "Team Member Joined",
        message: `${full_name} has joined the team as ${invitation.role}`,
        link: "/team",
        metadata: {
          member_name: full_name,
          member_email: invitation.email,
          member_role: invitation.role,
        },
      });
    }

    // 9) Log to audit
    await supabaseAdmin.from("audit_log").insert({
      tenant_id: invitation.tenant_id,
      user_id: userId,
      action: "team_member_accepted",
      entity_type: "user",
      entity_id: userId,
      new_values: {
        full_name,
        email: invitation.email,
        role: invitation.role,
      },
    });

    logStep("Audit log created");

    // 10) Send notification emails (SMTP-only)
    const roleName = invitation.role.charAt(0).toUpperCase() + invitation.role.slice(1);
    const activatedAt = new Date().toLocaleString("en-GB", {
      timeZone: "Europe/London",
      dateStyle: "full",
      timeStyle: "short",
    });

    // Email 1: Welcome email to team member
    try {
      logStep("Sending welcome email to team member", { email: invitation.email });
      const dashboardUrl = getDashboardUrl(req);

      const welcomeHtml = generateWelcomeEmailHTML({
        memberName: full_name,
        roleName,
        teamName,
        dashboardUrl,
      });

      const r1 = await sendSystemEmail({
        to: invitation.email,
        subject: `Welcome to ${teamName} - Your Account is Ready`,
        html: welcomeHtml,
      });

      await supabaseAdmin.from("email_logs").insert({
        tenant_id: invitation.tenant_id,
        recipient_email: invitation.email,
        subject: `Welcome to ${teamName} - Your Account is Ready`,
        template_name: "team_member_welcome",
        status: r1.success ? "sent" : "failed",
        error_message: r1.success ? null : r1.error,
        sent_by: userId,
        metadata: { event: "team_member_accepted", role: invitation.role },
      });

      if (!r1.success) throw new Error(r1.error || "Welcome email failed");
      logStep("Welcome email sent to team member");
    } catch (emailError) {
      logStep("Failed to send welcome email", { error: emailError instanceof Error ? emailError.message : String(emailError) });
    }

    // Email 2: Notification to owner
    if (ownerEmail) {
      try {
        logStep("Sending notification email to owner", { email: ownerEmail });
        await new Promise((r) => setTimeout(r, 300));

        const ownerHtml = generateOwnerNotificationHTML({
          memberName: full_name,
          memberEmail: invitation.email,
          roleName,
          teamName,
          activatedAt,
          teamUrl: getTeamUrl(req),
        });

        const r2 = await sendTeamEmail(
          invitation.tenant_id,
          ownerRole?.user_id,
          ownerName || "HireMetrics",
          {
            to: ownerEmail,
            subject: `Team Member Joined: ${full_name} (${roleName})`,
            html: ownerHtml,
          }
        );

        await supabaseAdmin.from("email_logs").insert({
          tenant_id: invitation.tenant_id,
          recipient_email: ownerEmail,
          subject: `Team Member Joined: ${full_name} (${roleName})`,
          template_name: "owner_member_joined",
          status: r2.success ? "sent" : "failed",
          error_message: r2.success ? null : r2.error,
          sent_by: userId,
          metadata: { event: "team_member_accepted", member_email: invitation.email },
        });

        if (!r2.success) throw new Error(r2.error || "Owner notification failed");
        logStep("Owner notification email sent");
      } catch (emailError) {
        logStep("Failed to send owner notification email", { error: emailError instanceof Error ? emailError.message : String(emailError) });
      }
    }

    // Email 3: Notification to super admin
    try {
      logStep("Sending notification email to super admin", { email: SUPER_ADMIN_EMAIL });
      await new Promise((r) => setTimeout(r, 300));

      const adminHtml = generateAdminNotificationHTML({
        memberName: full_name,
        memberEmail: invitation.email,
        roleName,
        teamName,
        ownerName: ownerName || "Unknown",
        activatedAt,
        adminUrl: getAdminUrl("users", req),
      });

      const r3 = await sendAuditEmail(
        `New User Activated: ${full_name} (${teamName})`,
        adminHtml
      );

      await supabaseAdmin.from("email_logs").insert({
        tenant_id: invitation.tenant_id,
        recipient_email: SUPER_ADMIN_EMAIL,
        subject: `New User Activated: ${full_name} (${teamName})`,
        template_name: "admin_member_activated",
        status: r3.success ? "sent" : "failed",
        error_message: r3.success ? null : r3.error,
        sent_by: userId,
        metadata: {
          event: "team_member_accepted",
          member_email: invitation.email,
          team_name: teamName,
        },
      });

      if (!r3.success) throw new Error(r3.error || "Super admin notification failed");
      logStep("Super admin notification email sent");
    } catch (emailError) {
      logStep("Failed to send super admin notification email", { error: emailError instanceof Error ? emailError.message : String(emailError) });
    }

    logStep("Invitation acceptance completed successfully", { userId, email: invitation.email });

    return new Response(
      JSON.stringify({
        success: true,
        action: "created",
        email: invitation.email,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    logStep("ERROR in accept-team-invitation", { error: error?.message });
    return new Response(
      JSON.stringify({ error: error?.message ?? "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
