import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Resend } from "https://esm.sh/resend@2.0.0";
import { EMAIL_CONFIG } from "../_shared/email-config.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[ASSIGN-PACKAGE] ${step}${detailsStr}`);
};

interface AssignPackageRequest {
  tenant_id: string;
  plan_id: string;
  start_date: string;
  end_date: string;
  is_trial?: boolean;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");
    
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    
    const supabaseUser = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } }
    });

    // Verify caller is super admin
    const { data: { user: caller }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !caller) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: superAdminCheck } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', caller.id)
      .eq('role', 'super_admin')
      .maybeSingle();

    if (!superAdminCheck) {
      return new Response(
        JSON.stringify({ error: 'Only super admins can assign packages' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { tenant_id, plan_id, start_date, end_date, is_trial }: AssignPackageRequest = await req.json();
    logStep("Request data", { tenant_id, plan_id, start_date, end_date, is_trial });

    // Validate required fields
    if (!tenant_id || !plan_id || !start_date || !end_date) {
      return new Response(
        JSON.stringify({ error: 'tenant_id, plan_id, start_date, and end_date are required. Unlimited duration is not allowed.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate dates
    const startDateObj = new Date(start_date);
    const endDateObj = new Date(end_date);
    
    if (isNaN(startDateObj.getTime()) || isNaN(endDateObj.getTime())) {
      return new Response(
        JSON.stringify({ error: 'Invalid date format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (endDateObj <= startDateObj) {
      return new Response(
        JSON.stringify({ error: 'End date must be after start date' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get tenant info
    const { data: tenant, error: tenantError } = await supabaseAdmin
      .from('tenants')
      .select('id, name, subscription_status, subscription_plan_id')
      .eq('id', tenant_id)
      .single();

    if (tenantError || !tenant) {
      return new Response(
        JSON.stringify({ error: 'Tenant not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get plan info
    const { data: plan, error: planError } = await supabaseAdmin
      .from('subscription_plans')
      .select('id, name, match_credits_monthly')
      .eq('id', plan_id)
      .single();

    if (planError || !plan) {
      return new Response(
        JSON.stringify({ error: 'Plan not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update tenant with new package
    const updateData: any = {
      subscription_plan_id: plan_id,
      subscription_ends_at: end_date,
      subscription_status: is_trial ? 'trial' : 'active',
      updated_at: new Date().toISOString(),
      match_credits_remaining: plan.match_credits_monthly || 100,
      match_credits_limit: plan.match_credits_monthly || 100,
    };

    if (is_trial) {
      updateData.trial_expires_at = end_date;
      const trialDays = Math.ceil((endDateObj.getTime() - startDateObj.getTime()) / (1000 * 60 * 60 * 24));
      updateData.trial_days = trialDays;
    } else {
      updateData.trial_expires_at = null;
    }

    const { error: updateError } = await supabaseAdmin
      .from('tenants')
      .update(updateData)
      .eq('id', tenant_id);

    if (updateError) {
      logStep("Update error", { error: updateError });
      return new Response(
        JSON.stringify({ error: 'Failed to update tenant: ' + updateError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    logStep("Tenant updated", { tenant_id, plan_id, status: updateData.subscription_status });

    // Log audit entry
    await supabaseAdmin
      .from('audit_log')
      .insert({
        action: 'package_assigned',
        entity_type: 'tenant',
        entity_id: tenant_id,
        user_id: caller.id,
        tenant_id: tenant_id,
        old_values: {
          subscription_plan_id: tenant.subscription_plan_id,
          subscription_status: tenant.subscription_status,
        },
        new_values: {
          subscription_plan_id: plan_id,
          subscription_status: updateData.subscription_status,
          subscription_ends_at: end_date,
        },
      });

    // Get owner for email notification
    const { data: ownerRole } = await supabaseAdmin
      .from('user_roles')
      .select('user_id')
      .eq('tenant_id', tenant_id)
      .eq('role', 'owner')
      .maybeSingle();

    if (ownerRole) {
      const { data: ownerProfile } = await supabaseAdmin
        .from('profiles')
        .select('email, full_name')
        .eq('id', ownerRole.user_id)
        .single();

      if (ownerProfile?.email) {
        const resendApiKey = Deno.env.get("RESEND_API_KEY");
        if (resendApiKey) {
          const resend = new Resend(resendApiKey);
          
          try {
            await resend.emails.send({
              from: EMAIL_CONFIG.sender,
              to: [ownerProfile.email],
              reply_to: EMAIL_CONFIG.replyTo,
              subject: is_trial 
                ? `Your HireMetrics Trial Has Started` 
                : `Your HireMetrics Package Has Been Updated`,
              html: generatePackageAssignmentHTML({
                userName: ownerProfile.full_name || 'Valued Customer',
                companyName: tenant.name,
                planName: plan.name,
                startDate: startDateObj.toLocaleDateString('en-GB', { dateStyle: 'long' }),
                endDate: endDateObj.toLocaleDateString('en-GB', { dateStyle: 'long' }),
                isTrial: is_trial || false,
              }),
            });
            logStep("Owner notification sent", { email: ownerProfile.email });
          } catch (e) {
            logStep("Email send error", { error: e });
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Package ${is_trial ? 'trial' : ''} assigned successfully`,
        tenant_id,
        plan_id,
        plan_name: plan.name,
        ends_at: end_date,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logStep("FATAL ERROR", { error: errorMessage });
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function generatePackageAssignmentHTML(data: {
  userName: string;
  companyName: string;
  planName: string;
  startDate: string;
  endDate: string;
  isTrial: boolean;
}): string {
  const headerTitle = data.isTrial 
    ? '🎉 Your Free Trial Has Started!' 
    : '✅ Package Assignment Confirmed';
  
  const headerColor = data.isTrial 
    ? 'linear-gradient(135deg, #8b5cf6 0%, #a855f7 100%)' 
    : 'linear-gradient(135deg, #059669 0%, #10b981 100%)';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${headerTitle}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; background-color: #f1f5f9;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f1f5f9; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);">
          <tr>
            <td style="padding: 30px 40px; background: ${headerColor}; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">${headerTitle}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 20px; color: #1e293b; font-size: 16px;">Hello ${data.userName},</p>
              <p style="margin: 0 0 20px; color: #475569; font-size: 15px; line-height: 1.6;">
                ${data.isTrial 
                  ? `Great news! A free trial of the <strong>${data.planName}</strong> plan has been activated for <strong>${data.companyName}</strong>.`
                  : `The <strong>${data.planName}</strong> plan has been assigned to <strong>${data.companyName}</strong>.`
                }
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; border-radius: 8px; margin-bottom: 25px;">
                <tr>
                  <td style="padding: 20px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding: 8px 0; color: #64748b; font-size: 13px;">Plan</td>
                        <td style="padding: 8px 0; color: #1e293b; font-size: 14px; font-weight: 600; text-align: right;">${data.planName}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #64748b; font-size: 13px;">Start Date</td>
                        <td style="padding: 8px 0; color: #1e293b; font-size: 14px; text-align: right;">${data.startDate}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #64748b; font-size: 13px;">End Date</td>
                        <td style="padding: 8px 0; color: #1e293b; font-size: 14px; font-weight: 600; text-align: right;">${data.endDate}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              ${data.isTrial ? `
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #eff6ff; border-radius: 8px; margin-bottom: 25px; border: 1px solid #bfdbfe;">
                <tr>
                  <td style="padding: 16px 20px;">
                    <p style="margin: 0; color: #1e40af; font-size: 14px;">
                      💡 Enjoy full access to all features during your trial. Upgrade before it ends to continue uninterrupted.
                    </p>
                  </td>
                </tr>
              </table>
              ` : ''}
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 25px;">
                <tr>
                  <td align="center">
                    <a href="https://hiremetrics.co.uk/dashboard" style="display: inline-block; background: linear-gradient(135deg, #00008B 0%, #0000CD 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 15px;">
                      Access Dashboard
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin: 0; color: #1e293b; font-size: 14px;">
                Best regards,<br>
                <strong>HireMetrics</strong>
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0; color: #64748b; font-size: 12px;">
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
