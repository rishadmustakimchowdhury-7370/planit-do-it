import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  sendBillingEmail,
  sendAuditEmail,
  logEmailEvent,
} from "../_shared/smtp-sender.ts";
import { getAppBaseUrl } from "../_shared/app-url.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Professional renewal reminder email template
function generateRenewalReminderHTML(data: {
  userName: string;
  companyName: string;
  daysUntilExpiry: number;
  expiryDate: string;
  planName: string;
  renewalLink: string;
  companyLogo?: string;
}): string {
  const logoHTML = data.companyLogo 
    ? `<img src="${data.companyLogo}" alt="Company Logo" style="max-height: 50px; max-width: 200px; object-fit: contain;" />`
    : `<table cellpadding="0" cellspacing="0" style="margin: 0 auto;"><tr><td style="background: linear-gradient(135deg, #00008B 0%, #0052CC 100%); border-radius: 10px; padding: 10px;"><svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg></td><td style="padding-left: 12px; font-family: 'Segoe UI', Arial, sans-serif; font-weight: 700; font-size: 22px;"><span style="color: #00008B;">HireMetrics</span><span style="color: #64748b; font-weight: 500;"> CRM</span></td></tr></table>`;

  const urgencyColor = data.daysUntilExpiry <= 3 ? '#dc2626' : data.daysUntilExpiry <= 5 ? '#f59e0b' : '#00008B';
  const urgencyEmoji = data.daysUntilExpiry <= 3 ? '🚨' : data.daysUntilExpiry <= 5 ? '⚠️' : '📅';
  const urgencyTitle = data.daysUntilExpiry <= 3 ? 'Urgent: Subscription Expiring Soon!' : 
                       data.daysUntilExpiry <= 5 ? 'Reminder: Subscription Expiring' : 
                       'Subscription Renewal Reminder';

  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${urgencyTitle}</title></head><body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f1f5f9;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f1f5f9;"><tr><td align="center" style="padding: 40px 20px;"><table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);"><tr><td style="padding: 30px 40px; background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%); border-bottom: 1px solid #e2e8f0; text-align: center;">${logoHTML}</td></tr><tr><td style="background: linear-gradient(135deg, ${urgencyColor} 0%, ${urgencyColor}dd 100%); padding: 35px 40px; text-align: center;"><h1 style="margin: 0; color: #ffffff; font-size: 26px; font-weight: 700; letter-spacing: -0.5px;">${urgencyEmoji} ${urgencyTitle}</h1></td></tr><tr><td style="padding: 40px;"><p style="margin: 0 0 20px; color: #1e293b; font-size: 18px; font-weight: 600;">Hi ${data.userName}! 👋</p><p style="margin: 0 0 25px; color: #475569; font-size: 16px; line-height: 1.7;">This is a friendly reminder that your <strong>${data.planName}</strong> subscription for <strong>${data.companyName}</strong> will expire in <strong style="color: ${urgencyColor};">${data.daysUntilExpiry} day${data.daysUntilExpiry !== 1 ? 's' : ''}</strong>.</p><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(145deg, #fef2f2 0%, #fee2e2 100%); border-radius: 16px; border: 2px solid ${urgencyColor}20; margin-bottom: 30px;"><tr><td style="padding: 24px; text-align: center;"><p style="margin: 0 0 8px; color: #64748b; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">Expires On</p><p style="margin: 0; color: ${urgencyColor}; font-size: 28px; font-weight: 700;">${data.expiryDate}</p></td></tr></table><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #fef3c7; border-radius: 12px; border: 1px solid #fcd34d; margin-bottom: 25px;"><tr><td style="padding: 20px;"><p style="margin: 0 0 12px; color: #92400e; font-size: 14px; font-weight: 600;">⚠️ Without renewal, you'll lose access to:</p><ul style="margin: 0; padding-left: 20px; color: #b45309; font-size: 14px; line-height: 1.8;"><li>AI-powered candidate matching</li><li>All your saved candidates and jobs data</li><li>Email communication features</li><li>Analytics and reporting tools</li><li>Team collaboration features</li></ul></td></tr></table><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #eff6ff; border-radius: 12px; border: 1px solid #bfdbfe; margin-bottom: 30px;"><tr><td style="padding: 20px;"><p style="margin: 0; color: #1e40af; font-size: 14px;">💡 <strong>Good news:</strong> Your data will be safely retained for 3 months after expiry. Renew anytime during this period to restore full access!</p></td></tr></table><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 30px;"><tr><td align="center"><a href="${data.renewalLink}" style="display: inline-block; background: linear-gradient(135deg, #00008B 0%, #0000CD 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 10px; font-weight: 700; font-size: 18px; box-shadow: 0 4px 14px rgba(0, 0, 139, 0.4);">🔄 Renew Now</a></td></tr></table><p style="margin: 0; color: #64748b; font-size: 14px; text-align: center; line-height: 1.6;">Need help or have questions? Reply to this email or contact our support team.</p><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top: 1px solid #e2e8f0; padding-top: 25px; margin-top: 25px;"><tr><td><p style="margin: 0; color: #1e293b; font-size: 15px;">Best regards,<br><strong style="color: #00008B;">The HireMetrics CRM Team</strong></p></td></tr></table></td></tr><tr><td style="background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%); padding: 24px 40px; border-top: 1px solid #e2e8f0; text-align: center;"><p style="margin: 0 0 8px; color: #64748b; font-size: 13px;">Powered by <strong style="color: #00008B;">HireMetrics CRM</strong></p><p style="margin: 0; color: #94a3b8; font-size: 11px;">© ${new Date().getFullYear()} HireMetrics CRM. All rights reserved.</p></td></tr></table></td></tr></table></body></html>`;
}

// Admin expiry notification email
function generateAdminExpiryNotificationHTML(data: {
  tenantName: string;
  userName: string;
  userEmail: string;
  planName: string;
  daysUntilExpiry: number;
  expiryDate: string;
}): string {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Subscription Expiring - Admin Alert</title></head><body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; background-color: #f1f5f9;"><table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f1f5f9; padding: 40px 20px;"><tr><td align="center"><table width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);"><tr><td style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 30px; text-align: center;"><h1 style="margin: 0; color: #ffffff; font-size: 24px;">⚠️ Subscription Expiring Alert</h1></td></tr><tr><td style="padding: 30px;"><p style="margin: 0 0 20px; color: #374151; font-size: 16px;">A customer's subscription is expiring soon:</p><table width="100%" cellpadding="0" cellspacing="0" style="background-color: #fef3c7; border-radius: 12px; border: 1px solid #fcd34d;"><tr><td style="padding: 20px;"><table width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding: 8px 0; color: #92400e; font-size: 14px;">Company</td><td style="padding: 8px 0; color: #78350f; font-size: 14px; font-weight: 600;">${data.tenantName}</td></tr><tr><td style="padding: 8px 0; color: #92400e; font-size: 14px;">Contact</td><td style="padding: 8px 0; color: #78350f; font-size: 14px;">${data.userName} (${data.userEmail})</td></tr><tr><td style="padding: 8px 0; color: #92400e; font-size: 14px;">Plan</td><td style="padding: 8px 0; color: #78350f; font-size: 14px; font-weight: 600;">${data.planName}</td></tr><tr><td style="padding: 8px 0; color: #92400e; font-size: 14px;">Expires In</td><td style="padding: 8px 0; color: #dc2626; font-size: 16px; font-weight: 700;">${data.daysUntilExpiry} day${data.daysUntilExpiry !== 1 ? 's' : ''}</td></tr><tr><td style="padding: 8px 0; color: #92400e; font-size: 14px;">Expiry Date</td><td style="padding: 8px 0; color: #78350f; font-size: 14px;">${data.expiryDate}</td></tr></table></td></tr></table><p style="margin: 20px 0 0; color: #64748b; font-size: 14px;">💡 Consider reaching out to offer assistance or a grace period if needed.</p></td></tr><tr><td style="background-color: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #e2e8f0;"><p style="margin: 0; color: #94a3b8; font-size: 12px;">HireMetrics CRM Admin Alert</p></td></tr></table></td></tr></table></body></html>`;
}

// Manual reminder email template
function generateManualReminderHTML(data: {
  userName: string;
  customMessage?: string;
  expiryDate?: string;
  subscriptionStatus?: string;
  renewalLink: string;
}): string {
  const statusLabel = data.subscriptionStatus === 'trial' ? 'trial period' : 'subscription';
  const expiryInfo = data.expiryDate 
    ? `Your ${statusLabel} expires on <strong>${data.expiryDate}</strong>.` 
    : `Your ${statusLabel} will expire soon.`;

  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Subscription Reminder from HireMetrics</title></head><body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f1f5f9;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f1f5f9;"><tr><td align="center" style="padding: 40px 20px;"><table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);"><tr><td style="padding: 30px 40px; background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%); border-bottom: 1px solid #e2e8f0; text-align: center;"><table cellpadding="0" cellspacing="0" style="margin: 0 auto;"><tr><td style="background: linear-gradient(135deg, #00008B 0%, #0052CC 100%); border-radius: 10px; padding: 10px;"><svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg></td><td style="padding-left: 12px; font-family: 'Segoe UI', Arial, sans-serif; font-weight: 700; font-size: 22px;"><span style="color: #00008B;">HireMetrics</span><span style="color: #64748b; font-weight: 500;"> CRM</span></td></tr></table></td></tr><tr><td style="background: linear-gradient(135deg, #00008B 0%, #0000CD 100%); padding: 35px 40px; text-align: center;"><h1 style="margin: 0; color: #ffffff; font-size: 26px; font-weight: 700; letter-spacing: -0.5px;">📬 Subscription Reminder</h1></td></tr><tr><td style="padding: 40px;"><p style="margin: 0 0 20px; color: #1e293b; font-size: 18px; font-weight: 600;">Hi ${data.userName}! 👋</p><p style="margin: 0 0 25px; color: #475569; font-size: 16px; line-height: 1.7;">${expiryInfo}</p>${data.customMessage ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #eff6ff; border-radius: 12px; border: 1px solid #bfdbfe; margin-bottom: 25px;"><tr><td style="padding: 20px;"><p style="margin: 0; color: #1e40af; font-size: 15px; line-height: 1.6;">💬 <strong>Message from our team:</strong><br><br>${data.customMessage}</p></td></tr></table>` : ''}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 30px;"><tr><td align="center"><a href="${data.renewalLink}" style="display: inline-block; background: linear-gradient(135deg, #00008B 0%, #0000CD 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 10px; font-weight: 700; font-size: 18px; box-shadow: 0 4px 14px rgba(0, 0, 139, 0.4);">🔄 View Subscription Options</a></td></tr></table><p style="margin: 0; color: #64748b; font-size: 14px; text-align: center; line-height: 1.6;">Need help or have questions? Reply to this email or contact our support team.</p><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top: 1px solid #e2e8f0; padding-top: 25px; margin-top: 25px;"><tr><td><p style="margin: 0; color: #1e293b; font-size: 15px;">Best regards,<br><strong style="color: #00008B;">The HireMetrics CRM Team</strong></p></td></tr></table></td></tr><tr><td style="background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%); padding: 24px 40px; border-top: 1px solid #e2e8f0; text-align: center;"><p style="margin: 0 0 8px; color: #64748b; font-size: 13px;">Powered by <strong style="color: #00008B;">HireMetrics CRM</strong></p><p style="margin: 0; color: #94a3b8; font-size: 11px;">© ${new Date().getFullYear()} HireMetrics CRM. All rights reserved.</p></td></tr></table></td></tr></table></body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const appBaseUrl = await getAppBaseUrl();
    const renewalLink = `${appBaseUrl}/billing`;

    // Check if this is a manual reminder request
    const body = await req.json().catch(() => ({}));
    
    if (body.manual && body.tenant_id) {
      // Manual reminder to specific tenant
      const { data: tenant } = await supabase
        .from('tenants')
        .select('*, profiles!tenants_owner_id_fkey(email, full_name)')
        .eq('id', body.tenant_id)
        .single();

      if (!tenant) {
        return new Response(
          JSON.stringify({ success: false, error: 'Tenant not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const ownerProfile = tenant.profiles;
      if (!ownerProfile?.email) {
        return new Response(
          JSON.stringify({ success: false, error: 'Owner email not found' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const expiryDate = tenant.subscription_expires_at 
        ? new Date(tenant.subscription_expires_at).toLocaleDateString('en-US', { 
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
          })
        : undefined;

      logEmailEvent("Sending manual renewal reminder", { to: ownerProfile.email, tenantId: body.tenant_id });

      const result = await sendBillingEmail({
        to: ownerProfile.email,
        subject: '📬 Subscription Reminder from HireMetrics',
        html: generateManualReminderHTML({
          userName: ownerProfile.full_name || 'there',
          customMessage: body.message,
          expiryDate,
          subscriptionStatus: tenant.subscription_status,
          renewalLink,
        }),
      });

      return new Response(
        JSON.stringify({ 
          success: result.success, 
          message: result.success ? 'Reminder sent successfully' : result.error 
        }),
        { status: result.success ? 200 : 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Automated renewal reminders at specific intervals: 14, 7, 3 days, 24 hours
    const now = new Date();
    const fourteenDaysFromNow = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

    // Find tenants expiring within 14 days
    const { data: expiringTenants, error: fetchError } = await supabase
      .from('tenants')
      .select('*, profiles!tenants_owner_id_fkey(email, full_name), subscription_plans(name)')
      .in('subscription_status', ['trial', 'active'])
      .lte('subscription_expires_at', fourteenDaysFromNow.toISOString())
      .gt('subscription_expires_at', now.toISOString());

    if (fetchError) {
      console.error('Error fetching expiring tenants:', fetchError);
      throw fetchError;
    }

    console.log(`[SMTP] Found ${expiringTenants?.length || 0} tenants expiring within 14 days`);

    if (!expiringTenants || expiringTenants.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No renewal reminders to send', sent: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let sentCount = 0;
    let adminNotifications = 0;

    // Reminder intervals in days - only send if they match these exact thresholds
    const reminderIntervals = [14, 7, 3, 1]; // 14 days, 7 days, 3 days, 24 hours

    for (const tenant of expiringTenants) {
      const ownerProfile = tenant.profiles;
      if (!ownerProfile?.email) continue;

      const expiryDate = new Date(tenant.subscription_expires_at);
      const daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      // Check if we should send a reminder today (matches one of our intervals)
      // We also accept daysUntilExpiry within ±0.5 day range to account for timing variations
      const shouldSendReminder = reminderIntervals.some(interval => 
        Math.abs(daysUntilExpiry - interval) <= 0.5
      );

      if (!shouldSendReminder) {
        console.log(`[SMTP] Skipping tenant ${tenant.id} - ${daysUntilExpiry} days until expiry doesn't match reminder intervals`);
        continue;
      }

      const formattedExpiryDate = expiryDate.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      const planName = tenant.subscription_plans?.name || tenant.subscription_plan || 'Subscription';

      logEmailEvent("Sending renewal reminder", { 
        to: ownerProfile.email, 
        tenantId: tenant.id, 
        daysUntilExpiry,
        interval: reminderIntervals.find(i => Math.abs(daysUntilExpiry - i) <= 0.5)
      });

      // Determine urgency level for subject line
      let subjectPrefix = '📅';
      let subjectText = `Reminder: Your ${planName} expires in ${daysUntilExpiry} days`;
      
      if (daysUntilExpiry <= 1) {
        subjectPrefix = '🚨';
        subjectText = `URGENT: Your ${planName} expires tomorrow!`;
      } else if (daysUntilExpiry <= 3) {
        subjectPrefix = '⚠️';
        subjectText = `Urgent: Your ${planName} expires in ${daysUntilExpiry} days`;
      } else if (daysUntilExpiry <= 7) {
        subjectPrefix = '⏰';
        subjectText = `Reminder: Your ${planName} expires in ${daysUntilExpiry} days`;
      }

      // Send reminder to customer
      const customerResult = await sendBillingEmail({
        to: ownerProfile.email,
        subject: `${subjectPrefix} ${subjectText}`,
        html: generateRenewalReminderHTML({
          userName: ownerProfile.full_name || 'there',
          companyName: tenant.name || 'Your Company',
          daysUntilExpiry,
          expiryDate: formattedExpiryDate,
          planName,
          renewalLink,
        }),
      });

      if (customerResult.success) {
        sentCount++;
        
        // Log to email_logs for tracking
        await supabase.from('email_logs').insert({
          tenant_id: tenant.id,
          recipient_email: ownerProfile.email,
          subject: `${subjectPrefix} ${subjectText}`,
          template_name: 'renewal_reminder',
          status: 'sent',
          metadata: { daysUntilExpiry, interval: daysUntilExpiry }
        });
      }

      // Send admin notification for urgent cases (3 days or less)
      if (daysUntilExpiry <= 3) {
        const adminResult = await sendAuditEmail(
          `⚠️ Customer Subscription Expiring: ${tenant.name || ownerProfile.email} (${daysUntilExpiry} days)`,
          generateAdminExpiryNotificationHTML({
            tenantName: tenant.name || 'Unknown',
            userName: ownerProfile.full_name || 'Unknown',
            userEmail: ownerProfile.email,
            planName,
            daysUntilExpiry,
            expiryDate: formattedExpiryDate,
          })
        );

        if (adminResult.success) {
          adminNotifications++;
        }
      }
    }

    console.log(`[SMTP] Renewal reminders: ${sentCount} customer emails, ${adminNotifications} admin notifications`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Sent ${sentCount} renewal reminders`,
        sent: sentCount,
        adminNotifications,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in send-renewal-reminders:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
