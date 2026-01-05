/**
 * HireMetrics SMTP Email Engine
 * 
 * Pure SMTP-based email sending using Google Workspace.
 * NO third-party email APIs (Resend, Brevo, SendGrid).
 * 
 * Email Ownership Rules:
 * - Super Admin (admin@hiremetrics.co.uk): System emails, billing, security
 * - Owner/Manager: Operational emails from their configured SMTP
 * 
 * SMTP Configuration:
 * - Host: smtp.gmail.com
 * - Port: 587 (STARTTLS)
 * - Auth: Google Workspace App Password
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

// ============================================================================
// CONSTANTS
// ============================================================================

export const SUPER_ADMIN_EMAIL = "admin@hiremetrics.co.uk";
export const SUPER_ADMIN_NAME = "HireMetrics";

// Email sender types for routing
export type EmailCategory = 
  | "system"      // User signup, email verification, password reset
  | "billing"     // Payments, invoices, subscriptions
  | "security"    // Security alerts, 2FA
  | "team"        // Team invitations, member notifications
  | "operational" // Job events, candidate updates, client emails
  | "audit";      // Super admin audit notifications

// ============================================================================
// INTERFACES
// ============================================================================

export interface SMTPConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  useTLS?: boolean;
}

export interface EmailPayload {
  to: string | string[];
  subject: string;
  html: string;
  cc?: string[];
  bcc?: string[];
  replyTo?: string;
  attachments?: Array<{
    filename: string;
    content: string | Uint8Array;
    contentType?: string;
  }>;
}

export interface SendResult {
  success: boolean;
  from: string;
  method: "smtp" | "fallback";
  error?: string;
  messageId?: string;
}

interface EmailAccount {
  id: string;
  user_id: string;
  tenant_id: string;
  from_email: string;
  display_name: string;
  provider: string;
  status: string;
  is_default: boolean;
  smtp_host?: string;
  smtp_port?: number;
  smtp_user?: string;
  smtp_password?: string;
  smtp_use_tls?: boolean;
}


// ============================================================================
// EMAIL SAFETY + ENCODING (HARD ENFORCEMENT)
// ============================================================================

function base64EncodeUtf8(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let binary = "";
  // Chunk to avoid call stack limits
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

function ensureAnchorsOpenInNewTab(html: string): string {
  // Add target+rel where missing.
  return html.replace(/<a\b(?![^>]*\btarget=)/gi, '<a target="_blank" rel="noopener noreferrer"');
}

function assertEnterpriseEmailHtml(html: string): void {
  // Prohibited encodings / artifacts
  if (html.includes("=20")) {
    throw new Error("[SMTP] Rejected email: detected '=20' artifact (quoted-printable leakage)");
  }

  // Prohibited tags
  if (/<\s*script\b/i.test(html)) {
    throw new Error("[SMTP] Rejected email: <script> tag is not allowed");
  }

  // Prohibit relative URLs in href
  if (/href\s*=\s*["']\/(?!\/)/i.test(html)) {
    throw new Error("[SMTP] Rejected email: relative URL detected in href; absolute URLs only");
  }
}

function buildBase64HtmlMimeContent(html: string) {
  // Enforce no SVG by stripping (templates sometimes include SVG fallbacks)
  const withoutSvg = html.replace(/<\s*svg[\s\S]*?<\s*\/\s*svg\s*>/gi, "");
  const withTargets = ensureAnchorsOpenInNewTab(withoutSvg);

  assertEnterpriseEmailHtml(withTargets);

  return [
    {
      mimeType: "text/html; charset=UTF-8",
      content: base64EncodeUtf8(withTargets),
      transferEncoding: "base64",
    },
  ];
}

// ============================================================================
// SMTP CLIENT HELPERS
// ============================================================================


/**
 * Get Super Admin SMTP configuration from environment
 * Default to port 465 (direct TLS) which is more reliable in Deno
 */
function getSuperAdminSMTPConfig(): SMTPConfig {
  const host = Deno.env.get("SMTP_HOST") || "smtp.gmail.com";
  // Default to 465 (direct TLS) - more reliable than 587 (STARTTLS) in Deno
  const port = parseInt(Deno.env.get("SMTP_PORT") || "465", 10);
  const user = Deno.env.get("SMTP_USER");
  const password = Deno.env.get("SMTP_PASSWORD");

  if (!user || !password) {
    throw new Error("SMTP credentials not configured. Set SMTP_USER and SMTP_PASSWORD.");
  }

  console.log(`[SMTP] Super Admin config - Host: ${host}, Port: ${port}, User: ${user}`);
  
  return { host, port, user, password, useTLS: true };
}

/**
 * Create SMTP client from config
 * Note: For Gmail, port 465 with direct TLS is more reliable in Deno
 */
function createSMTPClient(config: SMTPConfig): SMTPClient {
  // Port 465 = direct TLS (implicit SSL)
  // Port 587 = STARTTLS (explicit TLS upgrade)
  const useDirectTLS = config.port === 465;
  
  console.log(`[SMTP] Creating client for ${config.host}:${config.port} (TLS: ${useDirectTLS})`);
  
  return new SMTPClient({
    connection: {
      hostname: config.host,
      port: config.port,
      tls: useDirectTLS,
      auth: {
        username: config.user,
        password: config.password,
      },
    },
  });
}

/**
 * Send email via SMTP with retry logic
 */
async function sendViaSMTP(
  config: SMTPConfig,
  from: { name: string; email: string },
  payload: EmailPayload,
  maxRetries = 3
): Promise<SendResult> {
  let lastError: string | undefined;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[SMTP] Attempt ${attempt}/${maxRetries} - Sending from ${from.email} to ${payload.to}`);
      
      const client = createSMTPClient(config);
      const recipients = Array.isArray(payload.to) ? payload.to : [payload.to];
      
      // HARD ENFORCEMENT:
      // - HTML only
      // - Content-Transfer-Encoding: base64
      // - No quoted-printable
      const mimeContent = buildBase64HtmlMimeContent(payload.html);

      const emailOptions: Parameters<SMTPClient["send"]>[0] = {
        from: `${from.name} <${from.email}>`,
        to: recipients,
        cc: payload.cc,
        bcc: payload.bcc,
        replyTo: payload.replyTo || from.email,
        subject: payload.subject,
        mimeContent,
      };

      // Add attachments if present
      if (payload.attachments && payload.attachments.length > 0) {
        emailOptions.attachments = payload.attachments.map(att => ({
          filename: att.filename,
          content: typeof att.content === "string" 
            ? new TextEncoder().encode(att.content) 
            : att.content,
          contentType: att.contentType || "application/octet-stream",
          encoding: "binary" as const,
        }));
      }

      await client.send(emailOptions);
      await client.close();
      
      console.log(`[SMTP] Email sent successfully from ${from.email}`);
      
      return {
        success: true,
        from: from.email,
        method: "smtp",
      };
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      console.error(`[SMTP] Attempt ${attempt} failed:`, lastError);
      
      if (attempt < maxRetries) {
        // Exponential backoff
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
  
  return {
    success: false,
    from: from.email,
    method: "smtp",
    error: lastError || "Failed to send email",
  };
}

// ============================================================================
// SUPABASE HELPERS
// ============================================================================

function getSupabaseAdmin() {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, key);
}

/**
 * Find user's configured SMTP account
 */
async function findUserSMTPAccount(
  userId: string,
  tenantId: string
): Promise<EmailAccount | null> {
  const supabase = getSupabaseAdmin();
  
  const { data } = await supabase
    .from("email_accounts")
    .select("*")
    .eq("user_id", userId)
    .eq("tenant_id", tenantId)
    .eq("status", "connected")
    .eq("provider", "smtp")
    .order("is_default", { ascending: false })
    .limit(1)
    .maybeSingle();
  
  return data as EmailAccount | null;
}

/**
 * Find organization owner's SMTP account
 */
async function findOwnerSMTPAccount(tenantId: string): Promise<EmailAccount | null> {
  const supabase = getSupabaseAdmin();
  
  // Get owner user_id
  const { data: ownerRole } = await supabase
    .from("user_roles")
    .select("user_id")
    .eq("tenant_id", tenantId)
    .eq("role", "owner")
    .limit(1)
    .maybeSingle();
  
  if (!ownerRole) return null;
  
  const { data } = await supabase
    .from("email_accounts")
    .select("*")
    .eq("user_id", ownerRole.user_id)
    .eq("tenant_id", tenantId)
    .eq("status", "connected")
    .eq("provider", "smtp")
    .order("is_default", { ascending: false })
    .limit(1)
    .maybeSingle();
  
  return data as EmailAccount | null;
}

/**
 * Find any configured SMTP account for tenant
 */
async function findTenantSMTPAccount(tenantId: string): Promise<EmailAccount | null> {
  const supabase = getSupabaseAdmin();
  
  const { data } = await supabase
    .from("email_accounts")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("status", "connected")
    .eq("provider", "smtp")
    .order("is_default", { ascending: false })
    .limit(1)
    .maybeSingle();
  
  return data as EmailAccount | null;
}

/**
 * Update email account status after send
 */
async function updateAccountStatus(
  accountId: string,
  success: boolean,
  error?: string
): Promise<void> {
  try {
    const supabase = getSupabaseAdmin();
    
    if (success) {
      await supabase
        .from("email_accounts")
        .update({ 
          last_sync_at: new Date().toISOString(),
          status: "connected",
          error_message: null,
        })
        .eq("id", accountId);
    } else {
      await supabase
        .from("email_accounts")
        .update({ 
          status: "error",
          error_message: error,
        })
        .eq("id", accountId);
    }
  } catch (e) {
    console.warn("[SMTP] Failed to update account status:", e);
  }
}

// ============================================================================
// MAIN EMAIL SENDING FUNCTIONS
// ============================================================================

/**
 * Send System Email (signup, verification, password reset)
 * ALWAYS from Super Admin
 */
export async function sendSystemEmail(
  payload: EmailPayload
): Promise<SendResult> {
  console.log("[SMTP] Sending SYSTEM email to:", payload.to);
  
  const config = getSuperAdminSMTPConfig();
  const result = await sendViaSMTP(
    config,
    { name: SUPER_ADMIN_NAME, email: SUPER_ADMIN_EMAIL },
    { ...payload, replyTo: payload.replyTo || SUPER_ADMIN_EMAIL }
  );
  
  return result;
}

/**
 * Send Billing Email (payments, invoices, subscriptions)
 * ALWAYS from Super Admin
 */
export async function sendBillingEmail(
  payload: EmailPayload
): Promise<SendResult> {
  console.log("[SMTP] Sending BILLING email to:", payload.to);
  
  const config = getSuperAdminSMTPConfig();
  const result = await sendViaSMTP(
    config,
    { name: `${SUPER_ADMIN_NAME} Billing`, email: SUPER_ADMIN_EMAIL },
    { ...payload, replyTo: payload.replyTo || SUPER_ADMIN_EMAIL }
  );
  
  return result;
}

/**
 * Send Security Email (alerts, 2FA)
 * ALWAYS from Super Admin
 */
export async function sendSecurityEmail(
  payload: EmailPayload
): Promise<SendResult> {
  console.log("[SMTP] Sending SECURITY email to:", payload.to);
  
  const config = getSuperAdminSMTPConfig();
  const result = await sendViaSMTP(
    config,
    { name: `${SUPER_ADMIN_NAME} Security`, email: SUPER_ADMIN_EMAIL },
    { ...payload, replyTo: payload.replyTo || SUPER_ADMIN_EMAIL }
  );
  
  return result;
}

/**
 * Send Audit Email (to Super Admin only)
 * ALWAYS from and to Super Admin
 */
export async function sendAuditEmail(
  subject: string,
  html: string,
  additionalRecipients?: string[]
): Promise<SendResult> {
  console.log("[SMTP] Sending AUDIT email");
  
  const config = getSuperAdminSMTPConfig();
  const recipients = [SUPER_ADMIN_EMAIL, ...(additionalRecipients || [])];
  
  const result = await sendViaSMTP(
    config,
    { name: SUPER_ADMIN_NAME, email: SUPER_ADMIN_EMAIL },
    { 
      to: recipients,
      subject,
      html,
      replyTo: SUPER_ADMIN_EMAIL,
    }
  );
  
  return result;
}

/**
 * Send Team Email (invitations, member notifications)
 * From Owner/Manager if configured, fallback to Super Admin
 */
export async function sendTeamEmail(
  tenantId: string,
  senderUserId: string | undefined,
  senderName: string,
  payload: EmailPayload
): Promise<SendResult> {
  console.log("[SMTP] Sending TEAM email to:", payload.to);
  
  // Priority: Sender's SMTP > Owner's SMTP > Tenant SMTP > Super Admin
  let account: EmailAccount | null = null;
  
  if (senderUserId && tenantId) {
    account = await findUserSMTPAccount(senderUserId, tenantId);
  }
  
  if (!account && tenantId) {
    account = await findOwnerSMTPAccount(tenantId);
  }
  
  if (!account && tenantId) {
    account = await findTenantSMTPAccount(tenantId);
  }
  
  if (account && account.smtp_host && account.smtp_user && account.smtp_password) {
    console.log("[SMTP] Using org SMTP account:", account.from_email);
    
    const config: SMTPConfig = {
      host: account.smtp_host,
      port: account.smtp_port || 587,
      user: account.smtp_user,
      password: account.smtp_password,
      useTLS: account.smtp_use_tls ?? true,
    };
    
    const result = await sendViaSMTP(
      config,
      { name: account.display_name, email: account.from_email },
      { ...payload, replyTo: payload.replyTo || account.from_email }
    );
    
    await updateAccountStatus(account.id, result.success, result.error);
    return result;
  }
  
  // Fallback to Super Admin SMTP but preserve sender name
  console.log("[SMTP] Using Super Admin SMTP with sender name:", senderName);
  
  const config = getSuperAdminSMTPConfig();
  const result = await sendViaSMTP(
    config,
    { name: senderName || SUPER_ADMIN_NAME, email: SUPER_ADMIN_EMAIL },
    { ...payload, replyTo: payload.replyTo || SUPER_ADMIN_EMAIL }
  );
  
  return result;
}

/**
 * Send Operational Email (job events, candidate updates, client emails)
 * From User/Owner if configured, fallback to Super Admin
 */
export async function sendOperationalEmail(
  tenantId: string,
  senderUserId: string,
  senderName: string,
  payload: EmailPayload
): Promise<SendResult> {
  console.log("[SMTP] Sending OPERATIONAL email to:", payload.to);
  
  // Priority: Sender's SMTP > Owner's SMTP > Tenant SMTP > Super Admin
  let account: EmailAccount | null = null;
  
  if (senderUserId && tenantId) {
    account = await findUserSMTPAccount(senderUserId, tenantId);
  }
  
  if (!account && tenantId) {
    account = await findOwnerSMTPAccount(tenantId);
  }
  
  if (!account && tenantId) {
    account = await findTenantSMTPAccount(tenantId);
  }
  
  if (account && account.smtp_host && account.smtp_user && account.smtp_password) {
    console.log("[SMTP] Using org SMTP account:", account.from_email);
    
    const config: SMTPConfig = {
      host: account.smtp_host,
      port: account.smtp_port || 587,
      user: account.smtp_user,
      password: account.smtp_password,
      useTLS: account.smtp_use_tls ?? true,
    };
    
    const result = await sendViaSMTP(
      config,
      { name: account.display_name || senderName, email: account.from_email },
      { ...payload, replyTo: payload.replyTo || account.from_email }
    );
    
    await updateAccountStatus(account.id, result.success, result.error);
    return result;
  }
  
  // Fallback to Super Admin SMTP but preserve sender name
  console.log("[SMTP] Using Super Admin SMTP with sender name:", senderName);
  
  const config = getSuperAdminSMTPConfig();
  const result = await sendViaSMTP(
    config,
    { name: senderName || SUPER_ADMIN_NAME, email: SUPER_ADMIN_EMAIL },
    { ...payload, replyTo: payload.replyTo || SUPER_ADMIN_EMAIL }
  );
  
  return result;
}

// ============================================================================
// LOGGING HELPER
// ============================================================================

export function logEmailEvent(
  action: string,
  details: Record<string, unknown>
): void {
  console.log(`[SMTP-ENGINE] ${action}:`, JSON.stringify(details, null, 2));
}

// ============================================================================
// DEDUPLICATION
// ============================================================================

const recentlySent = new Map<string, number>();
const DEDUP_TTL_MS = 60000;

export function isDuplicateEmail(key: string): boolean {
  const now = Date.now();
  
  for (const [k, timestamp] of recentlySent.entries()) {
    if (now - timestamp > DEDUP_TTL_MS) {
      recentlySent.delete(k);
    }
  }
  
  if (recentlySent.has(key)) {
    console.log(`[SMTP] Duplicate email detected, skipping: ${key}`);
    return true;
  }
  
  recentlySent.set(key, now);
  return false;
}

export function generateDedupKey(to: string, subject: string, type?: string): string {
  return `${to}:${subject}:${type || "default"}`;
}
