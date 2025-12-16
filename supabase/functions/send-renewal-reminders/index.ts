import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    // Find tenants expiring in the next 7 days
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    console.log('Looking for tenants expiring between', today.toISOString(), 'and', sevenDaysFromNow.toISOString());

    const { data: expiringTenants, error: tenantsError } = await supabase
      .from('tenants')
      .select(`
        id,
        name,
        subscription_ends_at,
        subscription_status
      `)
      .gte('subscription_ends_at', today.toISOString())
      .lte('subscription_ends_at', sevenDaysFromNow.toISOString())
      .eq('subscription_status', 'active');

    if (tenantsError) {
      console.error('Error fetching tenants:', tenantsError);
      throw tenantsError;
    }

    console.log('Found expiring tenants:', expiringTenants?.length || 0);

    if (!expiringTenants || expiringTenants.length === 0) {
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: 'No expiring subscriptions found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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

    console.log('Found profiles to notify:', profiles?.length || 0);

    // Get the renewal reminder email template
    const { data: template } = await supabase
      .from('email_templates')
      .select('*')
      .eq('name', 'renewal_reminder')
      .eq('is_active', true)
      .single();

    let sentCount = 0;
    const errors: string[] = [];

    for (const profile of profiles || []) {
      const tenant = expiringTenants.find(t => t.id === profile.tenant_id);
      if (!tenant) continue;

      const daysUntilExpiry = Math.ceil(
        (new Date(tenant.subscription_ends_at!).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );

      // Generate AI-style personalized email content
      const subject = template?.subject || `Your Recruitify CRM subscription expires in ${daysUntilExpiry} days`;
      
      let htmlContent = template?.html_content || `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #0052CC;">Subscription Renewal Reminder</h1>
          <p>Hi {{name}},</p>
          <p>This is a friendly reminder that your RecruitifyCRM subscription for <strong>{{company}}</strong> will expire in <strong>{{days}} days</strong> on {{expiry_date}}.</p>
          <p>To ensure uninterrupted access to all features, including:</p>
          <ul>
            <li>AI-powered candidate matching</li>
            <li>Unlimited job postings</li>
            <li>Advanced analytics and reporting</li>
            <li>Team collaboration tools</li>
          </ul>
          <p>Please renew your subscription before it expires.</p>
          <p style="margin: 30px 0;">
            <a href="{{renewal_link}}" style="background-color: #0052CC; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Renew Now</a>
          </p>
          <p>If you have any questions or need assistance, our support team is here to help.</p>
          <p>Best regards,<br>The RecruitifyCRM Team</p>
        </div>
      `;

      // Replace template variables
      htmlContent = htmlContent
        .replace(/{{name}}/g, profile.full_name || 'there')
        .replace(/{{company}}/g, tenant.name)
        .replace(/{{days}}/g, daysUntilExpiry.toString())
        .replace(/{{expiry_date}}/g, new Date(tenant.subscription_ends_at!).toLocaleDateString())
        .replace(/{{renewal_link}}/g, `${supabaseUrl.replace('.supabase.co', '.lovable.app')}/billing`);

      // Send email via Resend if API key is available
      if (resendApiKey) {
        try {
          const emailResponse = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${resendApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: 'RecruitifyCRM <info@recruitifycrm.com>',
              to: profile.email,
              subject: subject.replace(/{{days}}/g, daysUntilExpiry.toString()),
              html: htmlContent,
            }),
          });

          if (emailResponse.ok) {
            sentCount++;
            console.log('Email sent to:', profile.email);
          } else {
            const errorText = await emailResponse.text();
            console.error('Failed to send email to', profile.email, ':', errorText);
            errors.push(`Failed to send to ${profile.email}`);
          }
        } catch (emailError) {
          console.error('Email error for', profile.email, ':', emailError);
          errors.push(`Error sending to ${profile.email}`);
        }
      } else {
        // Log the email that would be sent
        console.log('Would send email to:', profile.email, 'Subject:', subject);
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
          sent: resendApiKey ? true : false 
        },
      });
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        sent: sentCount, 
        total: profiles?.length || 0,
        errors: errors.length > 0 ? errors : undefined,
        message: resendApiKey ? 'Emails sent' : 'Emails logged (RESEND_API_KEY not configured)'
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
