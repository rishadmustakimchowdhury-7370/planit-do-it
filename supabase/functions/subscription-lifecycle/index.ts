import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Resend } from 'https://esm.sh/resend@2.0.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Generate grace period notification email
function generateGracePeriodNotificationHTML(
  data: {
    userName: string;
    companyName: string;
    graceDays: number;
    graceEndDate: string;
    grantedBy: string;
    companyLogo?: string;
  }
): string {
  const logoHTML = data.companyLogo 
    ? `<img src="${data.companyLogo}" alt="Company Logo" style="max-height: 50px; max-width: 200px; object-fit: contain;" />`
    : `<div style="display: inline-flex; align-items: center; gap: 10px;">
        <div style="background: linear-gradient(135deg, #00008B 0%, #0000CD 100%); border-radius: 10px; padding: 10px;">
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 3v18h18"/>
            <path d="m19 9-5 5-4-4-3 3"/>
          </svg>
        </div>
        <span style="font-family: 'Segoe UI', Arial, sans-serif; font-weight: 700; font-size: 22px;">
          <span style="color: #00008B;">HireMetrics</span><span style="color: #64748b; font-weight: 500;"> CRM</span>
        </span>
      </div>`;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Grace Period Granted</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; background-color: #f1f5f9;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f1f5f9; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);">
          
          <!-- Logo Header -->
          <tr>
            <td style="padding: 30px 40px; background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%); border-bottom: 1px solid #e2e8f0;" align="center">
              ${logoHTML}
            </td>
          </tr>

          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #059669 0%, #10b981 100%); padding: 35px 40px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 26px; font-weight: 700;">🎁 Grace Period Granted!</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 20px; color: #1e293b; font-size: 18px; font-weight: 600;">
                Hello ${data.userName}! 👋
              </p>
              <p style="margin: 0 0 25px; color: #475569; font-size: 16px; line-height: 1.7;">
                Great news! A grace period of <strong>${data.graceDays} days</strong> has been granted for your <strong>${data.companyName}</strong> account.
              </p>
              
              <!-- Grace Period Card -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(145deg, #dcfce7 0%, #d1fae5 100%); border-radius: 16px; border: 2px solid #059669; margin-bottom: 30px;">
                <tr>
                  <td style="padding: 24px; text-align: center;">
                    <p style="margin: 0 0 8px; color: #065f46; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">Your Access Continues Until</p>
                    <p style="margin: 0; color: #059669; font-size: 28px; font-weight: 700;">${data.graceEndDate}</p>
                  </td>
                </tr>
              </table>

              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #eff6ff; border-radius: 12px; border: 1px solid #bfdbfe; margin-bottom: 30px;">
                <tr>
                  <td style="padding: 20px;">
                    <p style="margin: 0; color: #1e40af; font-size: 14px;">
                      💡 During this grace period, you'll have full access to all features. Make sure to renew your subscription before the grace period ends to avoid any service interruption.
                    </p>
                  </td>
                </tr>
              </table>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 30px;">
                <tr>
                  <td align="center">
                    <a href="https://hiremetrics.co.uk/billing" style="display: inline-block; background: linear-gradient(135deg, #00008B 0%, #0000CD 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 10px; font-weight: 700; font-size: 16px;">
                      💳 Renew Subscription
                    </a>
                  </td>
                </tr>
              </table>
              
              <!-- Signature -->
              <table width="100%" cellpadding="0" cellspacing="0" style="border-top: 1px solid #e2e8f0; padding-top: 25px;">
                <tr>
                  <td>
                    <p style="margin: 0; color: #1e293b; font-size: 15px;">
                      Best regards,<br>
                      <strong style="color: #00008B;">The HireMetrics CRM Team</strong>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%); padding: 24px 40px; border-top: 1px solid #e2e8f0;" align="center">
              <p style="margin: 0 0 8px; color: #64748b; font-size: 13px;">
                Powered by <strong style="color: #00008B;">HireMetrics CRM</strong>
              </p>
              <p style="margin: 0; color: #94a3b8; font-size: 11px;">
                © ${new Date().getFullYear()} HireMetrics CRM. All rights reserved.
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

// Generate trial period notification email
function generateTrialNotificationHTML(
  data: {
    userName: string;
    companyName: string;
    trialDays: number;
    trialEndDate: string;
    companyLogo?: string;
    isWelcome?: boolean;
  }
): string {
  const logoHTML = data.companyLogo 
    ? `<img src="${data.companyLogo}" alt="Company Logo" style="max-height: 50px; max-width: 200px; object-fit: contain;" />`
    : `<div style="display: inline-flex; align-items: center; gap: 10px;">
        <div style="background: linear-gradient(135deg, #00008B 0%, #0000CD 100%); border-radius: 10px; padding: 10px;">
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 3v18h18"/>
            <path d="m19 9-5 5-4-4-3 3"/>
          </svg>
        </div>
        <span style="font-family: 'Segoe UI', Arial, sans-serif; font-weight: 700; font-size: 22px;">
          <span style="color: #00008B;">HireMetrics</span><span style="color: #64748b; font-weight: 500;"> CRM</span>
        </span>
      </div>`;

  const title = data.isWelcome ? '🎉 Your Free Trial Has Started!' : '⏰ Trial Period Extended';
  const subtitle = data.isWelcome 
    ? `Welcome aboard! Enjoy ${data.trialDays} days of full access.`
    : `Your trial has been extended to ${data.trialDays} days.`;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; background-color: #f1f5f9;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f1f5f9; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);">
          
          <!-- Logo Header -->
          <tr>
            <td style="padding: 30px 40px; background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%); border-bottom: 1px solid #e2e8f0;" align="center">
              ${logoHTML}
            </td>
          </tr>

          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #8b5cf6 0%, #a855f7 100%); padding: 35px 40px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 26px; font-weight: 700;">${title}</h1>
              <p style="margin: 10px 0 0; color: #e9d5ff; font-size: 16px;">${subtitle}</p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 20px; color: #1e293b; font-size: 18px; font-weight: 600;">
                Hello ${data.userName}! 👋
              </p>
              <p style="margin: 0 0 25px; color: #475569; font-size: 16px; line-height: 1.7;">
                ${data.isWelcome 
                  ? `Great news! A <strong>${data.trialDays}-day free trial</strong> has been activated for your <strong>${data.companyName}</strong> account. You now have full access to all premium features!`
                  : `Your trial period for <strong>${data.companyName}</strong> has been extended. You now have <strong>${data.trialDays} days</strong> to explore all our features.`
                }
              </p>
              
              <!-- Trial Period Card -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(145deg, #faf5ff 0%, #f3e8ff 100%); border-radius: 16px; border: 2px solid #8b5cf6; margin-bottom: 30px;">
                <tr>
                  <td style="padding: 24px; text-align: center;">
                    <p style="margin: 0 0 8px; color: #6b21a8; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">Trial Ends On</p>
                    <p style="margin: 0; color: #8b5cf6; font-size: 28px; font-weight: 700;">${data.trialEndDate}</p>
                  </td>
                </tr>
              </table>

              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #eff6ff; border-radius: 12px; border: 1px solid #bfdbfe; margin-bottom: 30px;">
                <tr>
                  <td style="padding: 20px;">
                    <p style="margin: 0 0 12px; color: #1e40af; font-size: 14px; font-weight: 600;">✨ What you can do during your trial:</p>
                    <ul style="margin: 0; padding-left: 20px; color: #3b82f6; font-size: 14px; line-height: 1.8;">
                      <li>AI-powered candidate matching</li>
                      <li>Unlimited candidate profiles</li>
                      <li>Email campaigns & templates</li>
                      <li>Team collaboration features</li>
                      <li>Full analytics dashboard</li>
                    </ul>
                  </td>
                </tr>
              </table>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 30px;">
                <tr>
                  <td align="center">
                    <a href="https://hiremetrics.co.uk/dashboard" style="display: inline-block; background: linear-gradient(135deg, #8b5cf6 0%, #a855f7 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 10px; font-weight: 700; font-size: 16px;">
                      🚀 Start Exploring
                    </a>
                  </td>
                </tr>
              </table>
              
              <!-- Signature -->
              <table width="100%" cellpadding="0" cellspacing="0" style="border-top: 1px solid #e2e8f0; padding-top: 25px;">
                <tr>
                  <td>
                    <p style="margin: 0; color: #1e293b; font-size: 15px;">
                      Best regards,<br>
                      <strong style="color: #00008B;">The HireMetrics CRM Team</strong>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%); padding: 24px 40px; border-top: 1px solid #e2e8f0;" align="center">
              <p style="margin: 0 0 8px; color: #64748b; font-size: 13px;">
                Powered by <strong style="color: #00008B;">HireMetrics CRM</strong>
              </p>
              <p style="margin: 0; color: #94a3b8; font-size: 11px;">
                © ${new Date().getFullYear()} HireMetrics CRM. All rights reserved.
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

// Generate expired subscription notification
function generateExpiredNotificationHTML(
  data: {
    userName: string;
    companyName: string;
    dataRetentionDays: number;
    dataDeleteDate: string;
    companyLogo?: string;
  }
): string {
  const logoHTML = data.companyLogo 
    ? `<img src="${data.companyLogo}" alt="Company Logo" style="max-height: 50px; max-width: 200px; object-fit: contain;" />`
    : `<div style="display: inline-flex; align-items: center; gap: 10px;">
        <div style="background: linear-gradient(135deg, #00008B 0%, #0000CD 100%); border-radius: 10px; padding: 10px;">
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 3v18h18"/>
            <path d="m19 9-5 5-4-4-3 3"/>
          </svg>
        </div>
        <span style="font-family: 'Segoe UI', Arial, sans-serif; font-weight: 700; font-size: 22px;">
          <span style="color: #00008B;">HireMetrics</span><span style="color: #64748b; font-weight: 500;"> CRM</span>
        </span>
      </div>`;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Subscription Expired</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; background-color: #f1f5f9;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f1f5f9; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);">
          
          <!-- Logo Header -->
          <tr>
            <td style="padding: 30px 40px; background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%); border-bottom: 1px solid #e2e8f0;" align="center">
              ${logoHTML}
            </td>
          </tr>

          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #dc2626 0%, #ef4444 100%); padding: 35px 40px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 26px; font-weight: 700;">😔 Your Subscription Has Expired</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 20px; color: #1e293b; font-size: 18px; font-weight: 600;">
                Hello ${data.userName},
              </p>
              <p style="margin: 0 0 25px; color: #475569; font-size: 16px; line-height: 1.7;">
                Your subscription for <strong>${data.companyName}</strong> has expired. Your account access has been limited, but don't worry - <strong>your data is safe</strong>.
              </p>
              
              <!-- Data Retention Card -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(145deg, #fef2f2 0%, #fee2e2 100%); border-radius: 16px; border: 2px solid #dc2626; margin-bottom: 30px;">
                <tr>
                  <td style="padding: 24px; text-align: center;">
                    <p style="margin: 0 0 8px; color: #991b1b; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">Data Retained Until</p>
                    <p style="margin: 0; color: #dc2626; font-size: 28px; font-weight: 700;">${data.dataDeleteDate}</p>
                    <p style="margin: 8px 0 0; color: #991b1b; font-size: 14px;">(${data.dataRetentionDays} days from now)</p>
                  </td>
                </tr>
              </table>

              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #eff6ff; border-radius: 12px; border: 1px solid #bfdbfe; margin-bottom: 30px;">
                <tr>
                  <td style="padding: 20px;">
                    <p style="margin: 0 0 12px; color: #1e40af; font-size: 14px; font-weight: 600;">✅ What's preserved:</p>
                    <ul style="margin: 0; padding-left: 20px; color: #3b82f6; font-size: 14px; line-height: 1.8;">
                      <li>All your candidates and their profiles</li>
                      <li>Job postings and pipeline data</li>
                      <li>Client information</li>
                      <li>Email history and communications</li>
                      <li>Documents and attachments</li>
                    </ul>
                  </td>
                </tr>
              </table>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 30px;">
                <tr>
                  <td align="center">
                    <a href="https://hiremetrics.co.uk/billing" style="display: inline-block; background: linear-gradient(135deg, #00008B 0%, #0052CC 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 10px; font-weight: 700; font-size: 18px; box-shadow: 0 4px 14px rgba(0, 0, 139, 0.4);">
                      🔄 Reactivate Now
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 0; color: #64748b; font-size: 14px; text-align: center; line-height: 1.6;">
                Need more time? Contact our support team for a grace period extension.
              </p>
              
              <!-- Signature -->
              <table width="100%" cellpadding="0" cellspacing="0" style="border-top: 1px solid #e2e8f0; padding-top: 25px; margin-top: 25px;">
                <tr>
                  <td>
                    <p style="margin: 0; color: #1e293b; font-size: 15px;">
                      We hope to see you back soon!<br>
                      <strong style="color: #00008B;">The HireMetrics Team</strong>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%); padding: 24px 40px; border-top: 1px solid #e2e8f0;" align="center">
              <p style="margin: 0 0 8px; color: #64748b; font-size: 13px;">
                Powered by <strong style="color: #00008B;">HireMetrics</strong>
              </p>
              <p style="margin: 0; color: #94a3b8; font-size: 11px;">
                © ${new Date().getFullYear()} HireMetrics. All rights reserved.
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const resendApiKey = Deno.env.get('RESEND_API_KEY');

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const resend = resendApiKey ? new Resend(resendApiKey) : null;

    const body = await req.json();
    const { action, tenant_id, grace_days, admin_id, reason } = body;

    console.log(`[SUBSCRIPTION-LIFECYCLE] Action: ${action}, Tenant: ${tenant_id}`);

    switch (action) {
      case 'grant_grace_period': {
        if (!tenant_id || !grace_days) {
          throw new Error('tenant_id and grace_days are required');
        }

        // Calculate grace end date
        const graceUntil = new Date();
        graceUntil.setDate(graceUntil.getDate() + grace_days);

        // Update tenant
        const { data: tenant, error: updateError } = await supabase
          .from('tenants')
          .update({
            grace_until: graceUntil.toISOString(),
            is_paused: false,
            subscription_status: 'grace_period',
            updated_at: new Date().toISOString()
          })
          .eq('id', tenant_id)
          .select('name, logo_url')
          .single();

        if (updateError) throw updateError;

        // Log audit
        await supabase.from('audit_log').insert({
          action: 'grant_grace_period',
          entity_type: 'tenant',
          entity_id: tenant_id,
          user_id: admin_id,
          new_values: { grace_days, grace_until: graceUntil.toISOString(), reason }
        });

        // Send notification to tenant users
        const { data: profiles } = await supabase
          .from('profiles')
          .select('email, full_name')
          .eq('tenant_id', tenant_id);

        let emailsSent = 0;
        if (resend && profiles) {
          for (const profile of profiles) {
            if (!profile.email) continue;
            
            const html = generateGracePeriodNotificationHTML({
              userName: profile.full_name || 'Valued Customer',
              companyName: tenant?.name || 'Your Company',
              graceDays: grace_days,
              graceEndDate: graceUntil.toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              }),
              grantedBy: 'Administrator',
              companyLogo: tenant?.logo_url
            });

            try {
              await resend.emails.send({
                from: 'HireMetrics <admin@hiremetrics.co.uk>',
                to: [profile.email],
                subject: `🎁 Good News! Grace Period Granted (${grace_days} days)`,
                html
              });
              emailsSent++;
            } catch (emailError) {
              console.error(`Failed to send to ${profile.email}:`, emailError);
            }
          }
        }

        return new Response(
          JSON.stringify({ 
            success: true, 
            grace_until: graceUntil.toISOString(),
            emails_sent: emailsSent
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'check_expired_subscriptions': {
        // Find tenants that have just expired (subscription_ends_at passed and status is still active)
        const now = new Date();
        
        const { data: expiredTenants, error: fetchError } = await supabase
          .from('tenants')
          .select(`
            id,
            name,
            logo_url,
            subscription_ends_at,
            grace_until
          `)
          .lt('subscription_ends_at', now.toISOString())
          .in('subscription_status', ['active', 'past_due'])
          .is('grace_until', null);

        if (fetchError) throw fetchError;

        console.log(`Found ${expiredTenants?.length || 0} newly expired tenants`);

        let processed = 0;
        let emailsSent = 0;

        for (const tenant of expiredTenants || []) {
          // Set 3-month grace period for data retention
          const graceUntil = new Date();
          graceUntil.setMonth(graceUntil.getMonth() + 3);

          // Update tenant status
          await supabase
            .from('tenants')
            .update({
              subscription_status: 'expired',
              grace_until: graceUntil.toISOString(),
              is_paused: true,
              paused_at: now.toISOString(),
              paused_reason: 'Subscription expired',
              updated_at: now.toISOString()
            })
            .eq('id', tenant.id);

          processed++;

          // Notify users
          const { data: profiles } = await supabase
            .from('profiles')
            .select('email, full_name')
            .eq('tenant_id', tenant.id);

          if (resend && profiles) {
            const daysRetention = 90; // 3 months
            const deleteDate = graceUntil.toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            });

            for (const profile of profiles) {
              if (!profile.email) continue;
              
              const html = generateExpiredNotificationHTML({
                userName: profile.full_name || 'Valued Customer',
                companyName: tenant.name,
                dataRetentionDays: daysRetention,
                dataDeleteDate: deleteDate,
                companyLogo: tenant.logo_url
              });

              try {
                await resend.emails.send({
                  from: 'HireMetrics <admin@hiremetrics.co.uk>',
                  to: [profile.email],
                  subject: `😔 Your HireMetrics Subscription Has Expired`,
                  html
                });
                emailsSent++;
              } catch (emailError) {
                console.error(`Failed to send expiry email to ${profile.email}:`, emailError);
              }
            }
          }

          // Log audit
          await supabase.from('audit_log').insert({
            action: 'subscription_expired',
            entity_type: 'tenant',
            entity_id: tenant.id,
            new_values: { 
              expired_at: now.toISOString(),
              grace_until: graceUntil.toISOString(),
              data_retention_days: 90
            }
          });
        }

        return new Response(
          JSON.stringify({ 
            success: true, 
            processed,
            emails_sent: emailsSent
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'check_expired_grace_periods': {
        // Find tenants whose grace period has ended and they don't have an active subscription
        const now = new Date();
        
        const { data: expiredGraceTenants, error: fetchError } = await supabase
          .from('tenants')
          .select(`
            id,
            name,
            logo_url,
            grace_until,
            subscription_status
          `)
          .lt('grace_until', now.toISOString())
          .eq('is_paused', false)
          .not('subscription_status', 'eq', 'active');

        if (fetchError) throw fetchError;

        console.log(`Found ${expiredGraceTenants?.length || 0} tenants with expired grace periods`);

        let processed = 0;
        let emailsSent = 0;

        for (const tenant of expiredGraceTenants || []) {
          // Auto-pause the tenant
          await supabase
            .from('tenants')
            .update({
              is_paused: true,
              paused_at: now.toISOString(),
              paused_reason: 'Grace period expired without subscription renewal',
              subscription_status: 'expired',
              updated_at: now.toISOString()
            })
            .eq('id', tenant.id);

          processed++;

          // Notify users
          const { data: profiles } = await supabase
            .from('profiles')
            .select('email, full_name')
            .eq('tenant_id', tenant.id);

          if (resend && profiles) {
            for (const profile of profiles) {
              if (!profile.email) continue;
              
              const html = generateExpiredNotificationHTML({
                userName: profile.full_name || 'Valued Customer',
                companyName: tenant.name,
                dataRetentionDays: 30,
                dataDeleteDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                }),
                companyLogo: tenant.logo_url
              });

              try {
                await resend.emails.send({
                  from: 'HireMetrics <admin@hiremetrics.co.uk>',
                  to: [profile.email],
                  subject: `⚠️ Your Grace Period Has Ended - Account Paused`,
                  html
                });
                emailsSent++;
              } catch (emailError) {
                console.error(`Failed to send grace expiry email to ${profile.email}:`, emailError);
              }
            }
          }

          // Log audit
          await supabase.from('audit_log').insert({
            action: 'grace_period_expired_auto_pause',
            entity_type: 'tenant',
            entity_id: tenant.id,
            new_values: { 
              paused_at: now.toISOString(),
              reason: 'Grace period expired without subscription renewal'
            }
          });
        }

        return new Response(
          JSON.stringify({ 
            success: true, 
            processed,
            emails_sent: emailsSent
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'cleanup_expired_grace_periods': {
        // Find tenants whose grace period has ended (for future: actually delete data)
        // For now, just mark them for deletion review
        const now = new Date();
        
        const { data: expiredGrace, error: fetchError } = await supabase
          .from('tenants')
          .select('id, name')
          .lt('grace_until', now.toISOString())
          .eq('subscription_status', 'expired');

        if (fetchError) throw fetchError;

        console.log(`Found ${expiredGrace?.length || 0} tenants past grace period`);

        // For now, just log these - actual deletion would need careful consideration
        for (const tenant of expiredGrace || []) {
          await supabase.from('audit_log').insert({
            action: 'grace_period_ended',
            entity_type: 'tenant',
            entity_id: tenant.id,
            new_values: { 
              tenant_name: tenant.name,
              note: 'Data eligible for cleanup (manual review required)'
            }
          });
        }

        return new Response(
          JSON.stringify({ 
            success: true, 
            tenants_past_grace: expiredGrace?.length || 0
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'check_expired_trials': {
        // Find tenants whose trial has expired
        const now = new Date();
        
        const { data: expiredTrials, error: fetchError } = await supabase
          .from('tenants')
          .select(`
            id,
            name,
            logo_url,
            trial_expires_at,
            trial_days
          `)
          .lt('trial_expires_at', now.toISOString())
          .eq('subscription_status', 'trial');

        if (fetchError) throw fetchError;

        console.log(`Found ${expiredTrials?.length || 0} tenants with expired trials`);

        let processed = 0;
        let emailsSent = 0;

        for (const tenant of expiredTrials || []) {
          // Update tenant status to expired
          await supabase
            .from('tenants')
            .update({
              subscription_status: 'expired',
              is_paused: true,
              paused_at: now.toISOString(),
              paused_reason: 'Trial period expired',
              updated_at: now.toISOString()
            })
            .eq('id', tenant.id);

          processed++;

          // Notify users
          const { data: profiles } = await supabase
            .from('profiles')
            .select('email, full_name')
            .eq('tenant_id', tenant.id);

          if (resend && profiles) {
            for (const profile of profiles) {
              if (!profile.email) continue;
              
              const html = generateExpiredNotificationHTML({
                userName: profile.full_name || 'Valued Customer',
                companyName: tenant.name,
                dataRetentionDays: 30,
                dataDeleteDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                }),
                companyLogo: tenant.logo_url
              });

              try {
                await resend.emails.send({
                  from: 'HireMetrics <admin@hiremetrics.co.uk>',
                  to: [profile.email],
                  subject: `😔 Your Free Trial Has Ended`,
                  html
                });
                emailsSent++;
              } catch (emailError) {
                console.error(`Failed to send trial expiry email to ${profile.email}:`, emailError);
              }
            }
          }

          // Log audit
          await supabase.from('audit_log').insert({
            action: 'trial_expired',
            entity_type: 'tenant',
            entity_id: tenant.id,
            new_values: { 
              expired_at: now.toISOString(),
              trial_days: tenant.trial_days
            }
          });
        }

        return new Response(
          JSON.stringify({ 
            success: true, 
            processed,
            emails_sent: emailsSent
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'send_trial_notification': {
        if (!tenant_id) {
          throw new Error('tenant_id is required');
        }

        // Get tenant details
        const { data: tenant, error: tenantError } = await supabase
          .from('tenants')
          .select('name, logo_url, trial_expires_at, trial_days')
          .eq('id', tenant_id)
          .single();

        if (tenantError) throw tenantError;

        // Get tenant users
        const { data: profiles } = await supabase
          .from('profiles')
          .select('email, full_name')
          .eq('tenant_id', tenant_id);

        let emailsSent = 0;
        if (resend && profiles && tenant) {
          for (const profile of profiles) {
            if (!profile.email) continue;
            
            const trialEndDate = tenant.trial_expires_at 
              ? new Date(tenant.trial_expires_at).toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })
              : 'N/A';

            const html = generateTrialNotificationHTML({
              userName: profile.full_name || 'Valued Customer',
              companyName: tenant.name,
              trialDays: tenant.trial_days || 14,
              trialEndDate,
              companyLogo: tenant.logo_url,
              isWelcome: true
            });

            try {
              await resend.emails.send({
                from: 'HireMetrics <admin@hiremetrics.co.uk>',
                to: [profile.email],
                subject: `🎉 Your ${tenant.trial_days || 14}-Day Free Trial Has Started!`,
                html
              });
              emailsSent++;
            } catch (emailError) {
              console.error(`Failed to send trial notification to ${profile.email}:`, emailError);
            }
          }
        }

        // Log audit
        await supabase.from('audit_log').insert({
          action: 'send_trial_notification',
          entity_type: 'tenant',
          entity_id: tenant_id,
          new_values: { emails_sent: emailsSent }
        });

        return new Response(
          JSON.stringify({ 
            success: true, 
            emails_sent: emailsSent
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error: any) {
    console.error('[SUBSCRIPTION-LIFECYCLE] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error?.message || 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
