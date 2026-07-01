// Single source of truth for subscription state used across the app.
// Joins tenants + subscription_plans and exposes a normalized object.
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';

export interface SubscriptionStatus {
  loading: boolean;
  status: string | null;            // active | trial | past_due | cancelled | suspended | expired | pending | null
  planName: string | null;
  planSlug: string | null;
  trialEnd: string | null;
  renewalDate: string | null;
  pastDueSince: string | null;
  graceUntil: string | null;
  remainingTrialDays: number | null;
  pastDue: boolean;
  cancelled: boolean;
  suspended: boolean;
  paused: boolean;
  inGracePeriod: boolean;
  inTrial: boolean;
  active: boolean;                  // can use the app
  refresh: () => Promise<void>;
}

const initial: Omit<SubscriptionStatus, 'refresh'> = {
  loading: true,
  status: null, planName: null, planSlug: null,
  trialEnd: null, renewalDate: null, pastDueSince: null, graceUntil: null,
  remainingTrialDays: null,
  pastDue: false, cancelled: false, suspended: false, paused: false,
  inGracePeriod: false, inTrial: false, active: true,
};

function daysBetween(iso: string | null): number | null {
  if (!iso) return null;
  const timestamp = Date.parse(iso);
  if (!Number.isFinite(timestamp)) return null;
  const ms = timestamp - Date.now();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

function isFutureDate(iso: string | null): boolean {
  if (!iso) return false;
  const timestamp = Date.parse(iso);
  return Number.isFinite(timestamp) && timestamp > Date.now();
}

export function useSubscriptionStatus(): SubscriptionStatus {
  const { tenantId, isSuperAdmin } = useAuth();
  const [state, setState] = useState(initial);
  const channelIdRef = useRef(`tenant-sub-${Math.random().toString(36).slice(2)}`);

  const load = useCallback(async () => {
    if (!tenantId) { setState({ ...initial, loading: false }); return; }
    if (isSuperAdmin) {
      setState({ ...initial, loading: false, status: 'active', planName: 'Super Admin', planSlug: 'admin' });
      return;
    }
    try {
      const { data: t, error: tenantError } = await supabase
        .from('tenants')
        .select('subscription_status, subscription_ends_at, trial_expires_at, past_due_since, grace_until, is_suspended, is_paused, subscription_plan_id')
        .eq('id', tenantId)
        .maybeSingle();
      if (tenantError) {
        console.error('[useSubscriptionStatus] tenants query failed', tenantError);
        setState({ ...initial, loading: false });
        return;
      }
      if (!t) { setState({ ...initial, loading: false }); return; }
      let planName: string | null = null; let planSlug: string | null = null;
      if (t.subscription_plan_id) {
        const { data: p, error: planError } = await supabase
          .from('subscription_plans').select('name, slug').eq('id', t.subscription_plan_id).maybeSingle();
        if (planError) console.error('[useSubscriptionStatus] subscription_plans query failed', planError);
        planName = p?.name ?? null; planSlug = p?.slug ?? null;
      }
      const status = (t.subscription_status as string | null) ?? null;
      const pastDue = !!t.past_due_since || status === 'past_due';
      const cancelled = status === 'cancelled' || status === 'expired';
      const suspended = !!t.is_suspended || status === 'suspended';
      const paused = !!t.is_paused;
      const inGracePeriod = isFutureDate(t.grace_until);
      const inTrial = status === 'trial';
      const remainingTrialDays = inTrial ? daysBetween(t.trial_expires_at) : null;
      const active = !suspended && !cancelled && (!pastDue || inGracePeriod);

      setState({
        loading: false,
        status, planName, planSlug,
        trialEnd: t.trial_expires_at, renewalDate: t.subscription_ends_at,
        pastDueSince: t.past_due_since, graceUntil: t.grace_until,
        remainingTrialDays,
        pastDue, cancelled, suspended, paused, inGracePeriod, inTrial, active,
      });
    } catch (e) {
      console.warn('[useSubscriptionStatus]', e);
      setState({ ...initial, loading: false });
    }
  }, [tenantId, isSuperAdmin]);

  useEffect(() => { load(); }, [load]);

  // Realtime: refresh when the tenant row changes
  useEffect(() => {
    if (!tenantId) return;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    try {
      channel = supabase
        .channel(`${channelIdRef.current}-${tenantId}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tenants', filter: `id=eq.${tenantId}` }, () => { load(); })
        .subscribe();
    } catch (error) {
      console.error('[useSubscriptionStatus] realtime subscription failed', error);
    }
    return () => { if (channel) supabase.removeChannel(channel); };
  }, [tenantId, load]);

  return { ...state, refresh: load };
}
