import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Resend } from 'https://esm.sh/resend@2.0.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Professional renewal reminder email template
function generateRenewalReminderHTML(
  data: {
    userName: string;
    companyName: string;
    daysUntilExpiry: number;
    expiryDate: string;
    planName: string;
    renewalLink: string;
    companyLogo?: string;
  }
): string {
  const logoHTML = data.companyLogo 
    ? `<img src="${data.companyLogo}" alt="Company Logo" style="max-height: 50px; max-width: 200px; object-fit: contain;" />`
    : `<div style="display: inline-flex; align-items: center; gap: 10px;">
        <div style="background: linear-gradient(135deg, #00008B 0%, #0000CD 100%); border-radius: 10px; padding: 10px; display: flex; align-items: center; justify-content: center;">
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 3v18h18"/>
            <path d="m19 9-5 5-4-4-3 3"/>
          </svg>
        </div>
        <span style="font-family: 'Segoe UI', Arial, sans-serif; font-weight: 700; font-size: 22px;">
          <span style="color: #00008B;">HireMetrics</span><span style="color: #64748b; font-weight: 500;"> CRM</span>
        </span>
      </div>`;

  const urgencyColor = data.daysUntilExpiry <= 3 ? '#dc2626' : data.daysUntilExpiry <= 5 ? '#f59e0b' : '#00008B';
  const urgencyEmoji = data.daysUntilExpiry <= 3 ? '🚨' : data.daysUntilExpiry <= 5 ? '⚠️' : '📅';
  const urgencyTitle = data.daysUntilExpiry <= 3 ? 'Urgent: Subscription Expiring Soon!' : 
                       data.daysUntilExpiry <= 5 ? 'Reminder: Subscription Expiring' : 
                       'Subscription Renewal Reminder';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${urgencyTitle}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f1f5f9;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f1f5f9;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);">
          
          <!-- Logo Header -->
          <tr>
            <td style="padding: 30px 40px; background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%); border-bottom: 1px solid #e2e8f0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    ${logoHTML}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Urgency Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, ${urgencyColor} 0%, ${urgencyColor}dd 100%); padding: 35px 40px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 26px; font-weight: 700; letter-spacing: -0.5px;">
                ${urgencyEmoji} ${urgencyTitle}
              </h1>
            </td>
          </tr>
          
          <!-- Main Content -->
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 20px; color: #1e293b; font-size: 18px; font-weight: 600;">
                Hi ${data.userName}! 👋
              </p>
              <p style="margin: 0 0 25px; color: #475569; font-size: 16px; line-height: 1.7;">
                This is a friendly reminder that your <strong>${data.planName}</strong> subscription for <strong>${data.companyName}</strong> will expire in <strong style="color: ${urgencyColor};">${data.daysUntilExpiry} day${data.daysUntilExpiry !== 1 ? 's' : ''}</strong>.
              </p>
              
              <!-- Expiry Card -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(145deg, #fef2f2 0%, #fee2e2 100%); border-radius: 16px; border: 2px solid ${urgencyColor}20; margin-bottom: 30px;">
                <tr>
                  <td style="padding: 24px; text-align: center;">
                    <p style="margin: 0 0 8px; color: #64748b; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">Expires On</p>
                    <p style="margin: 0; color: ${urgencyColor}; font-size: 28px; font-weight: 700;">${data.expiryDate}</p>
                  </td>
                </tr>
              </table>

              <!-- What You'll Lose Section -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #fef3c7; border-radius: 12px; border: 1px solid #fcd34d; margin-bottom: 25px;">
                <tr>
                  <td style="padding: 20px;">
                    <p style="margin: 0 0 12px; color: #92400e; font-size: 14px; font-weight: 600;">⚠️ Without renewal, you'll lose access to:</p>
                    <ul style="margin: 0; padding-left: 20px; color: #b45309; font-size: 14px; line-height: 1.8;">
                      <li>AI-powered candidate matching</li>
                      <li>All your saved candidates and jobs data</li>
                      <li>Email communication features</li>
                      <li>Analytics and reporting tools</li>
                      <li>Team collaboration features</li>
                    </ul>
                  </td>
                </tr>
              </table>

              <!-- Data Retention Notice -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #eff6ff; border-radius: 12px; border: 1px solid #bfdbfe; margin-bottom: 30px;">
                <tr>
                  <td style="padding: 20px;">
                    <p style="margin: 0; color: #1e40af; font-size: 14px;">
                      💡 <strong>Good news:</strong> Your data will be safely retained for 3 months after expiry. Renew anytime during this period to restore full access!
                    </p>
                  </td>
                </tr>
              </table>

              <!-- CTA Button -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 30px;">
                <tr>
                  <td align="center">
                    <a href="${data.renewalLink}" style="display: inline-block; background: linear-gradient(135deg, #00008B 0%, #0000CD 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 10px; font-weight: 700; font-size: 18px; box-shadow: 0 4px 14px rgba(0, 0, 139, 0.4);">
                      🔄 Renew Now
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 0; color: #64748b; font-size: 14px; text-align: center; line-height: 1.6;">
                Need help or have questions? Reply to this email or contact our support team.
              </p>
              
              <!-- Signature -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top: 1px solid #e2e8f0; padding-top: 25px; margin-top: 25px;">
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
            <td style="background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%); padding: 24px 40px; border-top: 1px solid #e2e8f0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
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
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

// Admin expiry notification email
function generateAdminExpiryNotificationHTML(
  data: {
    tenantName: string;
    userName: string;
    userEmail: string;
    planName: string;
    daysUntilExpiry: number;
    expiryDate: string;
  }
): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Subscription Expiring - Admin Alert</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; background-color: #f1f5f9;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f1f5f9; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px;">⚠️ Subscription Expiring Alert</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 30px;">
              <p style="margin: 0 0 20px; color: #374151; font-size: 16px;">
                A customer's subscription is expiring soon:
              </p>
              
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #fef3c7; border-radius: 12px; border: 1px solid #fcd34d;">
                <tr>
                  <td style="padding: 20px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding: 8px 0; color: #92400e; font-size: 14px;">Company</td>
                        <td style="padding: 8px 0; color: #78350f; font-size: 14px; font-weight: 600;">${data.tenantName}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #92400e; font-size: 14px;">Contact</td>
                        <td style="padding: 8px 0; color: #78350f; font-size: 14px;">${data.userName} (${data.userEmail})</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #92400e; font-size: 14px;">Plan</td>
                        <td style="padding: 8px 0; color: #78350f; font-size: 14px; font-weight: 600;">${data.planName}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #92400e; font-size: 14px;">Expires In</td>
                        <td style="padding: 8px 0; color: #dc2626; font-size: 16px; font-weight: 700;">${data.daysUntilExpiry} day${data.daysUntilExpiry !== 1 ? 's' : ''}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #92400e; font-size: 14px;">Expiry Date</td>
                        <td style="padding: 8px 0; color: #78350f; font-size: 14px;">${data.expiryDate}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 20px 0 0; color: #64748b; font-size: 14px;">
                💡 Consider reaching out to offer assistance or a grace period if needed.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0; color: #94a3b8; font-size: 12px;">
                HireMetrics CRM Admin Alert
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
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const resendApiKey = Deno.env.get('RESEND_API_KEY');

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find tenants expiring in the next 7 days (and send reminders at 7, 5, 3 days)
    const reminderDays = [7, 5, 3];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    console.log('Checking for expiring subscriptions and trials...');

    // Get tenants expiring within 7 days
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 8); // Include 7th day

    // Fetch subscription-based expiring tenants
    const { data: expiringSubscriptions, error: subError } = await supabase
      .from('tenants')
      .select(`
        id,
        name,
        subscription_ends_at,
        subscription_status,
        subscription_plan_id,
        logo_url,
        trial_expires_at,
        trial_days,
        subscription_plans(name)
      `)
      .gte('subscription_ends_at', today.toISOString())
      .lte('subscription_ends_at', sevenDaysFromNow.toISOString())
      .in('subscription_status', ['active', 'past_due']);

    // Fetch trial-based expiring tenants
    const { data: expiringTrials, error: trialError } = await supabase
      .from('tenants')
      .select(`
        id,
        name,
        subscription_ends_at,
        subscription_status,
        subscription_plan_id,
        logo_url,
        trial_expires_at,
        trial_days,
        subscription_plans(name)
      `)
      .gte('trial_expires_at', today.toISOString())
      .lte('trial_expires_at', sevenDaysFromNow.toISOString())
      .eq('subscription_status', 'trial');

    if (subError) {
      console.error('Error fetching subscription tenants:', subError);
    }
    if (trialError) {
      console.error('Error fetching trial tenants:', trialError);
    }

    // Combine both lists
    const expiringTenants = [
      ...(expiringSubscriptions || []),
      ...(expiringTrials || [])
    ];

    console.log('Found expiring tenants:', expiringTenants?.length || 0);

    if (!expiringTenants || expiringTenants.length === 0) {
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: 'No expiring subscriptions or trials found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get super admin emails for notifications (check both super_admin and owner roles)
    let adminEmails: string[] = [];
    const { data: superAdmins } = await supabase
      .from('user_roles')
      .select('user_id')
      .in('role', ['super_admin', 'owner']);

    if (superAdmins && superAdmins.length > 0) {
      const adminUserIds = superAdmins.map(sa => sa.user_id);
      const { data: adminProfiles } = await supabase
        .from('profiles')
        .select('email')
        .in('id', adminUserIds);
      adminEmails = adminProfiles?.map(p => p.email).filter(Boolean) || [];
    }

    // Get users for these tenants
    const tenantIds = expiringTenants.map(t => t.id);
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, email, full_name, tenant_id')
      .in('tenant_id', tenantIds);

    if (profilesError) {
      console.error('Error fetching profiles:', profilesError);
      throw profilesError;
    }

    console.log('Found profiles to potentially notify:', profiles?.length || 0);

    let sentCount = 0;
    let adminNotificationCount = 0;
    const errors: string[] = [];
    const resend = resendApiKey ? new Resend(resendApiKey) : null;

    for (const tenant of expiringTenants) {
      // Check if this is a trial or subscription expiry
      const isTrial = tenant.subscription_status === 'trial' && tenant.trial_expires_at;
      const expiryDateValue = isTrial ? tenant.trial_expires_at : tenant.subscription_ends_at;
      
      if (!expiryDateValue) continue;
      
      const daysUntilExpiry = Math.ceil(
        (new Date(expiryDateValue).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );

      // Only send on specific days: 7, 5, 3
      if (!reminderDays.includes(daysUntilExpiry)) {
        continue;
      }

      const tenantProfiles = profiles?.filter(p => p.tenant_id === tenant.id) || [];
      const planName = isTrial 
        ? `Trial (${tenant.trial_days || 7} days)` 
        : ((tenant as any).subscription_plans?.name || 'Subscription');
      const expiryDate = new Date(expiryDateValue).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      // Send to each user in the tenant
      for (const profile of tenantProfiles) {
        if (!profile.email) continue;

        const htmlContent = generateRenewalReminderHTML({
          userName: profile.full_name || 'Valued Customer',
          companyName: tenant.name,
          daysUntilExpiry,
          expiryDate,
          planName,
          renewalLink: 'https://recruitifycrm.com/billing',
          companyLogo: tenant.logo_url || undefined
        });

        if (resend) {
          try {
            await resend.emails.send({
              from: 'HireMetrics <admin@hiremetrics.co.uk>',
              to: [profile.email],
              subject: daysUntilExpiry <= 3 
                ? `🚨 Urgent: Your subscription expires in ${daysUntilExpiry} day${daysUntilExpiry !== 1 ? 's' : ''}!`
                : `📅 Reminder: Your subscription expires in ${daysUntilExpiry} days`,
              html: htmlContent,
            });
            sentCount++;
            console.log(`Reminder sent to: ${profile.email} (${daysUntilExpiry} days)`);
          } catch (emailError) {
            console.error(`Failed to send to ${profile.email}:`, emailError);
            errors.push(`Failed to send to ${profile.email}`);
          }
        } else {
          console.log(`Would send reminder to: ${profile.email} (${daysUntilExpiry} days)`);
          sentCount++;
        }

        // Log the action
        await supabase.from('audit_log').insert({
          action: 'send_renewal_reminder',
          entity_type: 'tenant',
          entity_id: tenant.id,
          new_values: { 
            email: profile.email, 
            days_until_expiry: daysUntilExpiry,
            sent: !!resend 
          },
        });
      }

      // Send admin notification (only once per tenant, only on 3-day warning)
      if (daysUntilExpiry <= 3 && adminEmails.length > 0 && resend && tenantProfiles.length > 0) {
        const primaryProfile = tenantProfiles[0];
        const adminHtml = generateAdminExpiryNotificationHTML({
          tenantName: tenant.name,
          userName: primaryProfile.full_name || 'Unknown',
          userEmail: primaryProfile.email,
          planName,
          daysUntilExpiry,
          expiryDate
        });

        try {
          await resend.emails.send({
            from: 'HireMetrics <admin@hiremetrics.co.uk>',
            to: adminEmails,
            subject: `⚠️ Subscription Expiring: ${tenant.name} (${daysUntilExpiry} days)`,
            html: adminHtml,
          });
          adminNotificationCount++;
          console.log(`Admin notification sent for tenant: ${tenant.name}`);
        } catch (emailError) {
          console.error(`Failed to send admin notification for ${tenant.name}:`, emailError);
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        sent: sentCount, 
        admin_notifications: adminNotificationCount,
        total_tenants: expiringTenants.length,
        errors: errors.length > 0 ? errors : undefined,
        message: resend ? 'Reminder emails sent' : 'Emails logged (RESEND_API_KEY not configured)'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in send-renewal-reminders:', error);
    return new Response(
      JSON.stringify({ success: false, error: error?.message || 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
