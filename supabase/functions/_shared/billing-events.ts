// Single helper for billing notifications + audit.
// All paths (webhook, checkout, threshold notifier) call notifyBillingEvent so
// future delivery channels (Slack, SMS) plug in here once.
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

export type BillingEvent =
  | 'payment_failed'
  | 'payment_succeeded'
  | 'trial_will_end'
  | 'trial_ended'
  | 'subscription_renewed'
  | 'subscription_cancelled'
  | 'subscription_suspended'
  | 'subscription_reactivated'
  | 'promo_applied'
  | 'promo_expired'
  | 'storage_almost_full'
  | 'ai_usage_almost_full'
  | 'open_web_almost_full';

const DEFAULT_TITLES: Record<BillingEvent, string> = {
  payment_failed: 'Payment failed',
  payment_succeeded: 'Payment received',
  trial_will_end: 'Your trial is ending soon',
  trial_ended: 'Your trial has ended',
  subscription_renewed: 'Subscription renewed',
  subscription_cancelled: 'Subscription cancelled',
  subscription_suspended: 'Subscription suspended',
  subscription_reactivated: 'Subscription reactivated',
  promo_applied: 'Promo code applied',
  promo_expired: 'Promo code expired',
  storage_almost_full: 'Storage almost full',
  ai_usage_almost_full: 'AI usage almost at limit',
  open_web_almost_full: 'Open Web discovery limit almost reached',
};

export async function notifyBillingEvent(
  supabase: SupabaseClient,
  args: {
    tenantId: string | null | undefined;
    event: BillingEvent;
    message: string;
    title?: string;
    link?: string;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  if (!args.tenantId) return;
  try {
    await supabase.rpc('notify_billing_event', {
      _tenant_id: args.tenantId,
      _event: args.event,
      _title: args.title ?? DEFAULT_TITLES[args.event],
      _message: args.message,
      _link: args.link ?? '/billing',
      _metadata: args.metadata ?? {},
    });
  } catch (err) {
    console.error('[billing-events] notify failed', args.event, (err as Error).message);
  }
}
