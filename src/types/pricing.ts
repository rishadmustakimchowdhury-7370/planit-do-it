// Shared pricing types — mirror get_public_pricing() RPC output.

export interface PricingPlan {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price_monthly: number;
  price_yearly: number | null;
  yearly_discount_percentage: number | null;
  currency: string;
  stripe_price_id_monthly: string | null;
  stripe_price_id_yearly: string | null;
  monthly_trial_days: number | null;
  yearly_trial_days: number | null;
  badge: string | null;
  button_text: string | null;
  button_url: string | null;
  sort_order: number | null;
  highlighted: boolean;
  active: boolean;
  popular: boolean;
  enterprise: boolean;
  icon: string | null;
  color: string | null;
  // Legacy per-plan limit columns still used by some enforcement paths
  max_jobs: number | null;
  max_candidates: number | null;
  max_users: number | null;
  match_credits_monthly: number | null;
}

export interface PricingCatalogFeature {
  id: string;
  category: string | null;
  feature_key: string;
  display_name: string;
  description: string | null;
  icon: string | null;
  default_limit: number | null;
  unit: string | null;
  is_ai: boolean;
  sort_order: number;
}

export interface PlanFeature {
  plan_id: string;
  feature_id: string;
  enabled: boolean;
  unlimited: boolean;
  monthly_limit: number | null;
  yearly_limit: number | null;
  display_order: number;
  custom_label: string | null;
}

export interface PricingCatalog {
  plans: PricingPlan[];
  features: PricingCatalogFeature[];
  plan_features: PlanFeature[];
}

export type BillingInterval = 'monthly' | 'yearly';

/** Resolve limit for a (plan, feature, interval) tuple. `null` means unlimited. */
export function resolvePlanFeatureLimit(
  planFeature: PlanFeature | undefined,
  catalog: PricingCatalogFeature | undefined,
  interval: BillingInterval,
): number | null {
  if (!planFeature || !planFeature.enabled) return 0;
  if (planFeature.unlimited) return null;
  const seg = interval === 'yearly' ? planFeature.yearly_limit : planFeature.monthly_limit;
  if (seg != null) return seg;
  if (catalog?.default_limit != null) return catalog.default_limit;
  return null;
}

export function formatLimit(value: number | null, unit: string | null | undefined): string {
  if (value === null) return 'Unlimited';
  const n = value.toLocaleString();
  return unit ? `${n} ${unit}` : n;
}

export function formatPrice(amount: number, currency: string): string {
  const cur = (currency || 'USD').toUpperCase();
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: cur,
      maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
    }).format(amount);
  } catch {
    return `${cur} ${amount}`;
  }
}
