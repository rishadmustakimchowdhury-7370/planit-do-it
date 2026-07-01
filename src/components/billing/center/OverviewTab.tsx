import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { CreditCard, Calendar, Tag, TrendingUp, Clock, ShieldCheck, AlertTriangle } from 'lucide-react';
import { useSubscriptionStatus } from '@/hooks/useSubscriptionStatus';
import { useUsageLimits } from '@/hooks/useUsageLimits';
import { useStripePaymentMethod } from '@/hooks/useBillingCenter';

function Stat({ icon: Icon, label, value, hint, tone = 'default' }: {
  icon: any; label: string; value: string; hint?: string;
  tone?: 'default' | 'success' | 'warning' | 'destructive';
}) {
  const toneRing = {
    default: 'border-border',
    success: 'border-success/40',
    warning: 'border-warning/40',
    destructive: 'border-destructive/40',
  }[tone];
  return (
    <Card className={`border ${toneRing}`}>
      <CardContent className="p-5">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
          <Icon className="h-3.5 w-3.5" /> {label}
        </div>
        <div className="mt-2 text-2xl font-semibold tracking-tight">{value}</div>
        {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
      </CardContent>
    </Card>
  );
}

export function OverviewTab() {
  const sub = useSubscriptionStatus();
  const { usageStats, isLoading } = useUsageLimits();
  const { paymentMethod, loading: pmLoading } = useStripePaymentMethod();

  if (sub.loading || isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
      </div>
    );
  }

  const statusTone = sub.suspended || sub.cancelled
    ? 'destructive' : sub.pastDue ? 'warning' : 'success';
  const storage = usageStats?.usage.candidates;
  const aiCredits = usageStats?.usage.aiCredits;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat icon={ShieldCheck} label="Current Plan" value={sub.planName ?? 'Free'} hint={sub.planSlug ?? ''} />
        <Stat icon={TrendingUp} label="Status" value={sub.status ?? 'inactive'} tone={statusTone as any}
              hint={sub.cancelled ? 'Will not renew' : sub.pastDue ? 'Past due' : 'Active'} />
        <Stat icon={Calendar} label="Next Renewal"
              value={sub.renewalDate ? format(new Date(sub.renewalDate), 'MMM d, yyyy') : '—'} />
        <Stat icon={Clock} label="Trial"
              value={sub.inTrial ? `${sub.remainingTrialDays ?? 0} days left` : '—'}
              hint={sub.trialEnd ? format(new Date(sub.trialEnd), 'MMM d, yyyy') : ''} />
        <Stat icon={CreditCard} label="Payment Method"
              value={pmLoading ? '…' : paymentMethod ? `${(paymentMethod.brand ?? 'CARD').toUpperCase()} •••• ${paymentMethod.last4 ?? '••••'}` : 'Not set'}
              hint={paymentMethod ? `Expires ${paymentMethod.exp_month ?? '--'}/${paymentMethod.exp_year ?? '----'}` : ''} />
        <Stat icon={Tag} label="Current Discount" value="—" hint="Add a promo in the Promo tab" />
        <Stat icon={TrendingUp} label="AI Credits"
              value={aiCredits ? `${aiCredits.used} / ${aiCredits.limit}` : '—'}
              tone={aiCredits?.blocked ? 'destructive' : aiCredits?.warning ? 'warning' : 'default'} />
        <Stat icon={TrendingUp} label="Candidates"
              value={storage ? `${storage.used} / ${storage.limit}` : '—'}
              tone={storage?.blocked ? 'destructive' : storage?.warning ? 'warning' : 'default'} />
      </div>

      {(sub.pastDue || sub.suspended) && (
        <Card className="border-warning/40 bg-warning/5">
          <CardHeader className="flex-row items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-warning" />
            <CardTitle className="text-base">Action required</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Your subscription needs attention. Please update your payment method to avoid interruption.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
