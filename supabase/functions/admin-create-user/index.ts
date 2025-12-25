import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[ADMIN-CREATE-USER] ${step}${detailsStr}`);
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

const jsonResponse = (payload: unknown) =>
  new Response(JSON.stringify(payload), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

interface CreateUserRequest {
  email: string;
  password: string;
  fullName: string;
  companyName?: string;
  planId?: string;
}

function generateWelcomeEmailHTML(data: {
  fullName: string;
  email: string;
  password: string;
  companyName?: string;
  appUrl: string;
}): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Welcome to HireMetrics</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; background-color: #f1f5f9;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f1f5f9; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px;">🎉 Welcome to HireMetrics!</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 20px; color: #1e293b; font-size: 18px; font-weight: 600;">
                Hello ${data.fullName}! 👋
              </p>
              <p style="margin: 0 0 25px; color: #475569; font-size: 16px; line-height: 1.7;">
                Your account has been successfully created by the HireMetrics admin team. 
                You now have <strong>Owner</strong> access to your workspace${data.companyName ? ` "${data.companyName}"` : ""}.
              </p>
              
              <!-- Credentials Card -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(145deg, #f8fafc 0%, #f1f5f9 100%); border-radius: 12px; border: 1px solid #e2e8f0; margin-bottom: 25px;">
                <tr>
                  <td style="padding: 24px;">
                    <h3 style="margin: 0 0 15px; color: #1e293b; font-size: 16px; font-weight: 600;">🔐 Your Login Credentials</h3>
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0;">
                          <span style="color: #64748b; font-size: 14px;">Email</span><br>
                          <span style="color: #1e293b; font-size: 16px; font-weight: 600;">${data.email}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 10px 0;">
                          <span style="color: #64748b; font-size: 14px;">Temporary Password</span><br>
                          <code style="background: #fef3c7; padding: 8px 12px; border-radius: 6px; font-size: 16px; font-weight: 600; color: #92400e; display: inline-block; margin-top: 5px;">${data.password}</code>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Security Warning -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #fef2f2; border-radius: 12px; border: 1px solid #fecaca; margin-bottom: 25px;">
                <tr>
                  <td style="padding: 16px;">
                    <p style="margin: 0; color: #991b1b; font-size: 14px;">
                      ⚠️ <strong>Security Notice:</strong> Please change your password immediately after your first login.
                    </p>
                  </td>
                </tr>
              </table>
              
              <!-- Login Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding: 10px 0 30px;">
                    <a href="${data.appUrl}/auth" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                      Login to HireMetrics →
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 0; color: #64748b; font-size: 14px; line-height: 1.6;">
                If you have any questions, feel free to reach out to our support team.
              </p>
              <p style="margin: 20px 0 0; color: #1e293b; font-size: 15px;">
                Best regards,<br>
                <strong style="color: #667eea;">The HireMetrics Team</strong>
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
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

function generateAdminNotificationHTML(data: {
  newUserName: string;
  newUserEmail: string;
  companyName?: string;
  planName?: string;
  createdBy: string;
}): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>New User Created</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; background-color: #f1f5f9;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f1f5f9; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #7c3aed 0%, #8b5cf6 100%); padding: 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px;">👤 New User Created by Admin</h1>
              <p style="margin: 10px 0 0; color: rgba(255,255,255,0.9); font-size: 14px;">
                ${new Date().toLocaleString('en-GB', { dateStyle: 'full', timeStyle: 'short' })}
              </p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 30px;">
              <p style="margin: 0 0 20px; color: #374151; font-size: 16px;">
                A new user account has been created via the admin panel:
              </p>
              
              <!-- User Info Card -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0; margin-bottom: 20px;">
                <tr>
                  <td style="padding: 20px;">
                    <h3 style="margin: 0 0 15px; color: #1e293b; font-size: 16px; font-weight: 600;">👤 User Details</h3>
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding: 8px 0; color: #64748b; font-size: 14px; width: 140px;">Name</td>
                        <td style="padding: 8px 0; color: #1e293b; font-size: 14px; font-weight: 600;">${data.newUserName}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Email</td>
                        <td style="padding: 8px 0; color: #1e293b; font-size: 14px;">
                          <a href="mailto:${data.newUserEmail}" style="color: #7c3aed; text-decoration: none;">${data.newUserEmail}</a>
                        </td>
                      </tr>
                      ${data.companyName ? `
                      <tr>
                        <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Workspace</td>
                        <td style="padding: 8px 0; color: #1e293b; font-size: 14px; font-weight: 600;">${data.companyName}</td>
                      </tr>
                      ` : ''}
                      ${data.planName ? `
                      <tr>
                        <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Plan</td>
                        <td style="padding: 8px 0; color: #1e293b; font-size: 14px;">
                          <span style="background: #dbeafe; color: #1e40af; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600;">${data.planName}</span>
                        </td>
                      </tr>
                      ` : ''}
                      <tr>
                        <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Created By</td>
                        <td style="padding: 8px 0; color: #1e293b; font-size: 14px;">${data.createdBy}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              <!-- Action Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding-top: 10px;">
                    <a href="https://hiremetrics.lovable.app/admin/users" 
                       style="display: inline-block; background: linear-gradient(135deg, #7c3aed 0%, #8b5cf6 100%); color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 14px;">
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

    // Get authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      logStep("Missing authorization header");
      return jsonResponse({
        success: false,
        error: "Missing authorization header",
        code: "missing_authorization",
      });
    }


    // Create admin client with service role key for all operations
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Create user client to get caller identity
    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    // Get caller user
    const { data: { user: caller }, error: userError } = await supabaseUser.auth.getUser();

    if (userError || !caller) {
      logStep("Unauthorized - no valid user", { error: userError });
      return jsonResponse({ success: false, error: "Unauthorized", code: "unauthorized" });
    }


    logStep("Caller identified", { callerId: caller.id, callerEmail: caller.email });

    // Check if caller is super admin using admin client (bypasses RLS)
    const { data: superAdminRole, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', caller.id)
      .eq('role', 'super_admin')
      .maybeSingle();

    if (roleError) {
      logStep("Error checking super admin status", { error: roleError });
      return jsonResponse({
        success: false,
        error: "Failed to verify permissions",
        code: "permission_check_failed",
      });
    }


    const isSuperAdmin = !!superAdminRole;
    logStep("Super admin check", { isSuperAdmin });

    if (!isSuperAdmin) {
      logStep("Permission denied - not a super admin");
      return jsonResponse({
        success: false,
        error: "Only super admins can create users",
        code: "forbidden",
      });
    }


    const { email, password, fullName, companyName, planId }: CreateUserRequest = await req.json();
    logStep("Request data", { email, fullName, companyName, planId });

    if (!email || !password || !fullName) {
      return jsonResponse({
        success: false,
        error: "Email, password, and full name are required",
        code: "validation_error",
      });
    }


    // Create user using service role
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
      },
    });

    if (createError) {
      logStep("Error creating user", { error: createError });
      return jsonResponse({
        success: false,
        error: createError.message,
        code: (createError as any)?.code ?? "create_user_failed",
      });
    }


    if (!newUser.user) {
      return jsonResponse({
        success: false,
        error: "Failed to create user",
        code: "create_user_failed",
      });
    }


    logStep("User created in auth", { userId: newUser.user.id });

    // Wait for profile and tenant to be created by trigger
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Get the created profile to find tenant_id
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('tenant_id')
      .eq('id', newUser.user.id)
      .single();

    logStep("Profile retrieved", { profile });

    let planName = null;

    // Update tenant with plan and company name if provided
    if (profile?.tenant_id) {
      const updates: any = {};
      if (companyName) updates.name = companyName;
      if (planId) {
        updates.subscription_plan_id = planId;
        updates.subscription_status = 'active';

        // Get plan name for email
        const { data: plan } = await supabaseAdmin
          .from('subscription_plans')
          .select('name')
          .eq('id', planId)
          .single();
        planName = plan?.name;
      }

      if (Object.keys(updates).length > 0) {
        await supabaseAdmin
          .from('tenants')
          .update(updates)
          .eq('id', profile.tenant_id);
        logStep("Tenant updated", { updates });
      }

      // Check if owner role already exists (created by trigger)
      const { data: existingRole } = await supabaseAdmin
        .from('user_roles')
        .select('id')
        .eq('user_id', newUser.user.id)
        .eq('tenant_id', profile.tenant_id)
        .eq('role', 'owner')
        .maybeSingle();

      if (!existingRole) {
        // Assign 'owner' role to the new user for their tenant
        const { error: roleError } = await supabaseAdmin
          .from('user_roles')
          .insert({
            user_id: newUser.user.id,
            role: 'owner',
            tenant_id: profile.tenant_id,
          });

        if (roleError) {
          logStep("Error assigning owner role", { error: roleError });
        } else {
          logStep("Owner role assigned");
        }
      } else {
        logStep("Owner role already exists");
      }
    }

    // Send emails
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (resendApiKey) {
      const resend = new Resend(resendApiKey);
      const appUrl = "https://hiremetrics.lovable.app";

      // 1. Send welcome email to new user
      try {
        const welcomeHtml = generateWelcomeEmailHTML({
          fullName,
          email,
          password,
          companyName,
          appUrl,
        });

        await resend.emails.send({
          from: 'HireMetrics <onboarding@resend.dev>',
          to: [email],
          subject: '🎉 Welcome to HireMetrics - Your Account is Ready!',
          html: welcomeHtml,
        });

        logStep("Welcome email sent to new user", { email });
      } catch (emailError) {
        logStep("Error sending welcome email", { error: emailError });
      }

      // 2. Send notification to all super admins
      try {
        // Get all super admin emails
        const { data: superAdmins } = await supabaseAdmin
          .from('user_roles')
          .select('user_id')
          .eq('role', 'super_admin');

        if (superAdmins && superAdmins.length > 0) {
          const adminUserIds = superAdmins.map(sa => sa.user_id);
          
          const { data: adminProfiles } = await supabaseAdmin
            .from('profiles')
            .select('email, full_name')
            .in('id', adminUserIds)
            .eq('is_active', true);

          const adminEmails = adminProfiles?.map(p => p.email).filter(Boolean) || [];
          
          if (adminEmails.length > 0) {
            // Get caller name
            const { data: callerProfile } = await supabaseAdmin
              .from('profiles')
              .select('full_name, email')
              .eq('id', caller.id)
              .single();

            const adminNotificationHtml = generateAdminNotificationHTML({
              newUserName: fullName,
              newUserEmail: email,
              companyName,
              planName: planName || undefined,
              createdBy: callerProfile?.full_name || callerProfile?.email || 'Admin',
            });

            await resend.emails.send({
              from: 'HireMetrics <onboarding@resend.dev>',
              to: adminEmails,
              subject: `👤 New User Created: ${fullName}`,
              html: adminNotificationHtml,
            });

            logStep("Admin notification sent", { adminEmails });
          }
        }
      } catch (adminEmailError) {
        logStep("Error sending admin notification", { error: adminEmailError });
      }
    } else {
      logStep("RESEND_API_KEY not configured, skipping emails");
    }

    logStep("User creation completed successfully", { email });

    return jsonResponse({
      success: true,
      user: {
        id: newUser.user.id,
        email: newUser.user.email,
      },
    });
  } catch (error: any) {
    logStep("ERROR", { message: error.message, stack: error.stack });
    return jsonResponse({
      success: false,
      error: error?.message ?? "Unknown error",
      code: "internal_error",
    });
  }
});

