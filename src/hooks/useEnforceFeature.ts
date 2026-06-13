import { useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth';
import { assertFeature, parseEntitlementError, EntitlementError } from '@/lib/entitlements';
import { UpgradeRequiredDialog } from '@/components/billing/UpgradeRequiredDialog';

/**
 * Hook that wraps an action with entitlement enforcement.
 * Usage:
 *   const { guard, dialog } = useEnforceFeature();
 *   await guard('active_jobs', async () => { ...create... });
 *   {dialog}
 */
export function useEnforceFeature() {
  const { tenantId, isSuperAdmin } = useAuth();
  const [blocked, setBlocked] = useState<string | null>(null);

  const guard = useCallback(
    async <T,>(featureKey: string, action: () => Promise<T>, increment = 1): Promise<T | null> => {
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
        return await action();
      } catch (e) {
        const ent = parseEntitlementError(e);
        if (ent) {
          setBlocked(ent.featureKey);
          return null;
        }
        throw e;
      }
    },
    [tenantId, isSuperAdmin],
  );

  /** Handle an error from an action that already ran — show dialog if entitlement-related. Returns true if handled. */
  const handleError = useCallback((err: unknown): boolean => {
    const ent = parseEntitlementError(err);
    if (ent) {
      setBlocked(ent.featureKey);
      return true;
    }
    return false;
  }, []);

  const dialog = (
    <UpgradeRequiredDialog
      open={!!blocked}
      onOpenChange={(o) => !o && setBlocked(null)}
      featureKey={blocked ?? 'active_jobs'}
    />
  );

  return { guard, handleError, dialog, blocked };
}
