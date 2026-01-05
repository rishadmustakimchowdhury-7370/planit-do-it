import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import {
  isDuplicateEmail,
  generateDedupKey,
  logEmailEvent,
  ADMIN_EMAIL,
} from "../_shared/email-config.ts";
import { dispatchNotification } from "../_shared/notification-dispatcher.ts";
import { getInviteAcceptUrl, getAppBaseUrl } from "../_shared/app-url.ts";
import { sendOrgEmail } from "../_shared/org-smtp-sender.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function generateInvitationEmailHtml(data: {
  inviterName: string;
  roleName: string;
  inviteUrl: string;
  organizationName?: string;
}): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Team Invitation</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f4f4f5;">
        <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
          <div style="text-align: center; margin-bottom: 24px;">
            <span style="font-size: 24px; font-weight: 700; color: #0052CC;">HireMetrics</span>
          </div>
          <div style="background: white; border-radius: 12px; padding: 40px; border: 1px solid #e5e7eb;">
            <h1 style="color: #111827; font-size: 20px; margin: 0 0 16px 0;">You're Invited to Join a Team</h1>
            
            <p style="color: #4b5563; margin: 0 0 24px 0; line-height: 1.6;">
              <strong>${data.inviterName}</strong> has invited you to join ${data.organizationName ? `<strong>${data.organizationName}</strong>` : 'their organisation'} on HireMetrics as a <strong>${data.roleName}</strong>.
            </p>
            
            <div style="background: #f9fafb; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
              <div style="margin: 4px 0;"><strong style="color: #374151;">Role:</strong> <span style="color: #4b5563;">${data.roleName}</span></div>
              <div style="margin: 4px 0;"><strong style="color: #374151;">Invited by:</strong> <span style="color: #4b5563;">${data.inviterName}</span></div>
            </div>

            <div style="text-align: center; margin: 32px 0;">
              <a href="${data.inviteUrl}" 
                 style="display: inline-block; background: #0052CC; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500;">
                Accept Invitation
              </a>
            </div>

            <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 24px 0 0 0;">
              This invitation will expire in 7 days.<br>
              If the button doesn't work, copy this link: <a href="${data.inviteUrl}" style="color: #0052CC; word-break: break-all;">${data.inviteUrl}</a>
            </p>
          </div>
          
          <div style="text-align: center; margin-top: 24px; font-size: 12px; color: #9ca3af;">
            <p>HireMetrics - Enterprise Recruitment Platform</p>
            <p>This email was sent because you were invited to join a team on HireMetrics.</p>
          </div>
        </div>
      </body>
    </html>
  `;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      email, 
      role, 
      token, 
      tenant_id, 
      invited_by_id,
      invited_by_name, 
      owner_name 
    } = await req.json();

    if (!email || !token) {
      console.error('[SEND-TEAM-INVITATION] Missing required fields');
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[SEND-TEAM-INVITATION] Processing invitation:', { 
      email, 
      role, 
      tenant_id, 
      invited_by_id,
      hasToken: !!token 
    });

    // Dedup check
    const dedupKey = generateDedupKey(email, "team_invitation", token);
    if (isDuplicateEmail(dedupKey)) {
      console.log('[SEND-TEAM-INVITATION] Duplicate invitation detected, skipping');
      return new Response(
        JSON.stringify({ success: true, message: "Duplicate prevented" }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate environment-aware invite URL
    const inviteUrl = getInviteAcceptUrl(token);
    console.log('[SEND-TEAM-INVITATION] Generated invite URL:', inviteUrl);

    const roleLabels: Record<string, string> = {
      admin: 'Owner',
      owner: 'Owner',
      manager: 'Manager',
      recruiter: 'Recruiter',
      support: 'Support',
      viewer: 'Viewer',
    };

    const roleName = roleLabels[role] || role;
    const inviterName = invited_by_name || owner_name || "Your team";

    // Get organization name if tenant_id is provided
    let organizationName: string | undefined;
    if (tenant_id) {
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseKey);
        
        const { data: tenant } = await supabase
          .from("tenants")
          .select("name")
          .eq("id", tenant_id)
          .single();
        
        if (tenant) {
          organizationName = tenant.name as string;
        }
      } catch (e) {
        console.warn('[SEND-TEAM-INVITATION] Failed to fetch tenant name:', e);
      }
    }

    const emailHtml = generateInvitationEmailHtml({
      inviterName,
      roleName,
      inviteUrl,
      organizationName,
    });

    logEmailEvent("send_team_invitation", { email, role, tenant_id, invited_by_id });

    // Send email using organization SMTP (falls back to Resend if no SMTP configured)
    const emailResult = await sendOrgEmail({
      tenant_id: tenant_id || "",
      sender_user_id: invited_by_id,
      to: email,
      subject: `${inviterName} invited you to join their team on HireMetrics`,
      html: emailHtml,
    });

    if (!emailResult.success) {
      console.error('[SEND-TEAM-INVITATION] Failed to send email:', emailResult.error);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to send email', 
          details: emailResult.error,
          method: emailResult.method 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[SEND-TEAM-INVITATION] Email sent successfully via', emailResult.method, 'from', emailResult.from_email);

    // Dispatch notification to super admin about new team member being added
    if (tenant_id) {
      await dispatchNotification({
        event_type: "team_member_added",
        tenant_id,
        data: {
          owner_name: inviterName,
          member_email: email,
          member_role: roleName,
          sent_from: emailResult.from_email,
        },
        skip_email: false,
        skip_notification: true, // Super admin doesn't need in-app notif, just email
      });
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        from_email: emailResult.from_email,
        method: emailResult.method 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('[SEND-TEAM-INVITATION] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
