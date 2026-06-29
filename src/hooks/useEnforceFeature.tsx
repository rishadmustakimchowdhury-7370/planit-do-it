import { useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { assertFeature, parseEntitlementError, EntitlementError } from '@/lib/entitlements';
import { UpgradeRequiredDialog } from '@/components/billing/UpgradeRequiredDialog';

/**
 * Hook that wraps an action with entitlement enforcement.
 * - `guard(key, fn)` pre-checks the limit, runs the action, and records usage for metered features.
 * - `recordUsage(key, amount)` manually increments a counter after a successful action.
 * - `handleError(err)` shows the upgrade dialog if the error is a DB-side LIMIT_EXCEEDED.
 */
export function useEnforceFeature() {
  const { tenantId, isSuperAdmin } = useAuth();
  const [blocked, setBlocked] = useState<string | null>(null);

  const recordUsage = useCallback(
    async (featureKey: string, amount = 1) => {
      if (!tenantId || isSuperAdmin) return;
      try {
        await supabase.rpc('increment_feature_usage', {
          _tenant_id: tenantId,
          _feature_key: featureKey,
          _amount: amount,
        });
      } catch {
        // best-effort: counters are not authoritative for blocking
      }
    },
    [tenantId, isSuperAdmin],
  );

  const guard = useCallback(
    async <T,>(
      featureKey: string,
      action: () => Promise<T>,
      opts: { increment?: number; meter?: boolean } = {},
    ): Promise<T | null> => {
      const { increment = 1, meter = true } = opts;
      if (isSuperAdmin) return await action();
      try {
        await assertFeature(tenantId, featureKey, increment);
      } catch (e) {
        if (e instanceof EntitlementError) {
          setBlocked(e.featureKey);
          return null;
        }
      }
      try {
        const result = await action();
        if (meter) void recordUsage(featureKey, increment);
        return result;
      } catch (e) {
        const ent = parseEntitlementError(e);
        if (ent) {
          setBlocked(ent.featureKey);
          return null;
        }
        throw e;
      }
    },
    [tenantId, isSuperAdmin, recordUsage],
  );

  const handleError = useCallback((err: unknown): boolean => {
    const ent = parseEntitlementError(err);
    if (ent) {
      setBlocked(ent.featureKey);
      return true;
    }
    return false;
  }, []);

  const showLimit = useCallback((featureKey: string) => setBlocked(featureKey), []);

  const dialog = (
    <UpgradeRequiredDialog
      open={!!blocked}
      onOpenChange={(o) => !o && setBlocked(null)}
      featureKey={blocked ?? 'active_jobs'}
    />
  );

  return { guard, handleError, recordUsage, showLimit, dialog, blocked };
}
