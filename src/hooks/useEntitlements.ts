import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';

export interface EntitlementInfo {
  enabled: boolean;
  unlimited: boolean;
  limit: number | null;
  usage: number;
}

/**
 * Batch-fetch multiple entitlements for the current tenant.
 * Returns a map of featureKey -> EntitlementInfo (or null while loading).
 * Super admins are always enabled.
 */
export function useEntitlements(featureKeys: string[]) {
  const { tenantId, isSuperAdmin } = useAuth();
  const [map, setMap] = useState<Record<string, EntitlementInfo>>({});
  const [loading, setLoading] = useState(true);
  const key = featureKeys.join(',');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (isSuperAdmin) {
        const m: Record<string, EntitlementInfo> = {};
        featureKeys.forEach(k => { m[k] = { enabled: true, unlimited: true, limit: null, usage: 0 }; });
        if (!cancelled) { setMap(m); setLoading(false); }
        return;
      }
      if (!tenantId) { setLoading(false); return; }
      setLoading(true);
      const results = await Promise.all(featureKeys.map(async k => {
        const { data } = await supabase.rpc('get_tenant_feature', { _tenant_id: tenantId, _feature_key: k });
        return [k, data] as const;
      }));
      if (cancelled) return;
      const m: Record<string, EntitlementInfo> = {};
      results.forEach(([k, data]) => {
        const d = data as any;
        m[k] = {
          enabled: !!d?.enabled,
          unlimited: !!d?.unlimited,
          limit: d?.limit ?? null,
          usage: d?.usage ?? 0,
        };
      });
      setMap(m);
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, isSuperAdmin, key]);

  return { entitlements: map, loading };
}
