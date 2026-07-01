// Single source of truth for pricing data across homepage, billing, checkout, and upgrade dialogs.
// Reads `get_public_pricing()` RPC and stays live via realtime channels on the three source tables.
import { useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type {
  BillingInterval,
  PlanFeature,
  PricingCatalog,
  PricingCatalogFeature,
  PricingPlan,
} from '@/types/pricing';
import { resolvePlanFeatureLimit } from '@/types/pricing';

export const PRICING_CATALOG_KEY = ['pricing-catalog'] as const;

const EMPTY_CATALOG: PricingCatalog = { plans: [], features: [], plan_features: [] };

async function fetchCatalog(): Promise<PricingCatalog> {
  const { data, error } = await supabase.rpc('get_public_pricing');
  if (error) {
    console.error('[usePricingCatalog] RPC failed', error);
    return EMPTY_CATALOG;
  }
  const payload = (data ?? {}) as Partial<PricingCatalog>;
  return {
    plans: Array.isArray(payload.plans) ? (payload.plans as PricingPlan[]) : [],
    features: Array.isArray(payload.features) ? (payload.features as PricingCatalogFeature[]) : [],
    plan_features: Array.isArray(payload.plan_features)
      ? (payload.plan_features as PlanFeature[])
      : [],
  };
}

export function usePricingCatalog() {
  const queryClient = useQueryClient();
  const { data, isLoading, refetch } = useQuery({
    queryKey: PRICING_CATALOG_KEY,
    queryFn: fetchCatalog,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
  });

  useEffect(() => {
    const channel = supabase
      .channel(`pricing-catalog-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'subscription_plans' }, () =>
        queryClient.invalidateQueries({ queryKey: PRICING_CATALOG_KEY }),
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'subscription_features' }, () =>
        queryClient.invalidateQueries({ queryKey: PRICING_CATALOG_KEY }),
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'subscription_plan_features' }, () =>
        queryClient.invalidateQueries({ queryKey: PRICING_CATALOG_KEY }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const catalog = data ?? EMPTY_CATALOG;

  const api = useMemo(() => {
    const featureById = new Map(catalog.features.map(f => [f.id, f]));
    const planById = new Map(catalog.plans.map(p => [p.id, p]));
    const planBySlug = new Map(catalog.plans.map(p => [p.slug, p]));

    const planFeaturesByPlan = new Map<string, PlanFeature[]>();
    for (const pf of catalog.plan_features) {
      if (!planFeaturesByPlan.has(pf.plan_id)) planFeaturesByPlan.set(pf.plan_id, []);
      planFeaturesByPlan.get(pf.plan_id)!.push(pf);
    }

    const getFeaturesForPlan = (planId: string) =>
      (planFeaturesByPlan.get(planId) ?? [])
        .filter(pf => pf.enabled)
        .map(pf => ({ pf, feature: featureById.get(pf.feature_id) }))
        .filter((r): r is { pf: PlanFeature; feature: PricingCatalogFeature } => !!r.feature)
        .sort((a, b) => {
          if (a.pf.display_order !== b.pf.display_order) return a.pf.display_order - b.pf.display_order;
          return a.feature.sort_order - b.feature.sort_order;
        });

    const getLimitForPlan = (
      planId: string,
      featureKey: string,
      interval: BillingInterval,
    ): number | null => {
      const feature = catalog.features.find(f => f.feature_key === featureKey);
      if (!feature) return null;
      const pf = catalog.plan_features.find(x => x.plan_id === planId && x.feature_id === feature.id);
      return resolvePlanFeatureLimit(pf, feature, interval);
    };

    return {
      getPlanById: (id: string) => planById.get(id),
      getPlanBySlug: (slug: string) => planBySlug.get(slug),
      getFeaturesForPlan,
      getLimitForPlan,
    };
  }, [catalog]);

  return {
    plans: catalog.plans,
    features: catalog.features,
    planFeatures: catalog.plan_features,
    hasYearlyPricing: catalog.plans.some(p => p.price_yearly != null && p.price_yearly > 0),
    isLoading,
    refetch,
    ...api,
  };
}
