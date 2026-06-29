// Global subscription banner. Driven entirely by useSubscriptionStatus + useUsageLimits.
// Mount once at the top of AppLayout — every protected page gets the same banner.
import { AlertTriangle, CreditCard, Clock, Ban, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useSubscriptionStatus } from '@/hooks/useSubscriptionStatus';
import { useUsageLimits } from '@/hooks/useUsageLimits';

type Tone = 'destructive' | 'warning' | 'info';

interface BannerSpec {
  tone: Tone;
  icon: typeof AlertTriangle;
  title: string;
  message: string;
  cta?: { to: string; label: string };
}

const toneClasses: Record<Tone, string> = {
  destructive: 'bg-destructive/10 border-destructive/30 text-destructive',
  warning: 'bg-warning/10 border-warning/30 text-warning-foreground',
  info: 'bg-accent/10 border-accent/30 text-foreground',
};

function pickBanner(sub: ReturnType<typeof useSubscriptionStatus>, usage: ReturnType<typeof useUsageLimits>['usageStats']): BannerSpec | null {
  if (sub.loading) return null;
  if (sub.suspended) return { tone: 'destructive', icon: Ban, title: 'Workspace suspended', message: 'Your workspace is suspended. Contact support to restore access.', cta: { to: '/billing', label: 'Manage billing' } };
  if (sub.cancelled) return { tone: 'destructive', icon: Ban, title: 'Subscription cancelled', message: 'Your subscription is no longer active. Re-subscribe to continue using paid features.', cta: { to: '/billing', label: 'Choose a plan' } };
  if (sub.pastDue) return { tone: 'destructive', icon: CreditCard, title: 'Payment failed', message: sub.inGracePeriod ? 'Update your payment method to avoid service interruption.' : 'Your last payment failed. Update your payment method now.', cta: { to: '/billing', label: 'Update payment' } };
  if (sub.inTrial && sub.remainingTrialDays !== null && sub.remainingTrialDays <= 3) {
    return { tone: 'warning', icon: Clock, title: 'Trial ending soon', message: `Your trial ends in ${sub.remainingTrialDays} day${sub.remainingTrialDays === 1 ? '' : 's'}. Add a payment method to keep your workspace active.`, cta: { to: '/billing', label: 'Add payment' } };
  }
  if (sub.renewalDate) {
    const days = Math.ceil((new Date(sub.renewalDate).getTime() - Date.now()) / 86_400_000);
    if (days >= 0 && days <= 3 && sub.status === 'active') {
      return { tone: 'info', icon: Clock, title: 'Renewal approaching', message: `Your subscription renews in ${days} day${days === 1 ? '' : 's'}.`, cta: { to: '/billing', label: 'Manage' } };
    }
  }
  if (usage?.hasBlocks) {
    return { tone: 'destructive', icon: Zap, title: 'Usage limit reached', message: 'You hit a plan limit. Upgrade to keep working without interruption.', cta: { to: '/billing', label: 'Upgrade plan' } };
  }
  if (usage?.hasWarnings) {
    return { tone: 'warning', icon: AlertTriangle, title: 'Approaching plan limit', message: 'You are close to a plan limit. Consider upgrading for more headroom.', cta: { to: '/usage', label: 'See usage' } };
  }
  return null;
}

export function SubscriptionStatusBanner() {
  const sub = useSubscriptionStatus();
  const { usageStats } = useUsageLimits();
  const banner = pickBanner(sub, usageStats);
  if (!banner) return null;
  const Icon = banner.icon;
  return (
    <div className={`mx-4 md:mx-6 lg:mx-8 mt-4 rounded-lg border px-4 py-3 flex items-start gap-3 ${toneClasses[banner.tone]}`} role="status">
      <Icon className="h-5 w-5 mt-0.5 shrink-0" />
      <div className="flex-1 text-sm">
        <p className="font-semibold leading-tight">{banner.title}</p>
        <p className="opacity-90">{banner.message}</p>
      </div>
      {banner.cta && (
        <Link to={banner.cta.to} className="text-sm font-medium underline underline-offset-2 whitespace-nowrap">
          {banner.cta.label}
        </Link>
      )}
    </div>
  );
}
