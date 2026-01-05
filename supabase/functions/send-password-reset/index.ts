import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import {
  sendSystemEmail,
  logEmailEvent,
} from "../_shared/smtp-sender.ts";
import { getAppBaseUrl } from "../_shared/app-url.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PasswordResetRequest {
  email: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email }: PasswordResetRequest = await req.json();

    if (!email) {
      return new Response(
        JSON.stringify({ error: "Email is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if user exists
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, email, full_name")
      .eq("email", email)
      .single();

    // Always return success even if user doesn't exist (security best practice)
    if (!profile) {
      console.log(`Password reset requested for non-existent email: ${email}`);
      return new Response(
        JSON.stringify({ success: true, message: "If the email exists, a reset link has been sent" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the app base URL for redirects
    const appBaseUrl = await getAppBaseUrl();
    
    // Generate password reset link using Supabase Admin API
    const { data: resetData, error: resetError } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email: email,
      options: {
        redirectTo: `${appBaseUrl}/auth?mode=reset`
      }
    });

    if (resetError) {
      console.error("Error generating reset link:", resetError);
      throw resetError;
    }

    const resetLink = resetData.properties?.action_link || '';

    logEmailEvent("Sending password reset email", { to: email });

    // Send email via SMTP
    const result = await sendSystemEmail({
      to: email,
      subject: "Reset Your Password - HireMetrics CRM",
      html: `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head><body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f1f5f9;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f1f5f9;"><tr><td align="center" style="padding: 40px 20px;"><table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);"><tr><td style="padding: 30px 40px; background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%); border-bottom: 1px solid #e2e8f0; text-align: center;"><table cellpadding="0" cellspacing="0" style="margin: 0 auto;"><tr><td style="background: linear-gradient(135deg, #00008B 0%, #0052CC 100%); border-radius: 10px; padding: 10px;"><svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg></td><td style="padding-left: 12px; font-family: 'Segoe UI', Arial, sans-serif; font-weight: 700; font-size: 22px;"><span style="color: #00008B;">Hire</span><span style="color: #64748b; font-weight: 500;">Metrics</span></td></tr></table></td></tr><tr><td style="padding: 40px;"><h1 style="margin: 0 0 24px; color: #00008B; font-size: 24px; font-weight: 700;">Reset Your Password</h1><p style="margin: 0 0 20px; color: #374151; font-size: 16px; line-height: 1.6;">Hello ${profile.full_name || 'there'},</p><p style="margin: 0 0 30px; color: #374151; font-size: 16px; line-height: 1.6;">We received a request to reset your password for your HireMetrics CRM account. Click the button below to create a new password:</p><table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 auto 30px;"><tr><td align="center"><a href="${resetLink}" style="display: inline-block; background: linear-gradient(135deg, #00008B 0%, #0052CC 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">Reset Password</a></td></tr></table><p style="margin: 0 0 16px; color: #6b7280; font-size: 14px; line-height: 1.6;">Or copy and paste this link into your browser:</p><p style="margin: 0 0 24px; color: #00008B; font-size: 12px; word-break: break-all; background: #f3f4f6; padding: 12px; border-radius: 6px;">${resetLink}</p><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #fef3c7; border-radius: 8px; border: 1px solid #fcd34d; margin-bottom: 24px;"><tr><td style="padding: 16px;"><p style="margin: 0; color: #92400e; font-size: 14px;">⏰ This link will expire in 1 hour for security reasons.</p></td></tr></table><p style="margin: 0; color: #6b7280; font-size: 14px; line-height: 1.6;">If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.</p><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top: 1px solid #e5e7eb; margin-top: 30px; padding-top: 20px;"><tr><td><p style="margin: 0; color: #6b7280; font-size: 14px; line-height: 1.6;">Best regards,<br/><strong style="color: #00008B;">The HireMetrics Team</strong><br/><a href="mailto:admin@hiremetrics.co.uk" style="color: #0052CC; text-decoration: none;">admin@hiremetrics.co.uk</a></p></td></tr></table></td></tr><tr><td style="background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%); padding: 24px 40px; border-top: 1px solid #e2e8f0; text-align: center;"><p style="margin: 0 0 8px; color: #64748b; font-size: 13px;">Powered by <strong style="color: #00008B;">HireMetrics</strong></p><p style="margin: 0; color: #94a3b8; font-size: 11px;">© ${new Date().getFullYear()} HireMetrics. All rights reserved.</p></td></tr></table></td></tr></table></body></html>`,
    });

    if (!result.success) {
      console.error("Failed to send password reset email:", result.error);
      throw new Error("Failed to send password reset email");
    }

    logEmailEvent("Password reset email sent", { to: email, method: result.method });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Password reset email sent successfully" 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Error in send-password-reset function:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message || "An error occurred while processing your request" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
