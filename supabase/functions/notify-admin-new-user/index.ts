import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[NOTIFY-ADMIN-NEW-USER] ${step}${detailsStr}`);
};

type ResendSendResult = { data: any; error: any };

async function sendResendEmailWithRetry(
  resend: Resend,
  payload: Parameters<Resend["emails"]["send"]>[0],
  maxAttempts = 5
): Promise<ResendSendResult> {
  let lastResult: ResendSendResult = { data: null, error: null };
  let delayMs = 700;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const result = (await resend.emails.send(payload)) as ResendSendResult;
    lastResult = result;

    const err = result?.error;
    if (!err) return result;

    const statusCode = err?.statusCode;
    const name = err?.name;
    const isRateLimit = statusCode === 429 || name === "rate_limit_exceeded";

    if (!isRateLimit || attempt === maxAttempts) return result;

    logStep("Resend rate-limited, retrying", { attempt, delayMs, statusCode, name });
    await new Promise((r) => setTimeout(r, delayMs));
    delayMs = Math.min(delayMs * 2, 5000);
  }

  return lastResult;
}

function generateNewUserEmailHTML(data: {
  userName: string;
  userEmail: string;
  tenantName?: string;
  registrationDate: string;
  source?: string;
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
                    <a href="https://hiremetrics.lovable.app/admin/users" 
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

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY is not configured");
    }

    const body = await req.json();
    const { user_id, email, full_name, tenant_name, source } = body;

    logStep("Processing new user notification", { user_id, email, full_name });

    // Get super admin emails
    const { data: superAdmins, error: saError } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'super_admin');

    if (saError) {
      logStep("Error fetching super admins", { error: saError });
      throw saError;
    }

    if (!superAdmins || superAdmins.length === 0) {
      logStep("No super admins found, using fallback email");
      const resend = new Resend(resendApiKey);

      // small jitter to reduce collisions with other functions hitting Resend at the same time
      await new Promise((r) => setTimeout(r, Math.floor(200 + Math.random() * 400)));

      const fallbackResult = await sendResendEmailWithRetry(resend, {
        from: 'HireMetrics <admin@hiremetrics.co.uk>',
        to: ['admin@hiremetrics.co.uk'],
        subject: `🎉 New User Registration - ${full_name || email}`,
        html: generateNewUserEmailHTML({
          userName: full_name || email.split('@')[0],
          userEmail: email,
          tenantName: tenant_name,
          registrationDate: new Date().toLocaleString('en-GB', { dateStyle: 'full', timeStyle: 'short' }),
          source,
        }),
      });

      if (fallbackResult.error) {
        logStep("Fallback admin email failed", { error: fallbackResult.error });
      } else {
        logStep("Fallback admin email sent", { emailId: fallbackResult.data?.id });
      }

      return new Response(JSON.stringify({ success: true, fallback: true, emailResult: fallbackResult }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminUserIds = superAdmins.map(sa => sa.user_id);
    logStep("Found super admins", { count: adminUserIds.length });

    const { data: adminProfiles, error: apError } = await supabase
      .from('profiles')
      .select('email, full_name')
      .in('id', adminUserIds)
      .eq('is_active', true);

    if (apError) {
      logStep("Error fetching admin profiles", { error: apError });
      throw apError;
    }

    const adminEmails = adminProfiles?.map(p => p.email).filter(Boolean) || [];
    logStep("Admin emails to notify", { adminEmails });

    if (adminEmails.length === 0) {
      adminEmails.push('admin@hiremetrics.co.uk');
      logStep("Using fallback admin email");
    }

    const resend = new Resend(resendApiKey);
    
    const emailHtml = generateNewUserEmailHTML({
      userName: full_name || email.split('@')[0],
      userEmail: email,
      tenantName: tenant_name,
      registrationDate: new Date().toLocaleString('en-GB', { dateStyle: 'full', timeStyle: 'short' }),
      source,
    });

    await new Promise((r) => setTimeout(r, Math.floor(200 + Math.random() * 400)));

    const emailResult = await sendResendEmailWithRetry(resend, {
      from: 'HireMetrics <admin@hiremetrics.co.uk>',
      to: adminEmails,
      subject: `🎉 New User Registration - ${full_name || email}`,
      html: emailHtml,
    });

    if (emailResult.error) {
      logStep("Admin notification email failed", { error: emailResult.error, adminEmails });
    }

    logStep("Admin notification attempted", { emailResult, adminEmails });

    // Also create in-app notifications for super admins
    // Get tenant_id for each super admin from their profile
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
    }).filter(n => n.tenant_id !== null); // Only insert if tenant_id exists

    if (notifications.length > 0) {
      const { error: notifError } = await supabase
        .from('notifications')
        .insert(notifications);

      if (notifError) {
        logStep("Warning: Failed to create in-app notifications", { error: notifError });
      } else {
        logStep("In-app notifications created", { count: notifications.length });
      }
    } else {
      logStep("Skipped in-app notifications - no valid tenant_id found for super admins");
    }

    return new Response(JSON.stringify({ success: true, adminEmails }), {
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
