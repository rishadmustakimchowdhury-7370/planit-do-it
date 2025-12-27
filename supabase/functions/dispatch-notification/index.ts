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
// EMAIL TEMPLATES
// ============================================================================

const APP_URL = Deno.env.get("APP_URL") || "https://hiremetrics.co.uk";

function getEmailTemplate(eventType: NotificationEventType, data: Record<string, unknown>): {
  subject: string;
  html: string;
  senderType: EmailSenderType;
} {
  const baseStyles = `
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
      .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
      .header { text-align: center; margin-bottom: 30px; }
      .logo { font-size: 24px; font-weight: 700; color: #0052CC; }
      .content { background: #fff; border-radius: 8px; padding: 30px; border: 1px solid #e5e7eb; }
      .title { font-size: 20px; font-weight: 600; margin-bottom: 16px; color: #111827; }
      .text { color: #4b5563; margin-bottom: 16px; }
      .highlight { background: #f3f4f6; padding: 16px; border-radius: 6px; margin: 16px 0; }
      .highlight-item { margin: 8px 0; }
      .label { font-weight: 600; color: #374151; }
      .button { display: inline-block; background: #0052CC; color: #fff !important; text-decoration: none; padding: 12px 24px; border-radius: 6px; margin-top: 20px; font-weight: 500; }
      .footer { margin-top: 30px; text-align: center; font-size: 12px; color: #9ca3af; }
      .footer a { color: #6b7280; }
    </style>
  `;

  const header = `
    <div class="header">
      <div class="logo">HireMetrics</div>
    </div>
  `;

  const footer = `
    <div class="footer">
      <p>HireMetrics - Enterprise Recruitment Platform</p>
      <p>This email was sent from HireMetrics CRM.</p>
      <p><a href="${APP_URL}">Visit Dashboard</a></p>
    </div>
  `;

  const wrapEmail = (content: string): string => `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      ${baseStyles}
    </head>
    <body>
      <div class="container">
        ${header}
        <div class="content">
          ${content}
        </div>
        ${footer}
      </div>
    </body>
    </html>
  `;

  switch (eventType) {
    // ==================== TEAM EVENTS ====================
    case "team_member_added":
      return {
        subject: "New Team Member Added - HireMetrics",
        senderType: "notifications",
        html: wrapEmail(`
          <h1 class="title">New Team Member Added</h1>
          <p class="text">A new team member has been added to a HireMetrics account.</p>
          <div class="highlight">
            <div class="highlight-item"><span class="label">Owner:</span> ${data.owner_name || "N/A"}</div>
            <div class="highlight-item"><span class="label">New Member:</span> ${data.member_email || "N/A"}</div>
            <div class="highlight-item"><span class="label">Role:</span> ${data.member_role || "N/A"}</div>
            <div class="highlight-item"><span class="label">Date:</span> ${new Date().toLocaleString("en-GB", { timeZone: "Europe/London" })}</div>
          </div>
          <a href="${APP_URL}/admin/users" class="button">View in Admin Panel</a>
        `),
      };

    case "team_member_accepted":
      return {
        subject: "Team Member Joined - HireMetrics",
        senderType: "notifications",
        html: wrapEmail(`
          <h1 class="title">Team Member Joined Successfully</h1>
          <p class="text">A team member has accepted their invitation and joined your organisation.</p>
          <div class="highlight">
            <div class="highlight-item"><span class="label">Member:</span> ${data.member_name || data.member_email || "N/A"}</div>
            <div class="highlight-item"><span class="label">Role:</span> ${data.member_role || "N/A"}</div>
          </div>
          <a href="${APP_URL}/team" class="button">View Team</a>
        `),
      };

    // ==================== JOB EVENTS ====================
    case "job_created":
      return {
        subject: `New Job Created: ${data.job_title || "Untitled"} - HireMetrics`,
        senderType: "notifications",
        html: wrapEmail(`
          <h1 class="title">New Job Created</h1>
          <p class="text">A new job has been created in your account.</p>
          <div class="highlight">
            <div class="highlight-item"><span class="label">Job Title:</span> ${data.job_title || "N/A"}</div>
            <div class="highlight-item"><span class="label">Client:</span> ${data.client_name || "N/A"}</div>
            <div class="highlight-item"><span class="label">Created By:</span> ${data.created_by_name || "N/A"}</div>
          </div>
          <a href="${APP_URL}/jobs/${data.job_id}" class="button">View Job</a>
        `),
      };

    case "job_assigned":
      return {
        subject: `Job Assigned to You: ${data.job_title || "Untitled"} - HireMetrics`,
        senderType: "notifications",
        html: wrapEmail(`
          <h1 class="title">Job Assigned</h1>
          <p class="text">You have been assigned to work on a job.</p>
          <div class="highlight">
            <div class="highlight-item"><span class="label">Job Title:</span> ${data.job_title || "N/A"}</div>
            <div class="highlight-item"><span class="label">Client:</span> ${data.client_name || "N/A"}</div>
            <div class="highlight-item"><span class="label">Assigned By:</span> ${data.assigned_by_name || "N/A"}</div>
          </div>
          <a href="${APP_URL}/jobs/${data.job_id}" class="button">View Job Details</a>
        `),
      };

    case "job_paused":
      return {
        subject: `Job Paused: ${data.job_title || "Untitled"} - HireMetrics`,
        senderType: "notifications",
        html: wrapEmail(`
          <h1 class="title">Job Paused</h1>
          <p class="text">A job has been placed on hold.</p>
          <div class="highlight">
            <div class="highlight-item"><span class="label">Job Title:</span> ${data.job_title || "N/A"}</div>
            <div class="highlight-item"><span class="label">Client:</span> ${data.client_name || "N/A"}</div>
            <div class="highlight-item"><span class="label">Reason:</span> ${data.reason || "Not specified"}</div>
          </div>
          <a href="${APP_URL}/jobs/${data.job_id}" class="button">View Job</a>
        `),
      };

    case "job_closed":
    case "candidate_hired":
      return {
        subject: `Job Closed: ${data.job_title || "Untitled"} - HireMetrics`,
        senderType: "notifications",
        html: wrapEmail(`
          <h1 class="title">Job Successfully Closed</h1>
          <p class="text">A job has been closed with a successful hire.</p>
          <div class="highlight">
            <div class="highlight-item"><span class="label">Job Title:</span> ${data.job_title || "N/A"}</div>
            <div class="highlight-item"><span class="label">Client:</span> ${data.client_name || "N/A"}</div>
            <div class="highlight-item"><span class="label">Hired Candidate:</span> ${data.candidate_name || "N/A"}</div>
          </div>
          <a href="${APP_URL}/jobs/${data.job_id}" class="button">View Job</a>
        `),
      };

    // ==================== CANDIDATE EVENTS ====================
    case "cv_submitted":
      return {
        subject: `CV Submitted: ${data.candidate_name || "Candidate"} for ${data.job_title || "Job"} - HireMetrics`,
        senderType: "notifications",
        html: wrapEmail(`
          <h1 class="title">CV Submitted</h1>
          <p class="text">A CV has been submitted for a job.</p>
          <div class="highlight">
            <div class="highlight-item"><span class="label">Candidate:</span> ${data.candidate_name || "N/A"}</div>
            <div class="highlight-item"><span class="label">Job:</span> ${data.job_title || "N/A"}</div>
            <div class="highlight-item"><span class="label">Submitted By:</span> ${data.submitted_by_name || "N/A"}</div>
          </div>
          <a href="${APP_URL}/candidates/${data.candidate_id}" class="button">View Candidate</a>
        `),
      };

    case "candidate_status_updated":
      return {
        subject: `Candidate Status Updated: ${data.candidate_name || "Candidate"} - HireMetrics`,
        senderType: "notifications",
        html: wrapEmail(`
          <h1 class="title">Candidate Status Updated</h1>
          <p class="text">A candidate's status has been updated.</p>
          <div class="highlight">
            <div class="highlight-item"><span class="label">Candidate:</span> ${data.candidate_name || "N/A"}</div>
            <div class="highlight-item"><span class="label">Job:</span> ${data.job_title || "N/A"}</div>
            <div class="highlight-item"><span class="label">New Status:</span> ${data.new_status || "N/A"}</div>
            <div class="highlight-item"><span class="label">Previous Status:</span> ${data.old_status || "N/A"}</div>
          </div>
          <a href="${APP_URL}/candidates/${data.candidate_id}" class="button">View Candidate</a>
        `),
      };

    case "interview_scheduled":
      return {
        subject: `Interview Scheduled: ${data.candidate_name || "Candidate"} - HireMetrics`,
        senderType: "notifications",
        html: wrapEmail(`
          <h1 class="title">Interview Scheduled</h1>
          <p class="text">An interview has been scheduled.</p>
          <div class="highlight">
            <div class="highlight-item"><span class="label">Candidate:</span> ${data.candidate_name || "N/A"}</div>
            <div class="highlight-item"><span class="label">Job:</span> ${data.job_title || "N/A"}</div>
            <div class="highlight-item"><span class="label">Date/Time:</span> ${data.interview_time || "TBC"}</div>
          </div>
          <a href="${APP_URL}/events/${data.event_id}" class="button">View Event</a>
        `),
      };

    case "candidate_rejected":
      return {
        subject: `Candidate Rejected: ${data.candidate_name || "Candidate"} - HireMetrics`,
        senderType: "notifications",
        html: wrapEmail(`
          <h1 class="title">Candidate Rejected</h1>
          <p class="text">A candidate has been rejected.</p>
          <div class="highlight">
            <div class="highlight-item"><span class="label">Candidate:</span> ${data.candidate_name || "N/A"}</div>
            <div class="highlight-item"><span class="label">Job:</span> ${data.job_title || "N/A"}</div>
            <div class="highlight-item"><span class="label">Reason:</span> ${data.reason || "Not specified"}</div>
          </div>
          <a href="${APP_URL}/candidates/${data.candidate_id}" class="button">View Candidate</a>
        `),
      };

    case "candidate_offered":
      return {
        subject: `Offer Made: ${data.candidate_name || "Candidate"} - HireMetrics`,
        senderType: "notifications",
        html: wrapEmail(`
          <h1 class="title">Offer Made to Candidate</h1>
          <p class="text">An offer has been made to a candidate.</p>
          <div class="highlight">
            <div class="highlight-item"><span class="label">Candidate:</span> ${data.candidate_name || "N/A"}</div>
            <div class="highlight-item"><span class="label">Job:</span> ${data.job_title || "N/A"}</div>
            <div class="highlight-item"><span class="label">Client:</span> ${data.client_name || "N/A"}</div>
          </div>
          <a href="${APP_URL}/candidates/${data.candidate_id}" class="button">View Candidate</a>
        `),
      };

    // ==================== BILLING EVENTS ====================
    case "package_changed":
      return {
        subject: `Package ${data.change_type === "upgrade" ? "Upgraded" : "Changed"} - HireMetrics`,
        senderType: "billing",
        html: wrapEmail(`
          <h1 class="title">Subscription Package Changed</h1>
          <p class="text">Your subscription package has been ${data.change_type || "updated"}.</p>
          <div class="highlight">
            <div class="highlight-item"><span class="label">Previous Package:</span> ${data.old_package || "N/A"}</div>
            <div class="highlight-item"><span class="label">New Package:</span> ${data.new_package || "N/A"}</div>
            <div class="highlight-item"><span class="label">Effective:</span> ${data.effective_date || "Immediately"}</div>
          </div>
          <a href="${APP_URL}/billing" class="button">View Billing</a>
        `),
      };

    case "payment_successful":
      return {
        subject: "Payment Successful - HireMetrics",
        senderType: "billing",
        html: wrapEmail(`
          <h1 class="title">Payment Successful</h1>
          <p class="text">Your payment has been processed successfully.</p>
          <div class="highlight">
            <div class="highlight-item"><span class="label">Amount:</span> ${data.currency || "GBP"} ${data.amount || "N/A"}</div>
            <div class="highlight-item"><span class="label">Invoice:</span> ${data.invoice_number || "N/A"}</div>
            <div class="highlight-item"><span class="label">Date:</span> ${new Date().toLocaleDateString("en-GB")}</div>
          </div>
          <p class="text">Your invoice is attached to this email.</p>
          <a href="${APP_URL}/billing" class="button">View Billing History</a>
        `),
      };

    case "payment_failed":
      return {
        subject: "Payment Failed - Action Required - HireMetrics",
        senderType: "billing",
        html: wrapEmail(`
          <h1 class="title">Payment Failed</h1>
          <p class="text">We were unable to process your payment. Please update your payment method to avoid service interruption.</p>
          <div class="highlight">
            <div class="highlight-item"><span class="label">Amount:</span> ${data.currency || "GBP"} ${data.amount || "N/A"}</div>
            <div class="highlight-item"><span class="label">Reason:</span> ${data.failure_reason || "Payment declined"}</div>
          </div>
          <a href="${APP_URL}/billing" class="button">Update Payment Method</a>
        `),
      };

    case "subscription_expired":
      return {
        subject: "Subscription Expired - HireMetrics",
        senderType: "billing",
        html: wrapEmail(`
          <h1 class="title">Subscription Expired</h1>
          <p class="text">Your HireMetrics subscription has expired. Renew now to continue using the platform.</p>
          <div class="highlight">
            <div class="highlight-item"><span class="label">Package:</span> ${data.package_name || "N/A"}</div>
            <div class="highlight-item"><span class="label">Expired:</span> ${data.expired_date || new Date().toLocaleDateString("en-GB")}</div>
          </div>
          <a href="${APP_URL}/billing" class="button">Renew Subscription</a>
        `),
      };

    default:
      return {
        subject: "Notification - HireMetrics",
        senderType: "notifications",
        html: wrapEmail(`
          <h1 class="title">Notification</h1>
          <p class="text">You have a new notification from HireMetrics.</p>
          <a href="${APP_URL}/dashboard" class="button">View Dashboard</a>
        `),
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
