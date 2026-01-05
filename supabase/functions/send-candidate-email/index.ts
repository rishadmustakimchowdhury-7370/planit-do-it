import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPER_ADMIN_EMAIL = "admin@hiremetrics.co.uk";
const SUPER_ADMIN_NAME = "HireMetrics";

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
  candidate_id?: string;
  client_id?: string;
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
  use_system_fallback?: boolean;
}

// Professional HTML email template
const createEmailHtml = (
  bodyText: string, 
  signature: string | null, 
  recruiterName: string,
  recruiterEmail: string,
  attachmentLinks?: Attachment[],
  companyName?: string,
  companyLogo?: string
): string => {
  const isHtml = bodyText.trim().startsWith('<') && (bodyText.includes('<p') || bodyText.includes('<div') || bodyText.includes('<br'));
  
  const formattedBody = isHtml 
    ? bodyText 
    : bodyText
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

  let attachmentsHtml = '';
  if (attachmentLinks && attachmentLinks.length > 0) {
    attachmentsHtml = `
      <div style="margin-top: 20px; padding: 16px; background-color: #f9fafb; border-radius: 8px; border: 1px solid #e5e7eb;">
        <p style="margin: 0 0 12px 0; font-size: 13px; font-weight: 600; color: #374151;">📎 Attachments</p>
        ${attachmentLinks.map(att => `
          <a href="${att.url}" style="display: inline-block; margin: 4px 8px 4px 0; padding: 8px 14px; background-color: #ffffff; color: #374151; text-decoration: none; border-radius: 6px; font-size: 13px; border: 1px solid #d1d5db;">${att.name}</a>
        `).join('')}
      </div>`;
  }

  const logoHtml = companyLogo 
    ? `<img src="${companyLogo}" alt="${companyName || 'Company'}" style="max-height: 45px; max-width: 180px; object-fit: contain;" />`
    : `<div style="display: inline-flex; align-items: center; gap: 10px;">
        <div style="background: linear-gradient(135deg, #0052CC 0%, #0066FF 100%); border-radius: 8px; padding: 8px; display: inline-block;">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
            <rect width="20" height="14" x="2" y="6" rx="2"/>
          </svg>
        </div>
        <span style="font-size: 18px; font-weight: 700; color: #1e293b;">${companyName || 'HireMetrics'}</span>
      </div>`;

  const displayCompanyName = companyName || 'HireMetrics';
  const currentYear = new Date().getFullYear();

  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Email</title></head><body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;"><table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f3f4f6;"><tr><td style="padding: 32px 16px;"><table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="margin: 0 auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); overflow: hidden;"><tr><td style="padding: 24px 32px; border-bottom: 1px solid #e5e7eb; background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);">${logoHtml}</td></tr><tr><td style="padding: 32px; color: #1f2937; font-size: 15px; line-height: 1.7;">${formattedBody}${signatureHtml}${attachmentsHtml}</td></tr><tr><td style="padding: 24px 32px; background-color: #f8fafc; border-top: 1px solid #e5e7eb;"><table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"><tr><td style="text-align: center;"><p style="margin: 0 0 8px 0; font-size: 13px; color: #64748b;">Sent via ${displayCompanyName}</p><p style="margin: 0; font-size: 12px; color: #94a3b8;">© ${currentYear} ${displayCompanyName}. All rights reserved.</p></td></tr></table></td></tr></table><table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="margin: 16px auto 0;"><tr><td style="text-align: center; padding: 0 16px;"><p style="margin: 0; font-size: 11px; color: #9ca3af;">This email was sent by ${recruiterName} from ${displayCompanyName}. If you believe you received this email in error, please disregard it.</p></td></tr></table></td></tr></table></body></html>`;
};

// Send email via SMTP (primary method)
async function sendViaSMTP(
  account: EmailAccount,
  toEmail: string,
  ccEmail: string | null,
  bccEmail: string | null,
  subject: string,
  htmlBody: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (!account.smtp_host || !account.smtp_user || !account.smtp_password) {
    return { success: false, error: "SMTP account not properly configured" };
  }

  try {
    const isDirectTLS = account.smtp_port === 465;
    const client = new SMTPClient({
      connection: {
        hostname: account.smtp_host,
        port: account.smtp_port || 587,
        tls: isDirectTLS,
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

    console.log(`[SMTP] Email sent from ${account.from_email} to ${toEmail}`);
    return { success: true, messageId: crypto.randomUUID() };
  } catch (error) {
    console.error("[SMTP] Send error:", error);
    return { success: false, error: error instanceof Error ? error.message : "SMTP send failed" };
  }
}

// Send email via Super Admin SMTP fallback
async function sendViaSystemSMTP(
  senderName: string,
  replyToEmail: string,
  toEmail: string,
  ccEmail: string | null,
  bccEmail: string | null,
  subject: string,
  htmlBody: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const host = Deno.env.get("SMTP_HOST") || "smtp.gmail.com";
  const port = parseInt(Deno.env.get("SMTP_PORT") || "587", 10);
  const user = Deno.env.get("SMTP_USER");
  const password = Deno.env.get("SMTP_PASSWORD");

  if (!user || !password) {
    return { success: false, error: "System SMTP not configured. Please contact support." };
  }

  try {
    const isDirectTLS = port === 465;
    const client = new SMTPClient({
      connection: {
        hostname: host,
        port: port,
        tls: isDirectTLS,
        auth: {
          username: user,
          password: password,
        },
      },
    });

    const toList = toEmail.split(",").map(e => e.trim()).filter(Boolean);
    const ccList = ccEmail ? ccEmail.split(",").map(e => e.trim()).filter(Boolean) : [];
    const bccList = bccEmail ? bccEmail.split(",").map(e => e.trim()).filter(Boolean) : [];

    await client.send({
      from: `${senderName} <${SUPER_ADMIN_EMAIL}>`,
      replyTo: replyToEmail,
      to: toList,
      cc: ccList.length > 0 ? ccList : undefined,
      bcc: bccList.length > 0 ? bccList : undefined,
      subject: subject,
      content: "Please view this email in an HTML-compatible client.",
      html: htmlBody,
    });

    await client.close();

    console.log(`[SMTP] System email sent from ${SUPER_ADMIN_EMAIL} (on behalf of ${senderName}) to ${toEmail}`);
    return { success: true, messageId: crypto.randomUUID() };
  } catch (error) {
    console.error("[SMTP] System send error:", error);
    return { success: false, error: error instanceof Error ? error.message : "SMTP send failed" };
  }
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

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("tenant_id, full_name, email_signature, email")
      .eq("id", user.id)
      .single();

    if (!profile?.tenant_id) {
      throw new Error("User has no tenant");
    }

    const { data: branding } = await supabaseAdmin
      .from("branding_settings")
      .select("company_name, logo_url")
      .eq("tenant_id", profile.tenant_id)
      .single();

    const companyName = branding?.company_name || null;
    const companyLogo = branding?.logo_url || null;

    const body: SendEmailRequest = await req.json();
    const {
      candidate_id,
      client_id,
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

    const isClientEmail = !!client_id && !candidate_id;
    const recruiterName = profile.full_name || "Recruiter";
    const recruiterEmail = profile.email || SUPER_ADMIN_EMAIL;

    // Find user's email account
    let emailAccount: EmailAccount | null = null;
    let sendingMethod: "smtp" | "system_smtp" | "blocked" = "blocked";

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

    // Determine sending method - SMTP only, no third-party APIs
    if (emailAccount && emailAccount.provider === "smtp" && emailAccount.smtp_host) {
      sendingMethod = "smtp";
    } else if (use_system_fallback || !emailAccount) {
      // Check if system SMTP is configured
      const systemSmtpUser = Deno.env.get("SMTP_USER");
      const systemSmtpPass = Deno.env.get("SMTP_PASSWORD");
      if (systemSmtpUser && systemSmtpPass) {
        sendingMethod = "system_smtp";
        console.log(`[SMTP] No user account configured for user ${user.id}, using system SMTP fallback`);
      }
    }

    const senderEmail = emailAccount?.from_email || profile.email || SUPER_ADMIN_EMAIL;
    const senderName = emailAccount?.display_name || recruiterName;

    const emailHtml = createEmailHtml(
      body_text,
      signature ?? profile.email_signature,
      senderName,
      senderEmail,
      attachments,
      companyName,
      companyLogo
    );

    // Handle scheduled emails
    if (scheduled_at && new Date(scheduled_at) > new Date()) {
      const tableName = isClientEmail ? "client_emails" : "candidate_emails";
      const emailData: Record<string, unknown> = {
        tenant_id: profile.tenant_id,
        sent_by: user.id,
        from_email: senderEmail,
        from_account_id: emailAccount?.id || null,
        to_email,
        subject,
        body_text: emailHtml,
        status: "scheduled",
        scheduled_at,
        timezone: timezone || "UTC",
        attachments: attachments || [],
      };

      if (isClientEmail) {
        emailData.client_id = client_id;
      } else {
        emailData.candidate_id = candidate_id;
        emailData.job_id = job_id;
        emailData.template_id = template_id;
        emailData.ai_generated = ai_generated || false;
        emailData.retry_count = 0;
        emailData.metadata = {
          cc_email,
          bcc_email,
          sending_method: sendingMethod,
          has_user_account: !!emailAccount,
        };
      }

      const { data: emailRecord, error: insertError } = await supabaseAdmin
        .from(tableName)
        .insert(emailData)
        .select()
        .single();

      if (insertError) throw insertError;

      console.log(`[SMTP] Email ${emailRecord.id} scheduled for: ${scheduled_at} (${timezone || "UTC"})`);
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
        emailHtml
      );

      if (sendResult.success) {
        await supabaseAdmin
          .from("email_accounts")
          .update({ last_sync_at: new Date().toISOString() })
          .eq("id", emailAccount.id);
      }
    } else if (sendingMethod === "system_smtp") {
      sendResult = await sendViaSystemSMTP(
        senderName,
        recruiterEmail,
        to_email,
        cc_email || null,
        bcc_email || null,
        subject,
        emailHtml
      );
    } else {
      sendResult = { 
        success: false, 
        error: "No email account configured. Please configure your email in Settings → Email Integration." 
      };
    }

    // Save email record
    const tableName = isClientEmail ? "client_emails" : "candidate_emails";
    const emailData: Record<string, unknown> = {
      tenant_id: profile.tenant_id,
      sent_by: user.id,
      from_email: senderEmail,
      from_account_id: emailAccount?.id || null,
      to_email,
      subject,
      body_text: emailHtml,
      status: sendResult.success ? "sent" : "failed",
      sent_at: sendResult.success ? new Date().toISOString() : null,
      error_message: sendResult.error || null,
      attachments: attachments || [],
      timezone: timezone || "UTC",
    };

    if (isClientEmail) {
      emailData.client_id = client_id;
    } else {
      emailData.candidate_id = candidate_id;
      emailData.job_id = job_id;
      emailData.template_id = template_id;
      emailData.ai_generated = ai_generated || false;
      emailData.provider_message_id = sendResult.messageId || null;
      emailData.retry_count = 0;
      emailData.metadata = {
        cc_email,
        bcc_email,
        sending_method: sendingMethod,
        has_user_account: !!emailAccount,
      };
    }

    const { data: emailRecord, error: insertError } = await supabaseAdmin
      .from(tableName)
      .insert(emailData)
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
        client_id,
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
