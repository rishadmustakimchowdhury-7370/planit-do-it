/**
 * HireMetrics Notification Dispatcher Helper
 * 
 * Use this helper to dispatch notifications from any edge function.
 * It calls the centralized dispatch-notification function.
 */

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

export type NotificationEventType =
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

export interface DispatchNotificationParams {
  event_type: NotificationEventType;
  tenant_id: string;
  actor_user_id?: string;
  data: Record<string, unknown>;
  skip_email?: boolean;
  skip_notification?: boolean;
}

export interface DispatchResult {
  success: boolean;
  notifications_created?: number;
  emails_sent?: number;
  emails_failed?: number;
  recipients?: number;
  error?: string;
}

/**
 * Dispatch a notification to the centralized notification system.
 * This creates in-app notifications and sends emails based on role routing.
 */
export async function dispatchNotification(
  params: DispatchNotificationParams
): Promise<DispatchResult> {
  try {
    const functionUrl = `${SUPABASE_URL}/functions/v1/dispatch-notification`;
    
    const response = await fetch(functionUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify(params),
    });

    const result = await response.json();
    
    if (!response.ok) {
      console.error("[NotificationDispatcher] Failed to dispatch:", result);
      return { success: false, error: result.error || "Failed to dispatch notification" };
    }

    return result as DispatchResult;
  } catch (error) {
    console.error("[NotificationDispatcher] Exception:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Dispatch multiple notifications in parallel.
 * Useful when an event affects multiple entities.
 */
export async function dispatchNotifications(
  notifications: DispatchNotificationParams[]
): Promise<DispatchResult[]> {
  return Promise.all(notifications.map(n => dispatchNotification(n)));
}
