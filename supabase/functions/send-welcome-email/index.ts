import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import {
  sendSystemEmail,
  isDuplicateEmail,
  generateDedupKey,
  logEmailEvent,
  wrapSystemEmail,
  emailHeading,
  emailParagraph,
  buildEmailButton,
  emailInfoBox,
} from "../_shared/smtp-sender.ts";
import { getDashboardUrl } from "../_shared/app-url.ts";

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
  
  const bodyContent = `
    ${emailHeading(`${greeting},`, 1)}
    
    ${emailParagraph("Thank you for registering with HireMetrics. Your account has been created successfully, and you now have access to our enterprise recruitment management platform.")}
    
    ${emailParagraph("With HireMetrics, you can streamline your recruitment operations by managing candidates, tracking job applications, coordinating with clients, and leveraging AI-powered matching to find the best talent efficiently.")}
    
    ${emailParagraph("To get started, access your dashboard where you can create job listings, import candidates, and begin managing your recruitment pipeline.")}
    
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;">
      <tr>
        <td align="center">
          ${buildEmailButton("Access Your Dashboard", data.dashboardUrl)}
        </td>
      </tr>
    </table>
    
    ${emailInfoBox(`
      <strong style="display:block; margin-bottom:8px;">What you can do next:</strong>
      • Create and publish job listings<br/>
      • Add candidates manually or import from CSV<br/>
      • Use AI matching to find suitable candidates<br/>
      • Track your recruitment pipeline and analytics
    `, "info")}
    
    ${emailParagraph("Best regards,")}
    <p style="margin:0; font-family:Arial,sans-serif; font-size:15px; color:#0f172a; font-weight:600;">
      The HireMetrics Team
    </p>
  `;
  
  return wrapSystemEmail(bodyContent);
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
    const dashboardUrl = getDashboardUrl(req);

    console.log("[SEND-WELCOME-EMAIL] Using dashboard URL:", dashboardUrl);

    const htmlContent = generateWelcomeEmailHTML({
      userName,
      dashboardUrl,
    });

    // Send welcome email via SMTP (System email - from Super Admin)
    const result = await sendSystemEmail({
      to: email,
      subject: "Welcome to HireMetrics – Your Account is Ready",
      html: htmlContent,
    });

    if (!result.success) {
      logEmailEvent("Welcome email failed", { email, error: result.error });
      throw new Error(result.error || "Failed to send welcome email");
    }

    logEmailEvent("Welcome email sent successfully", { email, from: result.from });

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
        method: "smtp",
      },
    });

    return new Response(
      JSON.stringify({ success: true, email, from: result.from }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logEmailEvent("ERROR in welcome email function", { message: errorMessage });
    
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
