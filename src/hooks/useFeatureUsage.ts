import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';

export interface FeatureUsage {
  enabled: boolean;
  unlimited: boolean;
  limit: number | null;
  usage: number;
  remaining: number | null;
  percent: number;
}

/**
 * Live entitlement + usage snapshot for one feature key.
 * Reads from public.get_tenant_feature(tenant_id, feature_key).
 */
export function useFeatureUsage(featureKey: string | null): {
  data: FeatureUsage | null;
  loading: boolean;
  refresh: () => Promise<void>;
} {
  const { profile } = useAuth() as any;
  const tenantId: string | null = profile?.tenant_id ?? null;
  const [data, setData] = useState<FeatureUsage | null>(null);
  const [loading, setLoading] = useState(true);

  const fetcher = useCallback(async () => {
    if (!tenantId || !featureKey) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data: row, error } = await supabase.rpc('get_tenant_feature', {
      _tenant_id: tenantId,
      _feature_key: featureKey,
    });
    if (error || !row) {
      setData(null);
    } else {
      const r = row as any;
      const limit = r.limit ?? null;
      const usage = r.usage ?? 0;
      const unlimited = !!r.unlimited;
      const remaining = unlimited || limit == null ? null : Math.max(0, limit - usage);
      const percent = unlimited || !limit ? 0 : Math.min(100, (usage / limit) * 100);
      setData({
        enabled: !!r.enabled,
        unlimited,
        limit,
        usage,
        remaining,
        percent,
      });
    }
    setLoading(false);
  }, [tenantId, featureKey]);

  useEffect(() => { fetcher(); }, [fetcher]);

  return { data, loading, refresh: fetcher };
}

/** Fetches usage for multiple feature keys at once. */
export function useFeatureUsageBatch(featureKeys: string[]): {
  data: Record<string, FeatureUsage>;
  loading: boolean;
  refresh: () => Promise<void>;
} {
  const { profile } = useAuth() as any;
  const tenantId: string | null = profile?.tenant_id ?? null;
  const [data, setData] = useState<Record<string, FeatureUsage>>({});
  const [loading, setLoading] = useState(true);

  const fetcher = useCallback(async () => {
    if (!tenantId || featureKeys.length === 0) {
      setData({});
      setLoading(false);
      return;
    }
    setLoading(true);
    const results = await Promise.all(featureKeys.map(async (k) => {
      const { data: row, error } = await supabase.rpc('get_tenant_feature', {
        _tenant_id: tenantId, _feature_key: k,
      });
      if (error || !row) return [k, null] as const;
      const r = row as any;
      const limit = r.limit ?? null;
      const usage = r.usage ?? 0;
      const unlimited = !!r.unlimited;
      const remaining = unlimited || limit == null ? null : Math.max(0, limit - usage);
      const percent = unlimited || !limit ? 0 : Math.min(100, (usage / limit) * 100);
      return [k, {
        enabled: !!r.enabled,
        unlimited, limit, usage, remaining, percent,
      } as FeatureUsage] as const;
    }));
    const map: Record<string, FeatureUsage> = {};
    for (const [k, v] of results) if (v) map[k] = v;
    setData(map);
    setLoading(false);
    // featureKeys serialized for stable deps
  }, [tenantId, featureKeys.join('|')]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetcher(); }, [fetcher]);

  return { data, loading, refresh: fetcher };
}
