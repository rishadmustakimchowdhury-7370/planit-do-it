import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";
import {
  getHireMetricsLogoInline,
  HIREMETRICS_BRAND,
} from "../_shared/email-templates.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPER_ADMIN_EMAIL = "admin@hiremetrics.co.uk";

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

interface OrgBranding {
  logoUrl: string | null;
  companyName: string | null;
  primaryColor: string | null;
}

// Validate if a URL is valid and accessible
function isValidLogoUrl(url: string | null): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (trimmed.length === 0) return false;
  // Must start with http:// or https://
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) return false;
  // Basic URL format check
  try {
    new URL(trimmed);
    return true;
  } catch {
    return false;
  }
}

// Helper to darken a hex color for gradient
function adjustColor(hex: string, amount: number): string {
  // Remove # if present
  const cleanHex = hex.replace('#', '');
  // Parse RGB
  const r = Math.max(0, Math.min(255, parseInt(cleanHex.substring(0, 2), 16) + amount));
  const g = Math.max(0, Math.min(255, parseInt(cleanHex.substring(2, 4), 16) + amount));
  const b = Math.max(0, Math.min(255, parseInt(cleanHex.substring(4, 6), 16) + amount));
  // Return hex
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

// Process email body to ensure proper paragraph spacing
// Converts plain text with \n\n breaks into properly styled HTML paragraphs
function formatEmailBody(bodyText: string): string {
  if (!bodyText || typeof bodyText !== 'string') {
    return '';
  }
  
  const trimmedBody = bodyText.trim();
  const isHtml = trimmedBody.startsWith('<') && (trimmedBody.includes('<p') || trimmedBody.includes('<div') || trimmedBody.includes('<br'));
  
  if (!isHtml) {
    // Plain text: Split by double newlines (paragraph breaks)
    // This handles AI-generated text with proper \n\n separation
    const paragraphs = trimmedBody
      .split(/\n\s*\n/) // Split on one or more blank lines
      .map(para => para.trim())
      .filter(para => para.length > 0);
    
    // Convert each paragraph to styled HTML
    return paragraphs.map(para => {
      // Handle single line breaks within a paragraph (convert to <br>)
      const lines = para.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      const content = lines.join('<br>');
      return `<p style="margin: 0 0 20px 0; line-height: 1.7; color: #1f2937; font-size: 15px;">${content}</p>`;
    }).join('');
  }
  
  // HTML content: Ensure proper paragraph styling
  let formattedHtml = trimmedBody;
  
  // Style existing <p> tags with proper margins and spacing
  formattedHtml = formattedHtml.replace(
    /<p(?:\s[^>]*)?>/gi, 
    '<p style="margin: 0 0 20px 0; line-height: 1.7; color: #1f2937; font-size: 15px;">'
  );
  
  // Convert <br><br> to paragraph breaks for better spacing
  formattedHtml = formattedHtml.replace(
    /<br\s*\/?>\s*<br\s*\/?>/gi, 
    '</p><p style="margin: 0 0 20px 0; line-height: 1.7; color: #1f2937; font-size: 15px;">'
  );
  
  return formattedHtml;
}

// Professional HTML email template with ONLY Organization logo centered at top
// and simple "Powered by HireMetrics CRM" footer
const createEmailHtml = (
  bodyText: string, 
  signature: string | null, 
  recruiterName: string,
  recruiterRole: string,
  attachmentLinks?: Attachment[],
  orgBranding?: OrgBranding,
  includeSignature: boolean = true
): string => {
  // Format the body with proper paragraph spacing
  const formattedBody = formatEmailBody(bodyText);

  // Only add signature if includeSignature is true.
  // De-dupe logic: if the body already contains a sign-off phrase *and* the recruiter's name,
  // don't append again. If the body only has "Kind regards," etc. but no name/title, we still
  // append the signature block (without duplicating the sign-off line).
  let signatureHtml = '';
  const bodyLower = bodyText.toLowerCase();
  const recruiterNameLower = (recruiterName || '').toLowerCase();
  const hasSignOffPhrase = bodyLower.includes('best regards') ||
    bodyLower.includes('kind regards') ||
    bodyLower.includes('sincerely') ||
    bodyLower.includes('thanks,') ||
    bodyLower.includes('thank you,') ||
    bodyLower.includes('warm regards') ||
    bodyLower.includes('regards,');

  const hasRecruiterNameInBody = recruiterNameLower ? bodyLower.includes(recruiterNameLower) : false;
  const hasFullSignatureInBody = hasSignOffPhrase && hasRecruiterNameInBody;

  if (includeSignature && !hasFullSignatureInBody) {
    if (signature && signature.trim()) {
      // User's custom signature - extract Name + Role only
      const signatureLines = signature.split('\n').filter(line => line.trim());

      // If body already contains a sign-off phrase, remove any sign-off line from the signature
      // to avoid showing it twice.
      const filteredLines = signatureLines
        .map(l => l.trim())
        .filter(Boolean)
        .filter(line => {
          const lower = line.toLowerCase();
          if (hasSignOffPhrase && (lower.includes('regards') || lower.includes('sincerely') || lower.includes('thanks'))) {
            return false;
          }
          // Skip lines with email addresses or phone patterns
          return !lower.includes('@') &&
            !lower.match(/^\+?[\d\s\-().]+$/) &&
            !lower.match(/^tel:|^phone:|^mobile:/i);
        });

      signatureHtml = `
        <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #e5e7eb;">
          ${filteredLines.map((line, index) => {
            if (index === 0) {
              return `<p style="margin: 0 0 4px 0; color: #1f2937; font-size: 15px; font-weight: 600;">${line}</p>`;
            }
            return `<p style="margin: 0; color: #6b7280; font-size: 14px;">${line}</p>`;
          }).join('')}
        </div>`;
    } else {
      // Default signature with name and role only - no email
      signatureHtml = `
        <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #e5e7eb;">
          <p style="margin: 0 0 4px 0; color: #1f2937; font-size: 15px; font-weight: 600;">${recruiterName}</p>
          ${recruiterRole ? `<p style="margin: 0; color: #6b7280; font-size: 14px;">${recruiterRole}</p>` : ''}
        </div>`;
    }
  }

  let attachmentsHtml = '';
  if (attachmentLinks && attachmentLinks.length > 0) {
    attachmentsHtml = `
      <div style="margin-top: 28px; padding: 20px; background-color: #f9fafb; border-radius: 8px; border: 1px solid #e5e7eb;">
        <p style="margin: 0 0 12px 0; font-size: 13px; font-weight: 600; color: #374151;">📎 Attachments</p>
        ${attachmentLinks.map(att => `
          <a href="${att.url}" target="_blank" rel="noopener noreferrer" style="display: inline-block; margin: 4px 8px 4px 0; padding: 10px 16px; background-color: #ffffff; color: #374151; text-decoration: none; border-radius: 6px; font-size: 13px; border: 1px solid #d1d5db;">${att.name}</a>
        `).join('')}
      </div>`;
  }

  // Centered organization logo header - ONLY org logo (no text fallback)
  let headerHtml = '';
  const hasValidLogo = isValidLogoUrl(orgBranding?.logoUrl ?? null);

  if (hasValidLogo && orgBranding?.logoUrl) {
    headerHtml = `
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="padding: 32px; background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%); border-bottom: 1px solid #e5e7eb;">
        <tr>
          <td align="center">
            <img src="${orgBranding.logoUrl}"
                 alt="${orgBranding.companyName || 'Organization'}"
                 height="56"
                 style="display: block; border: 0; max-width: 220px; height: auto; max-height: 56px;" />
          </td>
        </tr>
      </table>
    `;
  }

  // Simple footer - just "Powered by HireMetrics CRM"
  const footerHtml = `
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="padding: 20px 32px; background-color: #f8fafc;">
      <tr>
        <td align="center">
          <p style="margin: 0; font-size: 12px; color: #94a3b8; font-family: 'Segoe UI', Arial, sans-serif;">
            Powered by <strong style="color: #64748b;">HireMetrics CRM</strong>
          </p>
        </td>
      </tr>
    </table>
  `;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="format-detection" content="telephone=no, date=no, address=no, email=no">
  <title>Email</title>
  <!--[if mso]>
  <style type="text/css">
    body, table, td { font-family: Arial, sans-serif !important; }
  </style>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f3f4f6;">
    <tr>
      <td style="padding: 40px 16px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="margin: 0 auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); overflow: hidden; max-width: 600px;">
          ${headerHtml ? `<tr><td>${headerHtml}</td></tr>` : ''}
          <tr>
            <td style="padding: 32px 36px; color: #1f2937; font-size: 15px; line-height: 1.7;">
              ${formattedBody}
              ${signatureHtml}
              ${attachmentsHtml}
            </td>
          </tr>
          <tr>
            <td>
              ${footerHtml}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
};

// Base64 encode for enterprise email compliance
function base64EncodeUtf8(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

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

    // Use base64 encoding for enterprise compliance
    await client.send({
      from: `${account.display_name} <${account.from_email}>`,
      to: toList,
      cc: ccList.length > 0 ? ccList : undefined,
      bcc: bccList.length > 0 ? bccList : undefined,
      subject: subject,
      mimeContent: [
        {
          mimeType: "text/html; charset=UTF-8",
          content: base64EncodeUtf8(htmlBody),
          transferEncoding: "base64",
        },
      ],
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
  const port = parseInt(Deno.env.get("SMTP_PORT") || "465", 10);
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

    // Use base64 encoding for enterprise compliance
    await client.send({
      from: `${senderName} <${SUPER_ADMIN_EMAIL}>`,
      replyTo: replyToEmail,
      to: toList,
      cc: ccList.length > 0 ? ccList : undefined,
      bcc: bccList.length > 0 ? bccList : undefined,
      subject: subject,
      mimeContent: [
        {
          mimeType: "text/html; charset=UTF-8",
          content: base64EncodeUtf8(htmlBody),
          transferEncoding: "base64",
        },
      ],
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
      .select("tenant_id, full_name, email_signature, email, role")
      .eq("id", user.id)
      .single();

    // Handle missing tenant gracefully - try to get tenant from user metadata or profiles
    let tenantId = profile?.tenant_id;
    
    if (!tenantId) {
      // Try to get tenant from user's other profiles or team memberships
      const { data: anyProfile } = await supabaseAdmin
        .from("profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .not("tenant_id", "is", null)
        .single();
      
      if (anyProfile?.tenant_id) {
        tenantId = anyProfile.tenant_id;
      }
    }

    if (!tenantId) {
      console.error("User has no tenant:", user.id);
      throw new Error("User account is not associated with an organization. Please contact support.");
    }

    // Fetch organization branding from Organization Settings (branding_settings)
    // NOTE: Per product requirement, operational emails must use ONLY the organization's logo.
    const { data: branding } = await supabaseAdmin
      .from("branding_settings")
      .select("company_name, logo_url, primary_color")
      .eq("tenant_id", tenantId)
      .maybeSingle();

    const rawLogo = branding?.logo_url || null;
    const companyName = branding?.company_name || null;
    const primaryColor = branding?.primary_color || null;

    // Resolve logo URL to something email clients can fetch (public https or signed url)
    let logoUrl = rawLogo;
    console.log("[EMAIL] Raw org logo:", logoUrl);

    const trySigned = async (bucket: string, path: string) => {
      const { data, error } = await supabaseAdmin.storage
        .from(bucket)
        .createSignedUrl(path, 60 * 60 * 24);
      if (error) return null;
      return data?.signedUrl ?? null;
    };

    const extractStoragePath = (url: string): { bucket: string; path: string } | null => {
      try {
        const u = new URL(url);
        const marker = "/storage/v1/object/";
        const idx = u.pathname.indexOf(marker);
        if (idx === -1) return null;

        // pathname after marker: e.g. public/documents/tenant/logo.png OR sign/documents/...
        const rest = u.pathname.slice(idx + marker.length).replace(/^\/+/, "");
        const parts = rest.split('/');
        if (parts.length < 3) return null;

        // parts[0] = public|sign|authenticated
        const bucket = parts[1];
        const path = parts.slice(2).join('/');
        if (!bucket || !path) return null;
        return { bucket, path };
      } catch {
        return null;
      }
    };

    if (logoUrl) {
      // Case A: stored as plain storage path like "tenantId/logo.png"
      if (!logoUrl.startsWith("http://") && !logoUrl.startsWith("https://")) {
        logoUrl =
          (await trySigned("documents", logoUrl)) ||
          (await trySigned("tenant-logos", logoUrl)) ||
          (await trySigned("trusted-clients", logoUrl)) ||
          null;

        if (!logoUrl) {
          const supabaseUrl = Deno.env.get("SUPABASE_URL");
          logoUrl = `${supabaseUrl}/storage/v1/object/public/documents/${rawLogo}`;
        }
      } else {
        // Case B: stored as a full Supabase Storage URL (public or signed)
        const extracted = extractStoragePath(logoUrl);
        if (extracted) {
          const signed = await trySigned(extracted.bucket, extracted.path);
          if (signed) logoUrl = signed;
        }
      }
    }

    console.log("[EMAIL] Final org logo URL:", logoUrl);

    const orgBranding: OrgBranding = {
      logoUrl,
      companyName,
      primaryColor,
    };

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
    const recruiterName = profile?.full_name || "Recruiter";
    const recruiterEmail = profile?.email || SUPER_ADMIN_EMAIL;

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

    const senderEmail = emailAccount?.from_email || profile?.email || SUPER_ADMIN_EMAIL;
    const senderName = emailAccount?.display_name || recruiterName;

    // Create email HTML with organization logo only at top
    // Signature shows Name + Role only (no email visible to recipients)
    const userSignature = signature ?? profile?.email_signature ?? null;
    const recruiterRole = profile?.role || "";
    const emailHtml = createEmailHtml(
      body_text,
      userSignature,
      senderName,
      recruiterRole,
      attachments,
      orgBranding,
      true // includeSignature - function will check if already present in body
    );

    // Handle scheduled emails
    if (scheduled_at && new Date(scheduled_at) > new Date()) {
      const tableName = isClientEmail ? "client_emails" : "candidate_emails";
      const emailData: Record<string, unknown> = {
        tenant_id: tenantId,
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
      tenant_id: tenantId,
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
      tenant_id: tenantId,
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
