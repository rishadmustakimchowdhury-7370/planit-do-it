/**
 * HireMetrics Production Email Configuration
 * 
 * Centralized email configuration for all edge functions.
 * Uses Resend for outbound emails only.
 * 
 * IMPORTANT:
 * - All emails sent from admin@hiremetrics.co.uk
 * - Reply-To always set to admin@hiremetrics.co.uk
 * - No inbox reading or Gmail API integration
 * - Domain must have SPF, DKIM, DMARC configured
 */

import { Resend } from "https://esm.sh/resend@2.0.0";

// ============================================================================
// SENDER CONFIGURATION
// Abstracted for future multi-address support (no-reply, billing, support)
// ============================================================================

export interface EmailSender {
  name: string;
  email: string;
  replyTo: string;
}

export const EMAIL_SENDERS = {
  // Primary sender for all system emails
  default: {
    name: "HireMetrics",
    email: "admin@hiremetrics.co.uk",
    replyTo: "admin@hiremetrics.co.uk",
  },
  // Future senders (all point to same address for now)
  notifications: {
    name: "HireMetrics",
    email: "admin@hiremetrics.co.uk",
    replyTo: "admin@hiremetrics.co.uk",
  },
  billing: {
    name: "HireMetrics Billing",
    email: "admin@hiremetrics.co.uk",
    replyTo: "admin@hiremetrics.co.uk",
  },
  support: {
    name: "HireMetrics Support",
    email: "admin@hiremetrics.co.uk",
    replyTo: "admin@hiremetrics.co.uk",
  },
  system: {
    name: "HireMetrics System",
    email: "admin@hiremetrics.co.uk",
    replyTo: "admin@hiremetrics.co.uk",
  },
} as const;

export type EmailSenderType = keyof typeof EMAIL_SENDERS;

// ============================================================================
// ADMIN EMAIL ADDRESS (for receiving alerts, notifications, etc.)
// ============================================================================

export const ADMIN_EMAIL = "admin@hiremetrics.co.uk";

// ============================================================================
// DOMAIN CONFIGURATION
// ============================================================================

export const EMAIL_DOMAIN = "hiremetrics.co.uk";

// ============================================================================
// RESEND API HELPERS
// ============================================================================

interface ResendError {
  statusCode?: number;
  name?: string;
  message?: string;
}

interface ResendSendResult {
  data: { id: string } | null;
  error: ResendError | null;
}

/**
 * Get formatted "from" address for Resend
 */
export function getFromAddress(senderType: EmailSenderType = "default"): string {
  const sender = EMAIL_SENDERS[senderType];
  return `${sender.name} <${sender.email}>`;
}

/**
 * Get Reply-To address
 */
export function getReplyToAddress(senderType: EmailSenderType = "default"): string {
  return EMAIL_SENDERS[senderType].replyTo;
}

/**
 * Create Resend client instance
 */
export function createResendClient(): Resend {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not configured");
  }
  return new Resend(apiKey);
}

/**
 * Send email with automatic retry for rate limiting (429 errors)
 * Implements exponential backoff with jitter
 */
export async function sendEmailWithRetry(
  resend: Resend,
  payload: {
    to: string | string[];
    subject: string;
    html: string;
    senderType?: EmailSenderType;
    replyTo?: string;
    attachments?: Array<{ filename: string; content: string | Uint8Array; contentType?: string }>;
  },
  options?: {
    maxAttempts?: number;
    initialDelayMs?: number;
  }
): Promise<ResendSendResult> {
  const maxAttempts = options?.maxAttempts ?? 5;
  const initialDelayMs = options?.initialDelayMs ?? 700;
  
  let lastResult: ResendSendResult = { data: null, error: null };
  let delayMs = initialDelayMs;

  const senderType = payload.senderType ?? "default";
  const fromAddress = getFromAddress(senderType);
  const replyToAddress = payload.replyTo ?? getReplyToAddress(senderType);

  const recipients = Array.isArray(payload.to) ? payload.to : [payload.to];

  // Validate recipients are not empty
  if (recipients.length === 0 || recipients.every(r => !r)) {
    console.error("[EmailConfig] No valid recipients provided");
    return {
      data: null,
      error: { statusCode: 400, name: "validation_error", message: "No valid recipients" }
    };
  }

  const emailPayload: Parameters<Resend["emails"]["send"]>[0] = {
    from: fromAddress,
    to: recipients,
    subject: payload.subject,
    html: payload.html,
    reply_to: replyToAddress,
  };

  // Add attachments if provided
  if (payload.attachments && payload.attachments.length > 0) {
    emailPayload.attachments = payload.attachments.map(att => ({
      filename: att.filename,
      content: att.content as any,
      content_type: att.contentType,
    }));
  }

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      // Add jitter to reduce collision with other functions
      if (attempt > 1) {
        const jitter = Math.floor(Math.random() * 200);
        await new Promise(r => setTimeout(r, delayMs + jitter));
      }

      console.log(`[EmailConfig] Sending email attempt ${attempt}/${maxAttempts} to: ${recipients.join(", ")}`);
      
      const result = await resend.emails.send(emailPayload) as ResendSendResult;
      lastResult = result;

      const err = result?.error;
      if (!err) {
        console.log(`[EmailConfig] Email sent successfully on attempt ${attempt}`);
        return result;
      }

      const statusCode = err?.statusCode;
      const name = err?.name;
      const isRateLimit = statusCode === 429 || name === "rate_limit_exceeded";

      console.warn(`[EmailConfig] Resend error on attempt ${attempt}:`, {
        statusCode,
        name,
        message: err?.message,
        isRateLimit
      });

      // If not rate-limited or last attempt, return the error
      if (!isRateLimit || attempt === maxAttempts) {
        return result;
      }

      // Exponential backoff for rate limiting
      delayMs = Math.min(delayMs * 2, 5000);
      console.log(`[EmailConfig] Rate-limited, waiting ${delayMs}ms before retry...`);
      
    } catch (error) {
      console.error(`[EmailConfig] Exception on attempt ${attempt}:`, error);
      lastResult = {
        data: null,
        error: {
          statusCode: 500,
          name: "internal_error",
          message: error instanceof Error ? error.message : "Unknown error"
        }
      };
      
      if (attempt === maxAttempts) {
        return lastResult;
      }
      
      delayMs = Math.min(delayMs * 2, 5000);
      await new Promise(r => setTimeout(r, delayMs));
    }
  }

  return lastResult;
}

/**
 * Send email using fetch API with retry (for functions not using Resend SDK)
 */
export async function sendEmailWithFetch(
  payload: {
    to: string | string[];
    subject: string;
    html: string;
    senderType?: EmailSenderType;
    replyTo?: string;
    attachments?: Array<{ filename: string; content: string }>;
  },
  options?: {
    maxAttempts?: number;
    initialDelayMs?: number;
  }
): Promise<{ success: boolean; data?: any; error?: string }> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) {
    return { success: false, error: "RESEND_API_KEY is not configured" };
  }

  const maxAttempts = options?.maxAttempts ?? 5;
  const initialDelayMs = options?.initialDelayMs ?? 700;
  
  let delayMs = initialDelayMs;
  let lastError: string | undefined;

  const senderType = payload.senderType ?? "default";
  const fromAddress = getFromAddress(senderType);
  const replyToAddress = payload.replyTo ?? getReplyToAddress(senderType);

  const recipients = Array.isArray(payload.to) ? payload.to : [payload.to];

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      if (attempt > 1) {
        const jitter = Math.floor(Math.random() * 200);
        await new Promise(r => setTimeout(r, delayMs + jitter));
      }

      console.log(`[EmailConfig] Fetch send attempt ${attempt}/${maxAttempts} to: ${recipients.join(", ")}`);

      const body: Record<string, unknown> = {
        from: fromAddress,
        to: recipients,
        subject: payload.subject,
        html: payload.html,
        reply_to: replyToAddress,
      };

      if (payload.attachments) {
        body.attachments = payload.attachments;
      }

      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (response.ok) {
        console.log(`[EmailConfig] Email sent successfully via fetch on attempt ${attempt}`);
        return { success: true, data };
      }

      const isRateLimit = response.status === 429;
      lastError = data.message || `HTTP ${response.status}`;

      console.warn(`[EmailConfig] Fetch error on attempt ${attempt}:`, {
        status: response.status,
        message: lastError,
        isRateLimit
      });

      if (!isRateLimit || attempt === maxAttempts) {
        return { success: false, error: lastError };
      }

      delayMs = Math.min(delayMs * 2, 5000);
      
    } catch (error) {
      lastError = error instanceof Error ? error.message : "Unknown error";
      console.error(`[EmailConfig] Fetch exception on attempt ${attempt}:`, error);
      
      if (attempt === maxAttempts) {
        return { success: false, error: lastError };
      }
      
      delayMs = Math.min(delayMs * 2, 5000);
    }
  }

  return { success: false, error: lastError || "Max retries exceeded" };
}

// ============================================================================
// DEDUPLICATION HELPER
// Uses a simple in-memory set with TTL (prevents duplicate sends in same request)
// For production, consider Redis or database-backed deduplication
// ============================================================================

const recentlySent = new Map<string, number>();
const DEDUP_TTL_MS = 60000; // 1 minute

/**
 * Check if an email was recently sent (within TTL)
 * Returns true if should skip (already sent), false if should proceed
 */
export function isDuplicateEmail(key: string): boolean {
  const now = Date.now();
  
  // Clean up old entries
  for (const [k, timestamp] of recentlySent.entries()) {
    if (now - timestamp > DEDUP_TTL_MS) {
      recentlySent.delete(k);
    }
  }
  
  if (recentlySent.has(key)) {
    console.log(`[EmailConfig] Duplicate email detected, skipping: ${key}`);
    return true;
  }
  
  recentlySent.set(key, now);
  return false;
}

/**
 * Generate deduplication key for an email
 */
export function generateDedupKey(to: string, subject: string, type?: string): string {
  return `${to}:${subject}:${type || "default"}`;
}

// ============================================================================
// LOGGING HELPER
// ============================================================================

export function logEmailEvent(
  action: string,
  details: Record<string, unknown>
): void {
  console.log(`[EmailConfig] ${action}:`, JSON.stringify(details, null, 2));
}
