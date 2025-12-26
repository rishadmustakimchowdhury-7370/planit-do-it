import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface JobAssignmentRequest {
  job_id: string;
  job_title: string;
  recruiter_email: string;
  recruiter_name: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Get user from auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const supabaseUser = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify user
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    const body: JobAssignmentRequest = await req.json();
    const { job_id, job_title, recruiter_email, recruiter_name } = body;

    console.log(`Sending job assignment notification to ${recruiter_email}`);

    // Get sender's profile and email account
    const { data: senderProfile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("full_name, tenant_id")
      .eq("id", user.id)
      .single();

    if (profileError) {
      console.error("Profile error:", profileError);
      throw new Error("Failed to fetch sender profile");
    }

    // Get default email account for the sender
    const { data: emailAccount, error: accountError } = await supabaseAdmin
      .from("email_accounts")
      .select("*")
      .eq("user_id", user.id)
      .eq("tenant_id", senderProfile.tenant_id)
      .eq("status", "connected")
      .order("is_default", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (accountError) {
      console.error("Email account error:", accountError);
    }

    // Get app origin from request headers
    const origin = req.headers.get("origin") || "https://efdvolifacsnmiinifiq.supabase.co";
    const jobUrl = `${origin}/jobs/${job_id}`;
    const senderName = senderProfile.full_name || "your manager";

    // Build email HTML (minified to prevent quoted-printable encoding artifacts like "=20")
    const htmlContent = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head><body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica Neue,Arial,sans-serif;background-color:#f1f5f9;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9;"><tr><td align="center" style="padding:40px 20px;"><table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);"><tr><td style="background:linear-gradient(135deg,#00008B 0%,#0052CC 100%);padding:35px 40px;text-align:center;"><h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:700;">🎯 New Job Assignment</h1></td></tr><tr><td style="padding:40px;"><p style="margin:0 0 20px;color:#1e293b;font-size:18px;">Hi <strong>${recruiter_name}</strong>,</p><p style="margin:0 0 30px;color:#475569;font-size:16px;line-height:1.7;">You have been assigned to a new job by <strong>${senderName}</strong>.</p><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:12px;border:1px solid #e2e8f0;margin-bottom:30px;"><tr><td style="padding:24px;"><h2 style="margin:0 0 12px;color:#00008B;font-size:18px;font-weight:600;">📋 Job Details</h2><p style="margin:0;color:#1e293b;font-size:16px;"><strong>Job Title:</strong> ${job_title}</p></td></tr></table><p style="margin:0 0 25px;color:#475569;font-size:15px;line-height:1.6;">You can now start working on this job, submit candidates, and track your progress.</p><table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;"><tr><td align="center"><a href="${jobUrl}" style="display:inline-block;background:linear-gradient(135deg,#00008B 0%,#0052CC 100%);color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:600;font-size:16px;">View Job Details</a></td></tr></table><p style="margin:30px 0 0;padding-top:25px;border-top:1px solid #e2e8f0;color:#64748b;font-size:13px;text-align:center;">This is an automated notification from your recruitment platform.</p></td></tr><tr><td style="background:#f8fafc;padding:20px 40px;border-top:1px solid #e2e8f0;text-align:center;"><p style="margin:0;color:#94a3b8;font-size:12px;">&copy; ${new Date().getFullYear()} HireMetrics. All rights reserved.</p></td></tr></table></td></tr></table></body></html>`;

    // Send email
    if (emailAccount && emailAccount.provider === "smtp") {
      // Use SMTP
      const { error: smtpError } = await supabaseUser.functions.invoke("send-email-smtp", {
        body: {
          account_id: emailAccount.id,
          to_email: recruiter_email,
          subject: `New Job Assignment: ${job_title}`,
          html_body: htmlContent,
          text_body: `Hi ${recruiter_name}, You have been assigned to a new job: ${job_title}. View details: ${jobUrl}`,
        },
      });

      if (smtpError) throw smtpError;
    } else {
      // Fallback to Resend with centralized config
      const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
      if (!RESEND_API_KEY) {
        throw new Error("No email configuration available");
      }

      // Use centralized email configuration
      const fromAddress = "HireMetrics <admin@hiremetrics.co.uk>";
      const replyToAddress = "admin@hiremetrics.co.uk";

      const resendResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: fromAddress,
          to: [recruiter_email],
          subject: `New Job Assignment: ${job_title}`,
          html: htmlContent,
          reply_to: replyToAddress,
        }),
      });

      if (!resendResponse.ok) {
        const errorText = await resendResponse.text();
        throw new Error(`Resend error: ${errorText}`);
      }
    }

    // Create notification in database
    await supabaseAdmin.from("notifications").insert({
      tenant_id: senderProfile.tenant_id,
      user_id: await getRecruiterUserId(supabaseAdmin, recruiter_email),
      type: "job_assignment",
      title: "New Job Assignment",
      message: `You have been assigned to the job: ${job_title}`,
      link: `/jobs/${job_id}`,
      entity_type: "job",
      entity_id: job_id,
      metadata: { assigned_by: user.id, job_title },
    });

    console.log(`Job assignment notification sent successfully to ${recruiter_email}`);

    return new Response(
      JSON.stringify({ success: true, message: "Assignment notification sent" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Job assignment notification error:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Failed to send notification" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function getRecruiterUserId(supabase: any, email: string): Promise<string> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", email)
    .single();
  
  if (error || !data) {
    throw new Error("Recruiter not found");
  }
  
  return data.id;
}
