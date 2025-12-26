import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import {
  createResendClient,
  sendEmailWithRetry,
  isDuplicateEmail,
  generateDedupKey,
  logEmailEvent,
} from "../_shared/email-config.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface WelcomeEmailRequest {
  user_id: string;
  email: string;
  full_name?: string;
  tenant_name?: string;
}

function generateWelcomeEmailHTML(data: {
  userName: string;
  dashboardUrl: string;
}): string {
  const greeting = data.userName ? `Dear ${data.userName}` : "Welcome";
  
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to HireMetrics</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f8fafc; line-height: 1.6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);">
          
          <!-- Logo Header -->
          <tr>
            <td style="padding: 32px 40px 24px; text-align: center; border-bottom: 1px solid #e2e8f0;">
              <table cellpadding="0" cellspacing="0" style="margin: 0 auto;">
                <tr>
                  <td style="background-color: #00008B; width: 40px; height: 40px; border-radius: 8px; text-align: center; vertical-align: middle;">
                    <span style="color: #ffffff; font-size: 20px; font-weight: bold;">H</span>
                  </td>
                  <td style="padding-left: 12px;">
                    <span style="color: #00008B; font-size: 22px; font-weight: 700; letter-spacing: -0.5px;">HireMetrics</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Main Content -->
          <tr>
            <td style="padding: 40px;">
              <!-- Greeting -->
              <h1 style="margin: 0 0 24px; color: #1e293b; font-size: 24px; font-weight: 600;">
                ${greeting},
              </h1>
              
              <!-- Introduction Paragraph -->
              <p style="margin: 0 0 20px; color: #475569; font-size: 16px;">
                Thank you for registering with HireMetrics. Your account has been created successfully, and you now have access to our enterprise recruitment management platform.
              </p>
              
              <!-- Value Proposition Paragraph -->
              <p style="margin: 0 0 20px; color: #475569; font-size: 16px;">
                With HireMetrics, you can streamline your recruitment operations by managing candidates, tracking job applications, coordinating with clients, and leveraging AI-powered matching to find the best talent efficiently. Our platform is designed to support your hiring workflow from start to finish.
              </p>
              
              <!-- Call-to-Action Paragraph -->
              <p style="margin: 0 0 32px; color: #475569; font-size: 16px;">
                To get started, access your dashboard where you can create job listings, import candidates, and begin managing your recruitment pipeline.
              </p>
              
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="text-align: center;">
                    <a href="${data.dashboardUrl}" 
                       style="display: inline-block; background-color: #00008B; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-weight: 600; font-size: 16px;">
                      Access Your Dashboard
                    </a>
                  </td>
                </tr>
              </table>
              
              <!-- Additional Info -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-top: 32px; background-color: #f8fafc; border-radius: 6px; border: 1px solid #e2e8f0;">
                <tr>
                  <td style="padding: 20px;">
                    <h3 style="margin: 0 0 12px; color: #1e293b; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
                      What you can do next
                    </h3>
                    <ul style="margin: 0; padding: 0 0 0 20px; color: #475569; font-size: 14px;">
                      <li style="margin-bottom: 8px;">Create and publish job listings</li>
                      <li style="margin-bottom: 8px;">Add candidates manually or import from CSV</li>
                      <li style="margin-bottom: 8px;">Use AI matching to find suitable candidates</li>
                      <li style="margin-bottom: 0;">Track your recruitment pipeline and analytics</li>
                    </ul>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Signature -->
          <tr>
            <td style="padding: 0 40px 40px;">
              <p style="margin: 0; color: #475569; font-size: 16px;">
                Best regards,<br>
                <strong style="color: #1e293b;">The HireMetrics Team</strong>
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 24px 40px; border-top: 1px solid #e2e8f0;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="text-align: center;">
                    <p style="margin: 0 0 8px; color: #64748b; font-size: 14px; font-weight: 600;">
                      HireMetrics
                    </p>
                    <p style="margin: 0 0 8px; color: #64748b; font-size: 13px;">
                      Need help? Contact us at 
                      <a href="mailto:admin@hiremetrics.co.uk" style="color: #00008B; text-decoration: none;">admin@hiremetrics.co.uk</a>
                    </p>
                    <p style="margin: 0; color: #94a3b8; font-size: 12px;">
                      This email was sent because you created an account on HireMetrics.
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

function generatePlainTextVersion(data: {
  userName: string;
  dashboardUrl: string;
}): string {
  const greeting = data.userName ? `Dear ${data.userName}` : "Welcome";
  
  return `
${greeting},

Thank you for registering with HireMetrics. Your account has been created successfully, and you now have access to our enterprise recruitment management platform.

With HireMetrics, you can streamline your recruitment operations by managing candidates, tracking job applications, coordinating with clients, and leveraging AI-powered matching to find the best talent efficiently. Our platform is designed to support your hiring workflow from start to finish.

To get started, access your dashboard where you can create job listings, import candidates, and begin managing your recruitment pipeline.

Access Your Dashboard: ${data.dashboardUrl}

What you can do next:
- Create and publish job listings
- Add candidates manually or import from CSV
- Use AI matching to find suitable candidates
- Track your recruitment pipeline and analytics

Best regards,
The HireMetrics Team

---
HireMetrics
Need help? Contact us at admin@hiremetrics.co.uk

This email was sent because you created an account on HireMetrics.
  `.trim();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logEmailEvent("Welcome email function started", {});

    const body: WelcomeEmailRequest = await req.json();
    const { user_id, email, full_name, tenant_name } = body;

    if (!email) {
      throw new Error("Email address is required");
    }

    logEmailEvent("Processing welcome email", { user_id, email, full_name });

    // Check for duplicate sends
    const dedupKey = generateDedupKey(email, "welcome-email", "registration");
    if (isDuplicateEmail(dedupKey)) {
      logEmailEvent("Duplicate welcome email prevented", { email });
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: "duplicate" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Prepare email data
    const userName = full_name || email.split("@")[0];
    const dashboardUrl = "https://hiremetrics.lovable.app/dashboard";

    const htmlContent = generateWelcomeEmailHTML({
      userName,
      dashboardUrl,
    });

    // Send welcome email with retry
    const resend = createResendClient();
    
    // Small jitter to avoid rate limiting
    await new Promise((r) => setTimeout(r, Math.floor(100 + Math.random() * 300)));

    const result = await sendEmailWithRetry(resend, {
      to: email,
      subject: "Welcome to HireMetrics – Your Account is Ready",
      html: htmlContent,
      senderType: "default",
    });

    if (result.error) {
      logEmailEvent("Welcome email failed", { 
        email, 
        error: result.error 
      });
      throw new Error(result.error.message || "Failed to send welcome email");
    }

    logEmailEvent("Welcome email sent successfully", { 
      email, 
      messageId: result.data?.id 
    });

    // Log to email_logs table for tracking
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Get tenant_id from user's profile
    let tenantId = null;
    if (user_id) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user_id)
        .single();
      tenantId = profile?.tenant_id;
    }

    // Log the email
    await supabase.from("email_logs").insert({
      recipient_email: email,
      subject: "Welcome to HireMetrics – Your Account is Ready",
      template_name: "welcome_registration",
      status: "sent",
      sent_at: new Date().toISOString(),
      sent_by: user_id,
      tenant_id: tenantId,
      metadata: {
        user_name: userName,
        message_id: result.data?.id,
      },
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        messageId: result.data?.id,
        email 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logEmailEvent("ERROR in welcome email function", { message: errorMessage });
    
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
