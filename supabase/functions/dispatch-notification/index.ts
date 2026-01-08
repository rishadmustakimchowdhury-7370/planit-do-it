import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  createResendClient,
  sendEmailWithRetry,
  isDuplicateEmail,
  generateDedupKey,
  ADMIN_EMAIL,
  logEmailEvent,
  type EmailSenderType,
} from "../_shared/email-config.ts";
import { getAppBaseUrl, getDashboardUrl, getBillingUrl, getTeamUrl, getAdminUrl, buildAppUrl } from "../_shared/app-url.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============================================================================
// EVENT TYPES & ROLE-BASED ROUTING
// ============================================================================

type AppRole = "super_admin" | "owner" | "manager" | "recruiter";

type NotificationEventType =
  // Team events
  | "team_member_added"
  | "team_member_accepted"
  // Job events
  | "job_created"
  | "job_assigned"
  | "job_paused"
  | "job_closed"
  | "candidate_hired"
  // Candidate events
  | "cv_submitted"
  | "candidate_status_updated"
  | "interview_scheduled"
  | "candidate_rejected"
  | "candidate_offered"
  // Billing events
  | "package_changed"
  | "payment_successful"
  | "payment_failed"
  | "subscription_expired";

interface NotificationPayload {
  event_type: NotificationEventType;
  tenant_id: string;
  actor_user_id?: string;
  data: Record<string, unknown>;
  skip_email?: boolean;
  skip_notification?: boolean;
}

// Role-based routing configuration
const EVENT_RECIPIENTS: Record<NotificationEventType, {
  roles: AppRole[];
  recruiterCondition?: string; // Only send to recruiter if condition met
  includeSuperAdmin?: boolean;
}> = {
  // Team events
  team_member_added: { roles: [], includeSuperAdmin: true },
  team_member_accepted: { roles: ["owner"] },
  
  // Job events
  job_created: { roles: ["owner", "manager"] },
  job_assigned: { roles: ["owner", "manager", "recruiter"] },
  job_paused: { roles: ["owner", "manager"] },
  job_closed: { roles: ["owner", "manager"], includeSuperAdmin: true },
  candidate_hired: { roles: ["owner", "manager"], includeSuperAdmin: true },
  
  // Candidate events
  cv_submitted: { roles: ["owner", "manager"] },
  candidate_status_updated: { roles: ["owner", "manager"] },
  interview_scheduled: { roles: ["owner", "manager", "recruiter"] },
  candidate_rejected: { roles: ["owner", "manager", "recruiter"] },
  candidate_offered: { roles: ["owner", "manager"] },
  
  // Billing events
  package_changed: { roles: ["owner"], includeSuperAdmin: true },
  payment_successful: { roles: ["owner"] },
  payment_failed: { roles: ["owner"] },
  subscription_expired: { roles: ["owner"] },
};

// ============================================================================
// EMAIL TEMPLATES - URLs are resolved at runtime using centralized utility
// ============================================================================

function getEmailTemplate(eventType: NotificationEventType, data: Record<string, unknown>): {
  subject: string;
  html: string;
  senderType: EmailSenderType;
} {
  // Resolve all URLs at runtime using centralized utility
  const appBaseUrl = getAppBaseUrl();
  const dashboardUrl = getDashboardUrl();
  const billingUrl = getBillingUrl();
  const teamUrl = getTeamUrl();
  const adminUsersUrl = getAdminUrl("users");

  // Build clickable button HTML with proper inline styles for email clients
  const buildButton = (text: string, url: string): string => `
    <table cellpadding="0" cellspacing="0" border="0" style="margin: 24px 0;">
      <tr>
        <td align="center" bgcolor="#00008B" style="border-radius: 8px;">
          <a href="${url}" target="_blank" rel="noopener noreferrer" style="display: inline-block; padding: 14px 32px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 16px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 8px; background-color: #00008B;">
            ${text}
          </a>
        </td>
      </tr>
    </table>
  `;

  const wrapEmail = (content: string, buttonText?: string, buttonUrl?: string): string => `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>HireMetrics Notification</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; background-color: #f8fafc;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f8fafc;">
        <tr>
          <td align="center" style="padding: 40px 20px;">
            <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
              <!-- Header -->
              <tr>
                <td align="center" style="padding: 28px; border-bottom: 1px solid #e5e7eb;">
                  <table cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td style="background: linear-gradient(135deg, #00008B 0%, #1E3A8A 100%); border-radius: 10px; padding: 10px; width: 44px; height: 44px; text-align: center; vertical-align: middle;">
                        <span style="font-family: Arial, sans-serif; font-size: 22px; font-weight: 900; color: #ffffff;">H</span>
                      </td>
                      <td style="padding-left: 12px; font-family: 'Segoe UI', Arial, sans-serif; font-weight: 700; font-size: 20px; color: #0F172A;">
                        HireMetrics
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <!-- Content -->
              <tr>
                <td style="padding: 32px 40px;">
                  ${content}
                  ${buttonText && buttonUrl ? buildButton(buttonText, buttonUrl) : ''}
                </td>
              </tr>
              <!-- Footer -->
              <tr>
                <td style="background-color: #f8fafc; padding: 24px; text-align: center; border-top: 1px solid #e5e7eb;">
                  <p style="margin: 0 0 8px; color: #64748b; font-size: 13px;">HireMetrics - Enterprise Recruitment Platform</p>
                  <p style="margin: 0; color: #94a3b8; font-size: 12px;">
                    <a href="${dashboardUrl}" target="_blank" rel="noopener noreferrer" style="color: #00008B; text-decoration: none;">Visit Dashboard</a>
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  // Helper for highlight box with inline styles
  const highlightBox = (items: Array<{ label: string; value: string }>): string => `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f3f4f6; border-radius: 8px; margin: 20px 0;">
      <tr>
        <td style="padding: 20px;">
          ${items.map(item => `
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 8px 0;">
              <tr>
                <td style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; color: #374151; font-weight: 600; width: 140px; vertical-align: top;">${item.label}:</td>
                <td style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; color: #4b5563;">${item.value}</td>
              </tr>
            </table>
          `).join('')}
        </td>
      </tr>
    </table>
  `;

  switch (eventType) {
    // ==================== TEAM EVENTS ====================
    case "team_member_added":
      return {
        subject: "New Team Member Added - HireMetrics",
        senderType: "notifications",
        html: wrapEmail(`
          <h1 style="margin: 0 0 16px; font-size: 22px; font-weight: 700; color: #111827;">New Team Member Added</h1>
          <p style="margin: 0 0 16px; color: #4b5563; font-size: 16px;">A new team member has been added to a HireMetrics account.</p>
          ${highlightBox([
            { label: "Owner", value: String(data.owner_name || "N/A") },
            { label: "New Member", value: String(data.member_email || "N/A") },
            { label: "Role", value: String(data.member_role || "N/A") },
            { label: "Date", value: new Date().toLocaleString("en-GB", { timeZone: "Europe/London" }) }
          ])}
        `, "View in Admin Panel", adminUsersUrl),
      };

    case "team_member_accepted":
      return {
        subject: "Team Member Joined - HireMetrics",
        senderType: "notifications",
        html: wrapEmail(`
          <h1 style="margin: 0 0 16px; font-size: 22px; font-weight: 700; color: #111827;">Team Member Joined Successfully</h1>
          <p style="margin: 0 0 16px; color: #4b5563; font-size: 16px;">A team member has accepted their invitation and joined your organisation.</p>
          ${highlightBox([
            { label: "Member", value: String(data.member_name || data.member_email || "N/A") },
            { label: "Role", value: String(data.member_role || "N/A") }
          ])}
        `, "View Team", teamUrl),
      };

    // ==================== JOB EVENTS ====================
    case "job_created":
      return {
        subject: `New Job Created: ${data.job_title || "Untitled"} - HireMetrics`,
        senderType: "notifications",
        html: wrapEmail(`
          <h1 style="margin: 0 0 16px; font-size: 22px; font-weight: 700; color: #111827;">New Job Created</h1>
          <p style="margin: 0 0 16px; color: #4b5563; font-size: 16px;">A new job has been created in your account.</p>
          ${highlightBox([
            { label: "Job Title", value: String(data.job_title || "N/A") },
            { label: "Client", value: String(data.client_name || "N/A") },
            { label: "Created By", value: String(data.created_by_name || "N/A") }
          ])}
        `, "View Job", buildAppUrl(`/jobs/${data.job_id}`)),
      };

    case "job_assigned":
      return {
        subject: `Job Assigned to You: ${data.job_title || "Untitled"} - HireMetrics`,
        senderType: "notifications",
        html: wrapEmail(`
          <h1 style="margin: 0 0 16px; font-size: 22px; font-weight: 700; color: #111827;">Job Assigned</h1>
          <p style="margin: 0 0 16px; color: #4b5563; font-size: 16px;">You have been assigned to work on a job.</p>
          ${highlightBox([
            { label: "Job Title", value: String(data.job_title || "N/A") },
            { label: "Client", value: String(data.client_name || "N/A") },
            { label: "Assigned By", value: String(data.assigned_by_name || "N/A") }
          ])}
        `, "View Job Details", buildAppUrl(`/jobs/${data.job_id}`)),
      };

    case "job_paused":
      return {
        subject: `Job Paused: ${data.job_title || "Untitled"} - HireMetrics`,
        senderType: "notifications",
        html: wrapEmail(`
          <h1 style="margin: 0 0 16px; font-size: 22px; font-weight: 700; color: #111827;">Job Paused</h1>
          <p style="margin: 0 0 16px; color: #4b5563; font-size: 16px;">A job has been placed on hold.</p>
          ${highlightBox([
            { label: "Job Title", value: String(data.job_title || "N/A") },
            { label: "Client", value: String(data.client_name || "N/A") },
            { label: "Reason", value: String(data.reason || "Not specified") }
          ])}
        `, "View Job", buildAppUrl(`/jobs/${data.job_id}`)),
      };

    case "job_closed":
    case "candidate_hired":
      return {
        subject: `Job Closed: ${data.job_title || "Untitled"} - HireMetrics`,
        senderType: "notifications",
        html: wrapEmail(`
          <h1 style="margin: 0 0 16px; font-size: 22px; font-weight: 700; color: #111827;">Job Successfully Closed</h1>
          <p style="margin: 0 0 16px; color: #4b5563; font-size: 16px;">A job has been closed with a successful hire.</p>
          ${highlightBox([
            { label: "Job Title", value: String(data.job_title || "N/A") },
            { label: "Client", value: String(data.client_name || "N/A") },
            { label: "Hired Candidate", value: String(data.candidate_name || "N/A") }
          ])}
        `, "View Job", buildAppUrl(`/jobs/${data.job_id}`)),
      };

    // ==================== CANDIDATE EVENTS ====================
    case "cv_submitted":
      return {
        subject: `CV Submitted: ${data.candidate_name || "Candidate"} for ${data.job_title || "Job"} - HireMetrics`,
        senderType: "notifications",
        html: wrapEmail(`
          <h1 style="margin: 0 0 16px; font-size: 22px; font-weight: 700; color: #111827;">CV Submitted</h1>
          <p style="margin: 0 0 16px; color: #4b5563; font-size: 16px;">A CV has been submitted for a job.</p>
          ${highlightBox([
            { label: "Candidate", value: String(data.candidate_name || "N/A") },
            { label: "Job", value: String(data.job_title || "N/A") },
            { label: "Submitted By", value: String(data.submitted_by_name || "N/A") }
          ])}
        `, "View Candidate", buildAppUrl(`/candidates/${data.candidate_id}`)),
      };

    case "candidate_status_updated":
      return {
        subject: `Candidate Status Updated: ${data.candidate_name || "Candidate"} - HireMetrics`,
        senderType: "notifications",
        html: wrapEmail(`
          <h1 style="margin: 0 0 16px; font-size: 22px; font-weight: 700; color: #111827;">Candidate Status Updated</h1>
          <p style="margin: 0 0 16px; color: #4b5563; font-size: 16px;">A candidate's status has been updated.</p>
          ${highlightBox([
            { label: "Candidate", value: String(data.candidate_name || "N/A") },
            { label: "Job", value: String(data.job_title || "N/A") },
            { label: "New Status", value: String(data.new_status || "N/A") },
            { label: "Previous Status", value: String(data.old_status || "N/A") }
          ])}
        `, "View Candidate", buildAppUrl(`/candidates/${data.candidate_id}`)),
      };

    case "interview_scheduled":
      return {
        subject: `Interview Scheduled: ${data.candidate_name || "Candidate"} - HireMetrics`,
        senderType: "notifications",
        html: wrapEmail(`
          <h1 style="margin: 0 0 16px; font-size: 22px; font-weight: 700; color: #111827;">Interview Scheduled</h1>
          <p style="margin: 0 0 16px; color: #4b5563; font-size: 16px;">An interview has been scheduled.</p>
          ${highlightBox([
            { label: "Candidate", value: String(data.candidate_name || "N/A") },
            { label: "Job", value: String(data.job_title || "N/A") },
            { label: "Date/Time", value: String(data.interview_time || "TBC") }
          ])}
        `, "View Event", buildAppUrl(`/events/${data.event_id}`)),
      };

    case "candidate_rejected":
      return {
        subject: `Candidate Rejected: ${data.candidate_name || "Candidate"} - HireMetrics`,
        senderType: "notifications",
        html: wrapEmail(`
          <h1 style="margin: 0 0 16px; font-size: 22px; font-weight: 700; color: #111827;">Candidate Rejected</h1>
          <p style="margin: 0 0 16px; color: #4b5563; font-size: 16px;">A candidate has been rejected.</p>
          ${highlightBox([
            { label: "Candidate", value: String(data.candidate_name || "N/A") },
            { label: "Job", value: String(data.job_title || "N/A") },
            { label: "Reason", value: String(data.reason || "Not specified") }
          ])}
        `, "View Candidate", buildAppUrl(`/candidates/${data.candidate_id}`)),
      };

    case "candidate_offered":
      return {
        subject: `Offer Made: ${data.candidate_name || "Candidate"} - HireMetrics`,
        senderType: "notifications",
        html: wrapEmail(`
          <h1 style="margin: 0 0 16px; font-size: 22px; font-weight: 700; color: #111827;">Offer Made to Candidate</h1>
          <p style="margin: 0 0 16px; color: #4b5563; font-size: 16px;">An offer has been made to a candidate.</p>
          ${highlightBox([
            { label: "Candidate", value: String(data.candidate_name || "N/A") },
            { label: "Job", value: String(data.job_title || "N/A") },
            { label: "Client", value: String(data.client_name || "N/A") }
          ])}
        `, "View Candidate", buildAppUrl(`/candidates/${data.candidate_id}`)),
      };

    // ==================== BILLING EVENTS ====================
    case "package_changed":
      return {
        subject: `Package ${data.change_type === "upgrade" ? "Upgraded" : "Changed"} - HireMetrics`,
        senderType: "billing",
        html: wrapEmail(`
          <h1 style="margin: 0 0 16px; font-size: 22px; font-weight: 700; color: #111827;">Subscription Package Changed</h1>
          <p style="margin: 0 0 16px; color: #4b5563; font-size: 16px;">Your subscription package has been ${data.change_type || "updated"}.</p>
          ${highlightBox([
            { label: "Previous Package", value: String(data.old_package || "N/A") },
            { label: "New Package", value: String(data.new_package || "N/A") },
            { label: "Effective", value: String(data.effective_date || "Immediately") }
          ])}
        `, "View Billing", billingUrl),
      };

    case "payment_successful":
      return {
        subject: "Payment Successful - HireMetrics",
        senderType: "billing",
        html: wrapEmail(`
          <h1 style="margin: 0 0 16px; font-size: 22px; font-weight: 700; color: #111827;">Payment Successful</h1>
          <p style="margin: 0 0 16px; color: #4b5563; font-size: 16px;">Your payment has been processed successfully.</p>
          ${highlightBox([
            { label: "Amount", value: `${data.currency || "GBP"} ${data.amount || "N/A"}` },
            { label: "Invoice", value: String(data.invoice_number || "N/A") },
            { label: "Date", value: new Date().toLocaleDateString("en-GB") }
          ])}
          <p style="margin: 16px 0; color: #4b5563; font-size: 14px;">Your invoice is attached to this email.</p>
        `, "View Billing History", billingUrl),
      };

    case "payment_failed":
      return {
        subject: "Payment Failed - Action Required - HireMetrics",
        senderType: "billing",
        html: wrapEmail(`
          <h1 style="margin: 0 0 16px; font-size: 22px; font-weight: 700; color: #111827;">Payment Failed</h1>
          <p style="margin: 0 0 16px; color: #4b5563; font-size: 16px;">We were unable to process your payment. Please update your payment method to avoid service interruption.</p>
          ${highlightBox([
            { label: "Amount", value: `${data.currency || "GBP"} ${data.amount || "N/A"}` },
            { label: "Reason", value: String(data.failure_reason || "Payment declined") }
          ])}
        `, "Update Payment Method", billingUrl),
      };

    case "subscription_expired":
      return {
        subject: "Subscription Expired - HireMetrics",
        senderType: "billing",
        html: wrapEmail(`
          <h1 style="margin: 0 0 16px; font-size: 22px; font-weight: 700; color: #111827;">Subscription Expired</h1>
          <p style="margin: 0 0 16px; color: #4b5563; font-size: 16px;">Your HireMetrics subscription has expired. Renew now to continue using the platform.</p>
          ${highlightBox([
            { label: "Package", value: String(data.package_name || "N/A") },
            { label: "Expired", value: String(data.expired_date || new Date().toLocaleDateString("en-GB")) }
          ])}
        `, "Renew Subscription", billingUrl),
      };

    default:
      return {
        subject: "Notification - HireMetrics",
        senderType: "notifications",
        html: wrapEmail(`
          <h1 style="margin: 0 0 16px; font-size: 22px; font-weight: 700; color: #111827;">Notification</h1>
          <p style="margin: 0 0 16px; color: #4b5563; font-size: 16px;">You have a new notification from HireMetrics.</p>
        `, "View Dashboard", dashboardUrl),
      };
  }
}

// ============================================================================
// NOTIFICATION TITLE/MESSAGE GENERATORS
// ============================================================================

function getNotificationContent(eventType: NotificationEventType, data: Record<string, unknown>): {
  title: string;
  message: string;
  link?: string;
} {
  switch (eventType) {
    case "team_member_added":
      return {
        title: "New Team Member Added",
        message: `${data.member_email} has been invited as ${data.member_role}`,
        link: "/team",
      };
    case "team_member_accepted":
      return {
        title: "Team Member Joined",
        message: `${data.member_name || data.member_email} has joined the team`,
        link: "/team",
      };
    case "job_created":
      return {
        title: "New Job Created",
        message: `Job "${data.job_title}" has been created`,
        link: `/jobs/${data.job_id}`,
      };
    case "job_assigned":
      return {
        title: "Job Assigned",
        message: `You have been assigned to "${data.job_title}"`,
        link: `/jobs/${data.job_id}`,
      };
    case "job_paused":
      return {
        title: "Job Paused",
        message: `Job "${data.job_title}" has been placed on hold`,
        link: `/jobs/${data.job_id}`,
      };
    case "job_closed":
    case "candidate_hired":
      return {
        title: "Job Closed",
        message: `Job "${data.job_title}" has been successfully closed`,
        link: `/jobs/${data.job_id}`,
      };
    case "cv_submitted":
      return {
        title: "CV Submitted",
        message: `${data.candidate_name} submitted for "${data.job_title}"`,
        link: `/candidates/${data.candidate_id}`,
      };
    case "candidate_status_updated":
      return {
        title: "Candidate Status Updated",
        message: `${data.candidate_name} moved to ${data.new_status}`,
        link: `/candidates/${data.candidate_id}`,
      };
    case "interview_scheduled":
      return {
        title: "Interview Scheduled",
        message: `Interview scheduled for ${data.candidate_name}`,
        link: `/events/${data.event_id}`,
      };
    case "candidate_rejected":
      return {
        title: "Candidate Rejected",
        message: `${data.candidate_name} has been rejected`,
        link: `/candidates/${data.candidate_id}`,
      };
    case "candidate_offered":
      return {
        title: "Offer Made",
        message: `Offer made to ${data.candidate_name}`,
        link: `/candidates/${data.candidate_id}`,
      };
    case "package_changed":
      return {
        title: "Package Changed",
        message: `Subscription ${data.change_type} to ${data.new_package}`,
        link: "/billing",
      };
    case "payment_successful":
      return {
        title: "Payment Successful",
        message: `Payment of ${data.currency} ${data.amount} processed`,
        link: "/billing",
      };
    case "payment_failed":
      return {
        title: "Payment Failed",
        message: "Your payment could not be processed",
        link: "/billing",
      };
    case "subscription_expired":
      return {
        title: "Subscription Expired",
        message: "Your subscription has expired",
        link: "/billing",
      };
    default:
      return {
        title: "Notification",
        message: "You have a new notification",
        link: "/dashboard",
      };
  }
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload: NotificationPayload = await req.json();
    const { event_type, tenant_id, actor_user_id, data, skip_email, skip_notification } = payload;

    if (!event_type || !tenant_id) {
      return new Response(
        JSON.stringify({ error: "Missing event_type or tenant_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    logEmailEvent("dispatch_notification_received", { event_type, tenant_id, data });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    const routingConfig = EVENT_RECIPIENTS[event_type];
    if (!routingConfig) {
      console.warn(`[Notification] Unknown event type: ${event_type}`);
      return new Response(
        JSON.stringify({ success: false, error: "Unknown event type" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get recipients based on roles
    const recipientUserIds: string[] = [];
    const recipientEmails: string[] = [];

    // Get users by role within tenant
    for (const role of routingConfig.roles) {
      const { data: roleUsers, error } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("tenant_id", tenant_id)
        .eq("role", role);

      if (!error && roleUsers) {
        for (const ru of roleUsers) {
          if (!recipientUserIds.includes(ru.user_id)) {
            recipientUserIds.push(ru.user_id);
          }
        }
      }
    }

    // Include super admin if configured
    if (routingConfig.includeSuperAdmin) {
      const { data: superAdmins } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "super_admin");

      if (superAdmins) {
        for (const sa of superAdmins) {
          if (!recipientUserIds.includes(sa.user_id)) {
            recipientUserIds.push(sa.user_id);
          }
        }
      }
      // Always include admin email for super admin events
      if (!recipientEmails.includes(ADMIN_EMAIL)) {
        recipientEmails.push(ADMIN_EMAIL);
      }
    }

    // Remove actor from recipients (don't notify yourself)
    const filteredUserIds = recipientUserIds.filter(id => id !== actor_user_id);

    // Get email addresses for users
    if (filteredUserIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, email")
        .in("id", filteredUserIds);

      if (profiles) {
        for (const p of profiles) {
          if (p.email && !recipientEmails.includes(p.email)) {
            recipientEmails.push(p.email);
          }
        }
      }
    }

    // Add specifically mentioned recipients (e.g., the team member themselves)
    if (data.member_email && typeof data.member_email === "string") {
      if (!recipientEmails.includes(data.member_email)) {
        recipientEmails.push(data.member_email);
      }
    }

    const results = {
      notifications_created: 0,
      emails_sent: 0,
      emails_failed: 0,
      recipients: filteredUserIds.length,
    };

    // Create in-app notifications
    if (!skip_notification && filteredUserIds.length > 0) {
      const notifContent = getNotificationContent(event_type, data);
      const notifications = filteredUserIds.map(userId => ({
        tenant_id,
        user_id: userId,
        type: event_type,
        title: notifContent.title,
        message: notifContent.message,
        link: notifContent.link,
        entity_type: data.entity_type as string || null,
        entity_id: data.entity_id as string || null,
        metadata: data,
      }));

      const { error: insertError } = await supabase
        .from("notifications")
        .insert(notifications);

      if (!insertError) {
        results.notifications_created = notifications.length;
      } else {
        console.error("[Notification] Failed to create notifications:", insertError);
      }
    }

    // Send emails
    if (!skip_email && recipientEmails.length > 0) {
      const emailTemplate = getEmailTemplate(event_type, data);
      const resend = createResendClient();

      for (const email of recipientEmails) {
        const dedupKey = generateDedupKey(email, emailTemplate.subject, event_type);
        if (isDuplicateEmail(dedupKey)) {
          continue;
        }

        const { data: emailData, error: emailError } = await sendEmailWithRetry(resend, {
          to: email,
          subject: emailTemplate.subject,
          html: emailTemplate.html,
          senderType: emailTemplate.senderType,
        });

        // Log email
        await supabase.from("email_logs").insert({
          tenant_id,
          recipient_email: email,
          subject: emailTemplate.subject,
          template_name: event_type,
          status: emailError ? "failed" : "sent",
          error_message: emailError?.message,
          sent_by: actor_user_id || null,
          metadata: { event_type, data },
        });

        if (emailError) {
          results.emails_failed++;
          console.error(`[Notification] Email failed to ${email}:`, emailError);
        } else {
          results.emails_sent++;
        }
      }
    }

    logEmailEvent("dispatch_notification_complete", {
      event_type,
      tenant_id,
      ...results,
    });

    return new Response(
      JSON.stringify({ success: true, ...results }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[Notification] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
