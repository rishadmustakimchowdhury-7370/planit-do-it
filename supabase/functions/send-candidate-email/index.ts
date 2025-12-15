import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Attachment {
  name: string;
  url: string;
  size?: number;
  type?: string;
}

interface SendEmailRequest {
  candidate_id: string;
  job_id?: string;
  from_email: string;
  from_account_id?: string;
  to_email: string;
  cc_email?: string | null;
  bcc_email?: string | null;
  subject: string;
  body_text: string;
  template_id?: string;
  ai_generated?: boolean;
  scheduled_at?: string;
  timezone?: string | null;
  attachments?: Attachment[];
  signature?: string | null;
}

// Professional HTML email template
const createEmailHtml = (
  bodyText: string, 
  signature: string | null, 
  recruiterName: string,
  recruiterEmail: string,
  attachmentLinks?: Attachment[]
): string => {
  // Convert plain text line breaks to HTML
  const formattedBody = bodyText
    .split('\n')
    .map(line => line.trim() ? `<p style="margin: 0 0 12px 0; line-height: 1.6;">${line}</p>` : '<br/>')
    .join('');

  const signatureHtml = signature 
    ? `<div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e5e7eb;">
        ${signature.split('\n').map(line => 
          line.trim() ? `<p style="margin: 0 0 4px 0; color: #374151; font-size: 14px;">${line}</p>` : ''
        ).join('')}
      </div>`
    : `<div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e5e7eb;">
        <p style="margin: 0 0 4px 0; color: #374151; font-size: 14px; font-weight: 600;">${recruiterName}</p>
        <p style="margin: 0; color: #6b7280; font-size: 13px;">${recruiterEmail}</p>
      </div>`;

  // Attachments section
  let attachmentsHtml = '';
  if (attachmentLinks && attachmentLinks.length > 0) {
    attachmentsHtml = `
      <div style="margin-top: 16px; padding: 12px; background-color: #f9fafb; border-radius: 8px; border: 1px solid #e5e7eb;">
        <p style="margin: 0 0 8px 0; font-size: 13px; font-weight: 600; color: #374151;">Attachments (${attachmentLinks.length})</p>
        ${attachmentLinks.map(att => `
          <a href="${att.url}" style="display: inline-block; margin: 4px 8px 4px 0; padding: 6px 12px; background-color: #e5e7eb; color: #374151; text-decoration: none; border-radius: 4px; font-size: 12px;">📎 ${att.name}</a>
        `).join('')}
      </div>`;
  }

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Email</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f3f4f6;">
    <tr>
      <td style="padding: 32px 16px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="margin: 0 auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);">
          <!-- Header -->
          <tr>
            <td style="padding: 32px 32px 0 32px;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td>
                    <img src="https://efdvolifacsnmiinifiq.supabase.co/storage/v1/object/public/documents/brand/logo.png" alt="RecruitifyCRM" height="36" style="display: block;" onerror="this.style.display='none'"/>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding: 24px 32px 32px 32px; color: #1f2937; font-size: 15px; line-height: 1.6;">
              ${formattedBody}
              ${signatureHtml}
              ${attachmentsHtml}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 24px 32px; background-color: #f9fafb; border-top: 1px solid #e5e7eb; border-radius: 0 0 12px 12px;">
              <p style="margin: 0; color: #9ca3af; font-size: 12px; text-align: center;">
                This email was sent via <a href="https://recruitifycrm.com" style="color: #0052cc; text-decoration: none;">RecruitifyCRM</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
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

    // Get current user
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    // Get user's tenant and profile details
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("tenant_id, full_name, email_signature, email")
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
      from_account_id,
      to_email,
      cc_email,
      bcc_email,
      subject,
      body_text,
      template_id,
      ai_generated,
      scheduled_at,
      timezone,
      attachments,
      signature,
    } = body;

    // Determine sender email - prefer user's email
    const senderEmail = profile.email || from_email || "info@recruitifycrm.com";
    const senderName = profile.full_name || "RecruitifyCRM";

    // Check if user has a configured email account to send from
    let emailAccount = null;
    if (from_account_id) {
      const { data: account } = await supabaseAdmin
        .from("email_accounts")
        .select("*")
        .eq("id", from_account_id)
        .eq("user_id", user.id)
        .single();
      
      if (account && account.status === "connected") {
        emailAccount = account;
      }
    }

    // Create professional HTML email
    const emailHtml = createEmailHtml(
      body_text,
      signature ?? profile.email_signature,
      senderName,
      senderEmail,
      attachments
    );

    // Calculate the actual scheduled datetime considering timezone
    let scheduledDateTime: string | null = null;
    if (scheduled_at) {
      // The scheduled_at from frontend is in local format: YYYY-MM-DDTHH:MM:SS
      // We store it as-is since it's already in the user's intended timezone
      scheduledDateTime = scheduled_at;
      
      // If timezone is provided, append it for reference
      if (timezone) {
        console.log(`Scheduling email for ${scheduled_at} in timezone ${timezone}`);
      }
    }

    // If scheduled for later, save to database and return
    if (scheduledDateTime && new Date(scheduledDateTime) > new Date()) {
      const { data: emailRecord, error: insertError } = await supabaseAdmin
        .from("candidate_emails")
        .insert({
          tenant_id: profile.tenant_id,
          candidate_id,
          job_id,
          sent_by: user.id,
          from_email: senderEmail,
          from_account_id: emailAccount?.id || null,
          to_email,
          subject,
          body_text: emailHtml,
          template_id,
          ai_generated: ai_generated || false,
          status: "scheduled",
          scheduled_at: scheduledDateTime,
          timezone: timezone || "UTC",
          attachments: attachments || [],
          retry_count: 0,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      console.log(`Email ${emailRecord.id} scheduled for: ${scheduledDateTime} (${timezone || "UTC"})`);
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Email scheduled",
          email_id: emailRecord.id,
          scheduled_at: scheduledDateTime,
          timezone: timezone || "UTC",
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
        // Add tracking pixel
        const trackingId = crypto.randomUUID();
        const trackingPixel = `<img src="${SUPABASE_URL}/functions/v1/track-email?id=${trackingId}&type=open" width="1" height="1" style="display:none" alt=""/>`;
        const emailWithTracking = emailHtml.replace('</body>', `${trackingPixel}</body>`);

        // Build recipient lists
        const toRecipients = [to_email];
        const ccRecipients = cc_email ? cc_email.split(',').map(e => e.trim()).filter(Boolean) : [];
        const bccRecipients = bcc_email ? bcc_email.split(',').map(e => e.trim()).filter(Boolean) : [];

        // Prepare attachments for Resend
        const resendAttachments = attachments?.map(att => ({
          filename: att.name,
          path: att.url,
        })) || [];

        const emailPayload: Record<string, unknown> = {
          from: `${senderName} <info@recruitifycrm.com>`,
          reply_to: senderEmail,
          to: toRecipients,
          subject: subject,
          html: emailWithTracking,
        };
        
        if (ccRecipients.length > 0) emailPayload.cc = ccRecipients;
        if (bccRecipients.length > 0) emailPayload.bcc = bccRecipients;
        if (resendAttachments.length > 0) emailPayload.attachments = resendAttachments;

        console.log(`Sending email to ${to_email} from ${senderEmail}`);

        const resendResponse = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(emailPayload),
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
        from_email: senderEmail,
        from_account_id: emailAccount?.id || null,
        to_email,
        subject,
        body_text: emailHtml,
        template_id,
        ai_generated: ai_generated || false,
        status: emailSent ? "sent" : "failed",
        sent_at: emailSent ? new Date().toISOString() : null,
        provider_message_id: providerMessageId,
        error_message: errorMessage,
        attachments: attachments || [],
        timezone: timezone || "UTC",
        retry_count: 0,
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
        sender_email: senderEmail,
        has_attachments: attachments && attachments.length > 0,
        attachment_count: attachments?.length || 0,
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
        sent_from: senderEmail,
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
