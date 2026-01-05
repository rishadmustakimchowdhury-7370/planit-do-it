import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import {
  sendSystemEmail,
  sendAuditEmail,
  SUPER_ADMIN_EMAIL,
} from "../_shared/smtp-sender.ts";
import { getAdminUrl } from "../_shared/app-url.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[NOTIFY-ADMIN-NEW-USER] ${step}${detailsStr}`);
};

function generateNewUserEmailHTML(data: {
  userName: string;
  userEmail: string;
  tenantName?: string;
  registrationDate: string;
  source?: string;
  adminUrl: string;
}): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>🎉 New User Registration</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; background-color: #f1f5f9;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f1f5f9; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px;">🎉 New User Registration</h1>
              <p style="margin: 10px 0 0; color: rgba(255,255,255,0.9); font-size: 14px;">
                ${data.registrationDate}
              </p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 30px;">
              <p style="margin: 0 0 20px; color: #374151; font-size: 16px;">
                A new user has registered on HireMetrics:
              </p>
              
              <!-- User Info Card -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0; margin-bottom: 20px;">
                <tr>
                  <td style="padding: 20px;">
                    <h3 style="margin: 0 0 15px; color: #1e293b; font-size: 16px; font-weight: 600;">👤 User Details</h3>
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding: 8px 0; color: #64748b; font-size: 14px; width: 140px;">Name</td>
                        <td style="padding: 8px 0; color: #1e293b; font-size: 14px; font-weight: 600;">${data.userName}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Email</td>
                        <td style="padding: 8px 0; color: #1e293b; font-size: 14px;">
                          <a href="mailto:${data.userEmail}" style="color: #00008B; text-decoration: none;">${data.userEmail}</a>
                        </td>
                      </tr>
                      ${data.tenantName ? `
                      <tr>
                        <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Workspace</td>
                        <td style="padding: 8px 0; color: #1e293b; font-size: 14px; font-weight: 600;">${data.tenantName}</td>
                      </tr>
                      ` : ''}
                      ${data.source ? `
                      <tr>
                        <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Source</td>
                        <td style="padding: 8px 0; color: #1e293b; font-size: 14px;">${data.source}</td>
                      </tr>
                      ` : ''}
                    </table>
                  </td>
                </tr>
              </table>
              
              <!-- Status Badge -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #fef3c7; border-radius: 12px; border: 1px solid #f59e0b; margin-bottom: 20px;">
                <tr>
                  <td style="padding: 15px; text-align: center;">
                    <span style="color: #92400e; font-size: 14px; font-weight: 600;">⏳ Free Trial Active</span>
                    <p style="margin: 5px 0 0; color: #b45309; font-size: 12px;">User is on free trial and may upgrade soon</p>
                  </td>
                </tr>
              </table>
              
              <!-- Action Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="text-align: center; padding-top: 10px;">
                    <a href="${data.adminUrl}" 
                       style="display: inline-block; background: linear-gradient(135deg, #00008B 0%, #0000CD 100%); color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 14px;">
                      View in Admin Panel
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0; color: #64748b; font-size: 12px;">
                This is an automated notification from HireMetrics CRM
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const body = await req.json();
    const { user_id, email, full_name, tenant_name, source } = body;

    logStep("Processing new user notification", { user_id, email, full_name });

    const adminUrl = getAdminUrl("users", req);
    console.log("[NOTIFY-ADMIN-NEW-USER] Using admin URL:", adminUrl);

    const emailHtml = generateNewUserEmailHTML({
      userName: full_name || email.split('@')[0],
      userEmail: email,
      tenantName: tenant_name,
      registrationDate: new Date().toLocaleString('en-GB', { dateStyle: 'full', timeStyle: 'short' }),
      source,
      adminUrl,
    });

    // Send audit email to Super Admin via SMTP
    const emailResult = await sendAuditEmail(
      `🎉 New User Registration - ${full_name || email}`,
      emailHtml
    );

    if (!emailResult.success) {
      logStep("Admin notification email failed", { error: emailResult.error });
    } else {
      logStep("Admin notification email sent", { from: emailResult.from });
    }

    // Create in-app notifications for super admins
    const { data: superAdmins } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'super_admin');

    if (superAdmins && superAdmins.length > 0) {
      const adminUserIds = superAdmins.map(sa => sa.user_id);
      
      const { data: adminProfilesWithTenant } = await supabase
        .from('profiles')
        .select('id, tenant_id')
        .in('id', adminUserIds);

      const notifications = adminUserIds.map(userId => {
        const profile = adminProfilesWithTenant?.find(p => p.id === userId);
        return {
          user_id: userId,
          tenant_id: profile?.tenant_id || null,
          title: 'New User Registration',
          message: `${full_name || email} has registered on HireMetrics`,
          type: 'info',
          metadata: { user_email: email, user_name: full_name }
        };
      }).filter(n => n.tenant_id !== null);

      if (notifications.length > 0) {
        const { error: notifError } = await supabase
          .from('notifications')
          .insert(notifications);

        if (notifError) {
          logStep("Warning: Failed to create in-app notifications", { error: notifError });
        } else {
          logStep("In-app notifications created", { count: notifications.length });
        }
      }
    }

    // Send welcome email to the new user (direct SMTP; no internal fetch)
    try {
      logStep("Sending welcome email to new user", { email });

      const dashboardUrl = `${Deno.env.get("APP_BASE_URL") || Deno.env.get("APP_URL") || new URL(req.headers.get("origin") || req.url).origin}/dashboard`;

      const welcomeHtml = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title>Welcome to HireMetrics</title></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;background-color:#f1f5f9;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9;padding:40px 20px;"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
<tr><td style="padding:28px 30px;border-bottom:1px solid #e2e8f0;text-align:center;">
<h1 style="margin:0;color:#0f172a;font-size:20px;">Welcome to HireMetrics</h1>
</td></tr>
<tr><td style="padding:30px;">
<p style="margin:0 0 16px 0;color:#334155;font-size:16px;">Thank you for registering with HireMetrics. Your account has been created successfully.</p>
<p style="margin:0 0 24px 0;color:#334155;font-size:16px;">You can access your dashboard using the button below.</p>
<div style="text-align:center;">
<a href="${dashboardUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:14px 30px;background-color:#0B1C8C;color:#ffffff;text-decoration:none;font-size:16px;font-weight:600;border-radius:8px;">Access Your Dashboard</a>
</div>
</td></tr>
<tr><td style="padding:20px 30px;background-color:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;">
<p style="margin:0;color:#64748b;font-size:12px;">Need help? admin@hiremetrics.co.uk</p>
</td></tr>
</table>
</td></tr></table>
</body></html>`;

      const welcomeResult = await sendSystemEmail({
        to: email,
        subject: "Welcome to HireMetrics – Your Account is Ready",
        html: welcomeHtml,
      });

      logStep("Welcome email result", welcomeResult);
    } catch (welcomeError) {
      logStep("Warning: Failed to send welcome email", {
        error: welcomeError instanceof Error ? welcomeError.message : String(welcomeError),
      });
    }

    return new Response(JSON.stringify({ success: true, welcomeEmailSent: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
