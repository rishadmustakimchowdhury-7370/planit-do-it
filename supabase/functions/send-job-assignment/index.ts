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

    // Build email HTML
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center; }
          .content { background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0; font-size: 28px;">🎯 New Job Assignment</h1>
          </div>
          <div class="content">
            <p>Hi <strong>${recruiter_name}</strong>,</p>
            <p>You have been assigned to a new job by <strong>${senderProfile.full_name || "your manager"}</strong>.</p>
            
            <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h2 style="margin-top: 0; color: #667eea;">📋 Job Details</h2>
              <p style="margin: 5px 0;"><strong>Job Title:</strong> ${job_title}</p>
            </div>

            <p>You can now start working on this job, submit candidates, and track your progress.</p>

            <div style="text-align: center;">
              <a href="${jobUrl}" class="button">View Job Details</a>
            </div>

            <p style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">
              This is an automated notification from your recruitment platform.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

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
      // Fallback to Resend
      const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
      if (!RESEND_API_KEY) {
        throw new Error("No email configuration available");
      }

      const resendResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: "Recruitment Platform <onboarding@resend.dev>",
          to: [recruiter_email],
          subject: `New Job Assignment: ${job_title}`,
          html: htmlContent,
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
