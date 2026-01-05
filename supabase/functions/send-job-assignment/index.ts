import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  sendOperationalEmail,
  logEmailEvent,
} from "../_shared/smtp-sender.ts";

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

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const supabaseUser = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    const body: JobAssignmentRequest = await req.json();
    const { job_id, job_title, recruiter_email, recruiter_name } = body;

    console.log(`[SMTP] Sending job assignment notification to ${recruiter_email}`);

    // Get sender's profile
    const { data: senderProfile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("full_name, tenant_id")
      .eq("id", user.id)
      .single();

    if (profileError) {
      console.error("Profile error:", profileError);
      throw new Error("Failed to fetch sender profile");
    }

    // Get app origin from request headers
    const origin = req.headers.get("origin") || "https://hiremetrics.co.uk";
    const jobUrl = `${origin}/jobs/${job_id}`;
    const senderName = senderProfile.full_name || "your manager";

    // Build email HTML
    const htmlContent = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head><body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica Neue,Arial,sans-serif;background-color:#f1f5f9;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9;"><tr><td align="center" style="padding:40px 20px;"><table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);"><tr><td style="background:linear-gradient(135deg,#00008B 0%,#0052CC 100%);padding:35px 40px;text-align:center;"><h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:700;">🎯 New Job Assignment</h1></td></tr><tr><td style="padding:40px;"><p style="margin:0 0 20px;color:#1e293b;font-size:18px;">Hi <strong>${recruiter_name}</strong>,</p><p style="margin:0 0 30px;color:#475569;font-size:16px;line-height:1.7;">You have been assigned to a new job by <strong>${senderName}</strong>.</p><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:12px;border:1px solid #e2e8f0;margin-bottom:30px;"><tr><td style="padding:24px;"><h2 style="margin:0 0 12px;color:#00008B;font-size:18px;font-weight:600;">📋 Job Details</h2><p style="margin:0;color:#1e293b;font-size:16px;"><strong>Job Title:</strong> ${job_title}</p></td></tr></table><p style="margin:0 0 25px;color:#475569;font-size:15px;line-height:1.6;">You can now start working on this job, submit candidates, and track your progress.</p><table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;"><tr><td align="center"><a href="${jobUrl}" style="display:inline-block;background:linear-gradient(135deg,#00008B 0%,#0052CC 100%);color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:600;font-size:16px;">View Job Details</a></td></tr></table><p style="margin:30px 0 0;padding-top:25px;border-top:1px solid #e2e8f0;color:#64748b;font-size:13px;text-align:center;">This is an automated notification from your recruitment platform.</p></td></tr><tr><td style="background:#f8fafc;padding:20px 40px;border-top:1px solid #e2e8f0;text-align:center;"><p style="margin:0;color:#94a3b8;font-size:12px;">© ${new Date().getFullYear()} HireMetrics. All rights reserved.</p></td></tr></table></td></tr></table></body></html>`;

    logEmailEvent("Sending job assignment email", { to: recruiter_email, job_title });

    // Send email via SMTP
    const result = await sendOperationalEmail(
      senderProfile.tenant_id,
      user.id,
      senderName,
      {
        to: recruiter_email,
        subject: `New Job Assignment: ${job_title}`,
        html: htmlContent,
      }
    );

    if (!result.success) {
      throw new Error(result.error || "Failed to send email");
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

    logEmailEvent("Job assignment notification sent", { to: recruiter_email, method: result.method });

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
