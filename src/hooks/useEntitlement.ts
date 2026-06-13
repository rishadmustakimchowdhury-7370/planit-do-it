import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';

export interface Entitlement {
  feature_key: string;
  enabled: boolean;
  limit: number | null;
  usage: number;
  remaining: number; // -1 means unlimited
  unlimited: boolean;
}

export function useEntitlement(featureKey: string | null) {
  const { tenantId, isSuperAdmin } = useAuth();
  const [data, setData] = useState<Entitlement | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!tenantId || !featureKey) { setLoading(false); return; }
    if (isSuperAdmin) {
      setData({ feature_key: featureKey, enabled: true, limit: null, usage: 0, remaining: -1, unlimited: true });
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data: row, error } = await supabase.rpc('get_tenant_feature', {
      _tenant_id: tenantId,
      _feature_key: featureKey,
    });
    if (!error && row) setData((row as unknown) as Entitlement);
    setLoading(false);
  }, [tenantId, featureKey, isSuperAdmin]);

  useEffect(() => { refresh(); }, [refresh]);

  const canUse = !!data && data.enabled && (data.unlimited || data.remaining > 0);
  return { entitlement: data, loading, refresh, canUse };
}
