import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendEmailRequest {
  candidate_id: string;
  job_id?: string;
  from_email: string;
  to_email: string;
  subject: string;
  body_text: string;
  template_id?: string;
  ai_generated?: boolean;
  scheduled_at?: string;
  attachments?: Array<{ name: string; url: string }>;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Get user from auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const supabaseUser = createClient(SUPABASE_URL, authHeader.replace("Bearer ", ""), {
      global: { headers: { Authorization: authHeader } },
    });

    // Get current user
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    // Get user's tenant
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("tenant_id, full_name, email_signature")
      .eq("id", user.id)
      .single();

    if (!profile?.tenant_id) {
      throw new Error("User has no tenant");
    }

    const body: SendEmailRequest = await req.json();
    const {
      candidate_id,
      job_id,
      from_email,
      to_email,
      subject,
      body_text,
      template_id,
      ai_generated,
      scheduled_at,
      attachments,
    } = body;

    // If scheduled for later, save to database and return
    if (scheduled_at && new Date(scheduled_at) > new Date()) {
      const { data: emailRecord, error: insertError } = await supabaseAdmin
        .from("candidate_emails")
        .insert({
          tenant_id: profile.tenant_id,
          candidate_id,
          job_id,
          sent_by: user.id,
          from_email,
          to_email,
          subject,
          body_text,
          template_id,
          ai_generated: ai_generated || false,
          status: "scheduled",
          scheduled_at,
          attachments: attachments || [],
        })
        .select()
        .single();

      if (insertError) throw insertError;

      console.log("Email scheduled for:", scheduled_at);
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Email scheduled",
          email_id: emailRecord.id,
          scheduled_at,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send immediately
    let emailSent = false;
    let providerMessageId: string | null = null;
    let errorMessage: string | null = null;

    if (RESEND_API_KEY) {
      // Send via Resend API
      try {
        const resendResponse = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: from_email.includes("@") && !from_email.includes("resend.dev") && !from_email.includes("recruitsy") 
              ? from_email 
              : "RecruitifyCRM <info@recruitifycrm.com>",
            to: [to_email],
            subject: subject,
            text: body_text,
          }),
        });

        const resendData = await resendResponse.json();
        
        if (!resendResponse.ok) {
          throw new Error(resendData.message || "Resend API error");
        }

        providerMessageId = resendData.id || null;
        emailSent = true;
        console.log("Email sent via Resend:", providerMessageId);
      } catch (resendError: any) {
        console.error("Resend error:", resendError);
        errorMessage = resendError.message;
      }
    } else {
      errorMessage = "No email provider configured (RESEND_API_KEY missing)";
      console.warn(errorMessage);
    }

    // Save email record
    const { data: emailRecord, error: insertError } = await supabaseAdmin
      .from("candidate_emails")
      .insert({
        tenant_id: profile.tenant_id,
        candidate_id,
        job_id,
        sent_by: user.id,
        from_email,
        to_email,
        subject,
        body_text,
        template_id,
        ai_generated: ai_generated || false,
        status: emailSent ? "sent" : "failed",
        sent_at: emailSent ? new Date().toISOString() : null,
        provider_message_id: providerMessageId,
        error_message: errorMessage,
        attachments: attachments || [],
      })
      .select()
      .single();

    if (insertError) {
      console.error("Failed to save email record:", insertError);
    }

    // Log to email_logs for audit
    await supabaseAdmin.from("email_logs").insert({
      tenant_id: profile.tenant_id,
      sent_by: user.id,
      recipient_email: to_email,
      subject,
      status: emailSent ? "sent" : "failed",
      error_message: errorMessage,
      metadata: {
        candidate_id,
        job_id,
        ai_generated,
        email_record_id: emailRecord?.id,
      },
    });

    if (!emailSent) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: errorMessage || "Failed to send email",
          email_id: emailRecord?.id,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Email sent successfully",
        email_id: emailRecord?.id,
        provider_message_id: providerMessageId,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in send-candidate-email:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
