import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

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

interface EmailAccount {
  id: string;
  provider: string;
  from_email: string;
  display_name: string;
  smtp_host: string | null;
  smtp_port: number | null;
  smtp_user: string | null;
  smtp_password: string | null;
  smtp_use_tls: boolean | null;
  status: string;
}

interface SendEmailRequest {
  candidate_id: string;
  job_id?: string;
  from_email?: string;
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
  use_system_fallback?: boolean; // If true, allows system email as fallback
}

// Professional HTML email template
const createEmailHtml = (
  bodyText: string, 
  signature: string | null, 
  recruiterName: string,
  recruiterEmail: string,
  attachmentLinks?: Attachment[]
): string => {
  // Convert plain text line breaks to HTML paragraphs
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
          <!-- Body -->
          <tr>
            <td style="padding: 32px; color: #1f2937; font-size: 15px; line-height: 1.6;">
              ${formattedBody}
              ${signatureHtml}
              ${attachmentsHtml}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
};

// Send email via SMTP
async function sendViaSMTP(
  account: EmailAccount,
  toEmail: string,
  ccEmail: string | null,
  bccEmail: string | null,
  subject: string,
  htmlBody: string,
  attachments?: Attachment[]
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (!account.smtp_host || !account.smtp_user || !account.smtp_password) {
    return { success: false, error: "SMTP account not properly configured" };
  }

  try {
    const client = new SMTPClient({
      connection: {
        hostname: account.smtp_host,
        port: account.smtp_port || 587,
        tls: account.smtp_use_tls ?? true,
        auth: {
          username: account.smtp_user,
          password: account.smtp_password,
        },
      },
    });

    const toList = toEmail.split(",").map(e => e.trim()).filter(Boolean);
    const ccList = ccEmail ? ccEmail.split(",").map(e => e.trim()).filter(Boolean) : [];
    const bccList = bccEmail ? bccEmail.split(",").map(e => e.trim()).filter(Boolean) : [];

    await client.send({
      from: `${account.display_name} <${account.from_email}>`,
      to: toList,
      cc: ccList.length > 0 ? ccList : undefined,
      bcc: bccList.length > 0 ? bccList : undefined,
      subject: subject,
      content: "Please view this email in an HTML-compatible client.",
      html: htmlBody,
    });

    await client.close();

    console.log(`Email sent via SMTP from ${account.from_email} to ${toEmail}`);
    return { success: true, messageId: crypto.randomUUID() };
  } catch (error) {
    console.error("SMTP send error:", error);
    return { success: false, error: error instanceof Error ? error.message : "SMTP send failed" };
  }
}

// Send email via Resend (system fallback)
async function sendViaResend(
  resendApiKey: string,
  supabaseUrl: string,
  fromName: string,
  replyToEmail: string,
  toEmail: string,
  ccEmail: string | null,
  bccEmail: string | null,
  subject: string,
  htmlBody: string,
  attachments?: Attachment[]
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const trackingId = crypto.randomUUID();
    const trackingPixel = `<img src="${supabaseUrl}/functions/v1/track-email?id=${trackingId}&type=open" width="1" height="1" style="display:none" alt=""/>`;
    const emailWithTracking = htmlBody.replace('</body>', `${trackingPixel}</body>`);

    const toRecipients = [toEmail];
    const ccRecipients = ccEmail ? ccEmail.split(',').map(e => e.trim()).filter(Boolean) : [];
    const bccRecipients = bccEmail ? bccEmail.split(',').map(e => e.trim()).filter(Boolean) : [];

    const resendAttachments = attachments?.map(att => ({
      filename: att.name,
      path: att.url,
    })) || [];

    const emailPayload: Record<string, unknown> = {
      from: `${fromName} <info@recruitifycrm.com>`,
      reply_to: replyToEmail,
      to: toRecipients,
      subject: subject,
      html: emailWithTracking,
    };
    
    if (ccRecipients.length > 0) emailPayload.cc = ccRecipients;
    if (bccRecipients.length > 0) emailPayload.bcc = bccRecipients;
    if (resendAttachments.length > 0) emailPayload.attachments = resendAttachments;

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(emailPayload),
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || "Resend API error");
    }

    console.log(`Email sent via Resend (system) to ${toEmail}, reply-to: ${replyToEmail}`);
    return { success: true, messageId: data.id };
  } catch (error) {
    console.error("Resend send error:", error);
    return { success: false, error: error instanceof Error ? error.message : "Resend send failed" };
  }
}

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
      use_system_fallback = false,
    } = body;

    const recruiterName = profile.full_name || "Recruiter";
    const recruiterEmail = profile.email || "noreply@recruitifycrm.com";

    // Try to get user's email account
    let emailAccount: EmailAccount | null = null;
    let sendingMethod: "smtp" | "resend" | "blocked" = "blocked";

    // First, try to get the specified account
    if (from_account_id) {
      const { data: account } = await supabaseAdmin
        .from("email_accounts")
        .select("*")
        .eq("id", from_account_id)
        .eq("user_id", user.id)
        .eq("status", "connected")
        .single();
      
      if (account) {
        emailAccount = account as EmailAccount;
      }
    }

    // If no specific account, try to get user's default account
    if (!emailAccount) {
      const { data: defaultAccount } = await supabaseAdmin
        .from("email_accounts")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_default", true)
        .eq("status", "connected")
        .single();
      
      if (defaultAccount) {
        emailAccount = defaultAccount as EmailAccount;
      }
    }

    // If still no account, try any connected account for the user
    if (!emailAccount) {
      const { data: anyAccount } = await supabaseAdmin
        .from("email_accounts")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "connected")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      
      if (anyAccount) {
        emailAccount = anyAccount as EmailAccount;
      }
    }

    // Determine sending method
    if (emailAccount && emailAccount.provider === "smtp") {
      sendingMethod = "smtp";
    } else if (use_system_fallback && RESEND_API_KEY) {
      sendingMethod = "resend";
    } else if (!emailAccount && RESEND_API_KEY) {
      // No user account configured - we'll still send but with clear warning
      sendingMethod = "resend";
      console.warn(`No email account configured for user ${user.id}, using system fallback`);
    }

    // Determine sender email for display/logging
    const senderEmail = emailAccount?.from_email || profile.email || "info@recruitifycrm.com";
    const senderName = emailAccount?.display_name || recruiterName;

    // Create professional HTML email
    const emailHtml = createEmailHtml(
      body_text,
      signature ?? profile.email_signature,
      senderName,
      senderEmail,
      attachments
    );

    // Handle scheduled emails
    if (scheduled_at && new Date(scheduled_at) > new Date()) {
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
          scheduled_at,
          timezone: timezone || "UTC",
          attachments: attachments || [],
          retry_count: 0,
          metadata: {
            cc_email,
            bcc_email,
            sending_method: sendingMethod,
            has_user_account: !!emailAccount,
          },
        })
        .select()
        .single();

      if (insertError) throw insertError;

      console.log(`Email ${emailRecord.id} scheduled for: ${scheduled_at} (${timezone || "UTC"})`);
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Email scheduled",
          email_id: emailRecord.id,
          scheduled_at,
          timezone: timezone || "UTC",
          sending_from: senderEmail,
          sending_method: sendingMethod,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send immediately
    let sendResult: { success: boolean; messageId?: string; error?: string };
    
    if (sendingMethod === "smtp" && emailAccount) {
      sendResult = await sendViaSMTP(
        emailAccount,
        to_email,
        cc_email || null,
        bcc_email || null,
        subject,
        emailHtml,
        attachments
      );

      // Update account last used
      if (sendResult.success) {
        await supabaseAdmin
          .from("email_accounts")
          .update({ last_sync_at: new Date().toISOString() })
          .eq("id", emailAccount.id);
      }
    } else if (sendingMethod === "resend" && RESEND_API_KEY) {
      sendResult = await sendViaResend(
        RESEND_API_KEY,
        SUPABASE_URL,
        senderName,
        recruiterEmail,
        to_email,
        cc_email || null,
        bcc_email || null,
        subject,
        emailHtml,
        attachments
      );
    } else {
      sendResult = { 
        success: false, 
        error: "No email account configured. Please configure your email in Settings → Email Integration." 
      };
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
        status: sendResult.success ? "sent" : "failed",
        sent_at: sendResult.success ? new Date().toISOString() : null,
        provider_message_id: sendResult.messageId || null,
        error_message: sendResult.error || null,
        attachments: attachments || [],
        timezone: timezone || "UTC",
        retry_count: 0,
        metadata: {
          cc_email,
          bcc_email,
          sending_method: sendingMethod,
          has_user_account: !!emailAccount,
        },
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
      status: sendResult.success ? "sent" : "failed",
      error_message: sendResult.error || null,
      metadata: {
        candidate_id,
        job_id,
        ai_generated,
        email_record_id: emailRecord?.id,
        sender_email: senderEmail,
        sending_method: sendingMethod,
        has_attachments: attachments && attachments.length > 0,
        attachment_count: attachments?.length || 0,
      },
    });

    if (!sendResult.success) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: sendResult.error || "Failed to send email",
          email_id: emailRecord?.id,
          needs_configuration: sendingMethod === "blocked",
        }),
        { status: sendingMethod === "blocked" ? 400 : 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Email sent successfully",
        email_id: emailRecord?.id,
        provider_message_id: sendResult.messageId,
        sent_from: senderEmail,
        sending_method: sendingMethod,
        used_user_account: !!emailAccount,
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
