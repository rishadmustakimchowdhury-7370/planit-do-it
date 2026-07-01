import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { Loader2, ArrowUpRight, ArrowDownRight, RefreshCcw, XCircle, PlayCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { useSubscriptionStatus } from '@/hooks/useSubscriptionStatus';
import { toast } from 'sonner';

function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? format(date, 'PP') : '—';
}

interface Plan {
  id: string; name: string; slug: string; description: string | null;
  price_monthly: number; price_yearly: number | null;
  stripe_price_id_monthly: string | null; stripe_price_id_yearly: string | null;
  features: any; max_users: number | null; max_jobs: number | null;
  max_candidates: number | null; match_credits_monthly: number | null;
  display_order: number;
}

export function SubscriptionTab() {
  const { tenantId } = useAuth();
  const sub = useSubscriptionStatus();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [billingInterval, setBillingInterval] = useState<'monthly' | 'yearly'>('monthly');

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from('subscription_plans')
        .select('*').eq('is_active', true).order('display_order');
      if (error) console.error('[SubscriptionTab] subscription_plans query failed', error);
      setPlans((data as any) ?? []);
      setLoading(false);
    })();
  }, []);

  const currentSlug = sub.planSlug;

  const change = async (plan: Plan, mode: 'upgrade' | 'downgrade' | 'switch') => {
    const targetPriceId = billingInterval === 'yearly' ? plan.stripe_price_id_yearly : plan.stripe_price_id_monthly;
    if (!targetPriceId) { toast.error('This plan is not configured for Stripe yet.'); return; }
    setBusy(plan.id);
    try {
      const { data, error } = await supabase.functions.invoke('change-subscription', {
        body: { plan_id: plan.id, interval: billingInterval, mode },
      });
      if (error) throw error;
      if ((data as any)?.checkout_url) { window.location.href = (data as any).checkout_url; return; }
      toast.success('Subscription updated');
      await sub.refresh();
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to change subscription');
    } finally { setBusy(null); }
  };

  const cancel = async () => {
    if (!confirm('Cancel subscription at the end of the current period?')) return;
    setBusy('cancel');
    try {
      const { error } = await supabase.functions.invoke('cancel-subscription');
      if (error) throw error;
      toast.success('Subscription will cancel at period end');
      await sub.refresh();
    } catch (e: any) { toast.error(e?.message ?? 'Failed to cancel'); }
    finally { setBusy(null); }
  };

  const resume = async () => {
    setBusy('resume');
    try {
      const { error } = await supabase.functions.invoke('resume-subscription');
      if (error) throw error;
      toast.success('Subscription resumed');
      await sub.refresh();
    } catch (e: any) { toast.error(e?.message ?? 'Failed to resume'); }
    finally { setBusy(null); }
  };

  if (loading || sub.loading) {
    return <div className="grid md:grid-cols-3 gap-4">{[0,1,2].map(i => <Skeleton key={i} className="h-64" />)}</div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <CardTitle>Current Subscription</CardTitle>
              <div className="text-sm text-muted-foreground">
                {sub.planName ?? 'Free'} · <Badge variant="outline" className="capitalize">{sub.status ?? 'inactive'}</Badge>
              </div>
            </div>
            <div className="flex gap-2">
              {sub.cancelled || sub.status === 'cancelled' ? (
                <Button variant="default" onClick={resume} disabled={busy === 'resume'}>
                  {busy === 'resume' ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />} Resume
                </Button>
              ) : (
                <Button variant="outline" onClick={cancel} disabled={busy === 'cancel'}>
                  {busy === 'cancel' ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />} Cancel
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid sm:grid-cols-3 gap-4 text-sm">
          <div><div className="text-muted-foreground text-xs uppercase">Renewal</div>
            {formatDate(sub.renewalDate)}</div>
          <div><div className="text-muted-foreground text-xs uppercase">Trial Ends</div>
            {formatDate(sub.trialEnd)}</div>
          <div><div className="text-muted-foreground text-xs uppercase">Grace Until</div>
            {formatDate(sub.graceUntil)}</div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-2">
        <span className="text-sm text-muted-foreground">Billing interval:</span>
        <div className="inline-flex rounded-md border p-0.5">
          <button onClick={() => setBillingInterval("monthly")}
            className={`px-3 py-1 text-xs rounded ${billingInterval === 'monthly' ? 'bg-primary text-primary-foreground' : ''}`}>Monthly</button>
          <button onClick={() => setBillingInterval("yearly")}
            className={`px-3 py-1 text-xs rounded ${billingInterval === 'yearly' ? 'bg-primary text-primary-foreground' : ''}`}>Yearly</button>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        {plans.map((p) => {
          const isCurrent = currentSlug === p.slug;
          const price = billingInterval === 'yearly' ? p.price_yearly ?? (p.price_monthly * 10) : p.price_monthly;
          return (
            <Card key={p.id} className={isCurrent ? 'border-primary ring-1 ring-primary/40' : ''}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{p.name}</CardTitle>
                  {isCurrent && <Badge>Current</Badge>}
                </div>
                <CardDescription>{p.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-3xl font-bold">${price}<span className="text-sm font-normal text-muted-foreground">/{billingInterval === 'yearly' ? 'yr' : 'mo'}</span></div>
                <ul className="text-sm space-y-1 text-muted-foreground">
                  <li>{p.max_users === -1 ? 'Unlimited' : p.max_users} users</li>
                  <li>{p.max_jobs === -1 ? 'Unlimited' : p.max_jobs} jobs</li>
                  <li>{p.max_candidates === -1 ? 'Unlimited' : p.max_candidates} candidates</li>
                  <li>{p.match_credits_monthly} AI credits / month</li>
                </ul>
                {!isCurrent && (
                  <Button className="w-full" disabled={busy === p.id} onClick={() => change(p, 'upgrade')}>
                    {busy === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUpRight className="h-4 w-4" />}
                    {currentSlug ? 'Switch to this plan' : 'Choose plan'}
                  </Button>
                )}
                {isCurrent && (
                  <Button variant="outline" className="w-full" disabled={busy === p.id} onClick={() => change(p, 'switch')}>
                    <RefreshCcw className="h-4 w-4" /> Switch to {billingInterval === 'monthly' ? 'Monthly' : 'Yearly'}
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
