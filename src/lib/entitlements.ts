import { supabase } from '@/integrations/supabase/client';

export class EntitlementError extends Error {
  featureKey: string;
  constructor(featureKey: string, message?: string) {
    super(message ?? `FEATURE_LIMIT_EXCEEDED: ${featureKey}`);
    this.name = 'EntitlementError';
    this.featureKey = featureKey;
  }
}

/**
 * Parse a Postgres error to detect our entitlement enforcement signal.
 * Database triggers raise: 'FEATURE_LIMIT_EXCEEDED: <feature_key>'
 */
export function parseEntitlementError(err: unknown): EntitlementError | null {
  if (!err) return null;
  const msg = typeof err === 'string'
    ? err
    : (err as { message?: string }).message ?? '';
  const m = msg.match(/FEATURE_LIMIT_EXCEEDED:\s*([a-z0-9_]+)/i);
  if (!m) return null;
  return new EntitlementError(m[1], msg);
}

/**
 * Pre-check entitlement client-side. Throws EntitlementError if blocked.
 * The DB trigger is the source of truth — this is just for UX.
 */
export async function assertFeature(
  tenantId: string | null,
  featureKey: string,
  increment = 1,
): Promise<void> {
  if (!tenantId) throw new EntitlementError(featureKey, 'No tenant');
  const { data, error } = await supabase.rpc('get_tenant_feature', {
    _tenant_id: tenantId,
    _feature_key: featureKey,
  });
  if (error) return; // fail-open client-side; DB trigger will enforce
  const ent = data as {
    enabled?: boolean;
    unlimited?: boolean;
    limit?: number | null;
    usage?: number;
  } | null;
  if (!ent) return;
  if (!ent.enabled) throw new EntitlementError(featureKey, `Feature ${featureKey} disabled on current plan`);
  if (!ent.unlimited && ent.limit != null && (ent.usage ?? 0) + increment > ent.limit) {
    throw new EntitlementError(featureKey, `Plan limit reached for ${featureKey}`);
  }
}

export const FEATURE_LABELS: Record<string, string> = {
  active_jobs: 'active jobs',
  candidates: 'candidates',
  team_members: 'team members',
  ai_matches_monthly: 'AI matches this month',
  finance_dashboard: 'Finance Dashboard',
  invoice_management: 'Invoice Management',
  recruiter_bonus_tracking: 'Recruiter Bonus Tracking',
  api_access: 'API Access',
  advanced_analytics: 'Advanced Analytics',
  custom_branding: 'Custom Branding',
};
