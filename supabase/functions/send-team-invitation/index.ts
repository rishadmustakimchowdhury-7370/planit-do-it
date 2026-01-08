import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import {
  sendTeamEmail,
  sendAuditEmail,
  isDuplicateEmail,
  generateDedupKey,
  logEmailEvent,
  getOrgBranding,
  wrapOperationalEmail,
  wrapSystemEmail,
  emailHeading,
  emailParagraph,
  buildEmailButton,
  emailInfoBox,
} from "../_shared/smtp-sender.ts";
import { getInviteAcceptUrl } from "../_shared/app-url.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function generateInvitationEmailHtml(data: {
  inviterName: string;
  roleName: string;
  inviteUrl: string;
  organizationName?: string;
}, orgBranding: { logoUrl: string | null; companyName: string | null; primaryColor: string | null }): string {
  const orgName = data.organizationName || orgBranding.companyName || "their organisation";
  
  const bodyContent = `
    ${emailHeading("You're Invited to Join a Team", 1)}
    
    ${emailParagraph(`<strong>${data.inviterName}</strong> has invited you to join <strong>${orgName}</strong> on HireMetrics as a <strong>${data.roleName}</strong>.`)}
    
    ${emailInfoBox(`
      <table cellpadding="0" cellspacing="0" border="0" style="width:100%;">
        <tr>
          <td style="padding:4px 0; color:#374151; font-size:14px;"><strong>Role:</strong></td>
          <td style="padding:4px 0; color:#4b5563; font-size:14px;">${data.roleName}</td>
        </tr>
        <tr>
          <td style="padding:4px 0; color:#374151; font-size:14px;"><strong>Invited by:</strong></td>
          <td style="padding:4px 0; color:#4b5563; font-size:14px;">${data.inviterName}</td>
        </tr>
        ${data.organizationName ? `
        <tr>
          <td style="padding:4px 0; color:#374151; font-size:14px;"><strong>Organization:</strong></td>
          <td style="padding:4px 0; color:#4b5563; font-size:14px;">${data.organizationName}</td>
        </tr>
        ` : ''}
      </table>
    `, "info")}
    
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:32px 0;">
      <tr>
        <td align="center">
          ${buildEmailButton("Accept Invitation", data.inviteUrl)}
        </td>
      </tr>
    </table>
    
    <p style="margin:0; font-family:Arial,sans-serif; font-size:12px; color:#9ca3af; text-align:center; line-height:1.6;">
      This invitation will expire in 7 days.<br/>
      If the button doesn't work, copy this link: <a href="${data.inviteUrl}" target="_blank" rel="noopener noreferrer" style="color:#00008B; word-break:break-all;">${data.inviteUrl}</a>
    </p>
  `;
  
  // Use operational email wrapper with dual logos (HireMetrics + Org)
  return wrapOperationalEmail(bodyContent, orgBranding);
}

function generateAuditEmailHtml(data: {
  inviterName: string;
  memberEmail: string;
  roleName: string;
  organizationName?: string;
  sentFrom: string;
}): string {
  const bodyContent = `
    ${emailHeading("📋 Audit: Team Member Invited", 2)}
    
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0;">
      <tr>
        <td style="padding:10px 0; color:#64748b; font-size:14px; border-bottom:1px solid #e2e8f0; width:140px;">Invited By</td>
        <td style="padding:10px 0; color:#1e293b; font-size:14px; font-weight:600; border-bottom:1px solid #e2e8f0;">${data.inviterName}</td>
      </tr>
      <tr>
        <td style="padding:10px 0; color:#64748b; font-size:14px; border-bottom:1px solid #e2e8f0;">Member Email</td>
        <td style="padding:10px 0; color:#1e293b; font-size:14px; border-bottom:1px solid #e2e8f0;">${data.memberEmail}</td>
      </tr>
      <tr>
        <td style="padding:10px 0; color:#64748b; font-size:14px; border-bottom:1px solid #e2e8f0;">Role</td>
        <td style="padding:10px 0; color:#1e293b; font-size:14px; border-bottom:1px solid #e2e8f0;">${data.roleName}</td>
      </tr>
      ${data.organizationName ? `
      <tr>
        <td style="padding:10px 0; color:#64748b; font-size:14px; border-bottom:1px solid #e2e8f0;">Organization</td>
        <td style="padding:10px 0; color:#1e293b; font-size:14px; border-bottom:1px solid #e2e8f0;">${data.organizationName}</td>
      </tr>
      ` : ''}
      <tr>
        <td style="padding:10px 0; color:#64748b; font-size:14px; border-bottom:1px solid #e2e8f0;">Sent From</td>
        <td style="padding:10px 0; color:#1e293b; font-size:14px; border-bottom:1px solid #e2e8f0;">${data.sentFrom}</td>
      </tr>
      <tr>
        <td style="padding:10px 0; color:#64748b; font-size:14px;">Timestamp</td>
        <td style="padding:10px 0; color:#1e293b; font-size:14px;">${new Date().toISOString()}</td>
      </tr>
    </table>
    
    <p style="margin:24px 0 0 0; font-family:Arial,sans-serif; font-size:12px; color:#94a3b8; text-align:center;">
      This is an automated audit notification from HireMetrics.
    </p>
  `;
  
  return wrapSystemEmail(bodyContent);
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
      email, role, tenant_id, invited_by_id, hasToken: !!token 
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

    // Generate environment-aware invite URL (pass req for Lovable preview support)
    const inviteUrl = getInviteAcceptUrl(token, req);
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

    // Get organization branding for dual-logo header
    interface OrgBranding {
      logoUrl: string | null;
      companyName: string | null;
      primaryColor: string | null;
    }
    let orgBranding: OrgBranding = { logoUrl: null, companyName: null, primaryColor: null };
    let organizationName: string | undefined;
    
    if (tenant_id) {
      try {
        orgBranding = await getOrgBranding(tenant_id);
        organizationName = orgBranding.companyName || undefined;
        
        // If no company name from branding, try tenants table
        if (!organizationName) {
          const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
          const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
          const supabase = createClient(supabaseUrl, supabaseKey);
          
          const { data: tenant } = await supabase
            .from("tenants")
            .select("name")
            .eq("id", tenant_id)
            .single();
          
          if (tenant?.name) {
            organizationName = tenant.name as string;
            orgBranding = { ...orgBranding, companyName: organizationName };
          }
        }
      } catch (e) {
        console.warn('[SEND-TEAM-INVITATION] Failed to fetch org branding:', e);
      }
    }

    const emailHtml = generateInvitationEmailHtml({
      inviterName,
      roleName,
      inviteUrl,
      organizationName,
    }, orgBranding);

    logEmailEvent("send_team_invitation", { email, role, tenant_id, invited_by_id });

    // Send email using Team Email (Owner/Manager SMTP or fallback)
    const emailResult = await sendTeamEmail(
      tenant_id || "",
      invited_by_id,
      inviterName,
      {
        to: email,
        subject: `${inviterName} invited you to join their team on HireMetrics`,
        html: emailHtml,
      }
    );

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

    console.log('[SEND-TEAM-INVITATION] Email sent successfully via', emailResult.method, 'from', emailResult.from);

    // Send audit email to Super Admin
    const auditHtml = generateAuditEmailHtml({
      inviterName,
      memberEmail: email,
      roleName,
      organizationName,
      sentFrom: emailResult.from,
    });

    await sendAuditEmail(
      `📋 Audit: Team Member Invited - ${email}`,
      auditHtml
    );

    return new Response(
      JSON.stringify({ 
        success: true, 
        from_email: emailResult.from,
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
