/**
 * Organization-Level SMTP Email Sender
 * 
 * This module provides email sending that prioritizes organization-configured SMTP.
 * 
 * Priority Order:
 * 1. Sender's personal SMTP account (if configured and connected)
 * 2. Organization's default SMTP account (owner's account or first connected account)
 * 3. System fallback via Resend (admin@hiremetrics.co.uk)
 * 
 * Usage:
 * import { sendOrgEmail } from "../_shared/org-smtp-sender.ts";
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";
import { 
  createResendClient, 
  sendEmailWithRetry, 
  ADMIN_EMAIL,
  logEmailEvent 
} from "./email-config.ts";

interface OrgEmailRequest {
  tenant_id: string;
  sender_user_id?: string;
  to: string | string[];
  subject: string;
  html: string;
  cc?: string[];
  bcc?: string[];
  reply_to?: string;
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

interface OwnerRole {
  user_id: string;
}

interface SendResult {
  success: boolean;
  from_email: string;
  method: "smtp" | "resend";
  error?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = ReturnType<typeof createClient>;

/**
 * Get Supabase admin client
 */
function getSupabaseAdmin(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, key);
}

/**
 * Find the best email account for sending organization emails
 * Priority: sender's account > owner's account > any tenant account
 */
async function findBestEmailAccount(
  supabase: SupabaseClient,
  tenantId: string,
  senderUserId?: string
): Promise<EmailAccount | null> {
  console.log("[OrgSMTP] Finding best email account for tenant:", tenantId);
  
  // 1. Try sender's personal account first
  if (senderUserId) {
    const { data: senderAccount } = await supabase
      .from("email_accounts")
      .select("*")
      .eq("user_id", senderUserId)
      .eq("tenant_id", tenantId)
      .eq("status", "connected")
      .eq("provider", "smtp")
      .order("is_default", { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (senderAccount) {
      const account = senderAccount as EmailAccount;
      console.log("[OrgSMTP] Using sender's personal SMTP account:", account.from_email);
      return account;
    }
  }
  
  // 2. Find owner's email account for the tenant
  const { data: ownerRoleData } = await supabase
    .from("user_roles")
    .select("user_id")
    .eq("tenant_id", tenantId)
    .eq("role", "owner")
    .limit(1)
    .maybeSingle();
  
  const ownerRole = ownerRoleData as OwnerRole | null;
  
  if (ownerRole) {
    const { data: ownerAccountData } = await supabase
      .from("email_accounts")
      .select("*")
      .eq("user_id", ownerRole.user_id)
      .eq("tenant_id", tenantId)
      .eq("status", "connected")
      .eq("provider", "smtp")
      .order("is_default", { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (ownerAccountData) {
      const ownerAccount = ownerAccountData as EmailAccount;
      console.log("[OrgSMTP] Using owner's SMTP account:", ownerAccount.from_email);
      return ownerAccount;
    }
  }
  
  // 3. Fall back to any connected SMTP account in the tenant
  const { data: anyAccountData } = await supabase
    .from("email_accounts")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("status", "connected")
    .eq("provider", "smtp")
    .order("is_default", { ascending: false })
    .limit(1)
    .maybeSingle();
  
  if (anyAccountData) {
    const anyAccount = anyAccountData as EmailAccount;
    console.log("[OrgSMTP] Using organization SMTP account:", anyAccount.from_email);
    return anyAccount;
  }
  
  console.log("[OrgSMTP] No SMTP account found, will use system fallback");
  return null;
}

/**
 * Send email via SMTP
 */
async function sendViaSMTP(
  account: EmailAccount,
  request: OrgEmailRequest
): Promise<SendResult> {
  console.log(`[OrgSMTP] Sending via SMTP from ${account.from_email} to ${request.to}`);
  
  if (!account.smtp_host || !account.smtp_user || !account.smtp_password) {
    return {
      success: false,
      from_email: account.from_email,
      method: "smtp",
      error: "SMTP account not properly configured",
    };
  }
  
  try {
    const port = account.smtp_port || 587;
    const isDirectTLS = port === 465 || (account.smtp_use_tls && port !== 587);
    
    const client = new SMTPClient({
      connection: {
        hostname: account.smtp_host,
        port: port,
        tls: isDirectTLS,
        auth: {
          username: account.smtp_user,
          password: account.smtp_password,
        },
      },
    });
    
    const recipients = Array.isArray(request.to) ? request.to : [request.to];
    
    await client.send({
      from: `${account.display_name} <${account.from_email}>`,
      to: recipients,
      cc: request.cc,
      bcc: request.bcc,
      replyTo: request.reply_to || account.from_email,
      subject: request.subject,
      content: "Please view this email in an HTML-compatible client.",
      html: request.html,
    });
    
    await client.close();
    
    console.log(`[OrgSMTP] Email sent successfully via SMTP`);
    
    // Update account last sync - using raw query to avoid type issues
    try {
      const supabase = getSupabaseAdmin();
      // deno-lint-ignore no-explicit-any
      await (supabase as any)
        .from("email_accounts")
        .update({ last_sync_at: new Date().toISOString(), status: "connected" })
        .eq("id", account.id);
    } catch (e) {
      console.warn("[OrgSMTP] Failed to update account sync status:", e);
    }
    
    return {
      success: true,
      from_email: account.from_email,
      method: "smtp",
    };
  } catch (error) {
    console.error("[OrgSMTP] SMTP send error:", error);
    
    // Update account status - using raw query to avoid type issues
    try {
      const supabase = getSupabaseAdmin();
      // deno-lint-ignore no-explicit-any
      await (supabase as any)
        .from("email_accounts")
        .update({ 
          status: "error", 
          error_message: error instanceof Error ? error.message : "SMTP send failed" 
        })
        .eq("id", account.id);
    } catch (e) {
      console.warn("[OrgSMTP] Failed to update account error status:", e);
    }
    
    return {
      success: false,
      from_email: account.from_email,
      method: "smtp",
      error: error instanceof Error ? error.message : "SMTP send failed",
    };
  }
}

/**
 * Send email via Resend (system fallback)
 */
async function sendViaResend(request: OrgEmailRequest): Promise<SendResult> {
  console.log(`[OrgSMTP] Sending via Resend fallback to ${request.to}`);
  
  try {
    const resend = createResendClient();
    const recipients = Array.isArray(request.to) ? request.to : [request.to];
    
    const result = await sendEmailWithRetry(resend, {
      to: recipients,
      subject: request.subject,
      html: request.html,
      senderType: "default",
      replyTo: request.reply_to || ADMIN_EMAIL,
    });
    
    if (result.error) {
      return {
        success: false,
        from_email: ADMIN_EMAIL,
        method: "resend",
        error: result.error.message || "Resend API error",
      };
    }
    
    console.log(`[OrgSMTP] Email sent successfully via Resend`);
    return {
      success: true,
      from_email: ADMIN_EMAIL,
      method: "resend",
    };
  } catch (error) {
    console.error("[OrgSMTP] Resend send error:", error);
    return {
      success: false,
      from_email: ADMIN_EMAIL,
      method: "resend",
      error: error instanceof Error ? error.message : "Resend send failed",
    };
  }
}

/**
 * Send organization email with priority: SMTP > Resend fallback
 */
export async function sendOrgEmail(request: OrgEmailRequest): Promise<SendResult> {
  logEmailEvent("org_email_send_start", {
    tenant_id: request.tenant_id,
    sender_user_id: request.sender_user_id,
    to: request.to,
    subject: request.subject,
  });
  
  const supabase = getSupabaseAdmin();
  
  // Find best email account
  const account = await findBestEmailAccount(
    supabase,
    request.tenant_id,
    request.sender_user_id
  );
  
  let result: SendResult;
  
  if (account) {
    // Try SMTP first
    result = await sendViaSMTP(account, request);
    
    // If SMTP fails, fall back to Resend
    if (!result.success) {
      console.log("[OrgSMTP] SMTP failed, falling back to Resend:", result.error);
      result = await sendViaResend(request);
    }
  } else {
    // No SMTP configured, use Resend
    result = await sendViaResend(request);
  }
  
  logEmailEvent("org_email_send_complete", {
    success: result.success,
    from_email: result.from_email,
    method: result.method,
    error: result.error,
  });
  
  return result;
}

/**
 * Get sender information for display purposes
 */
export async function getSenderInfo(
  tenantId: string,
  senderUserId?: string
): Promise<{ name: string; email: string } | null> {
  const supabase = getSupabaseAdmin();
  const account = await findBestEmailAccount(supabase, tenantId, senderUserId);
  
  if (account) {
    return {
      name: account.display_name,
      email: account.from_email,
    };
  }
  
  return null;
}
