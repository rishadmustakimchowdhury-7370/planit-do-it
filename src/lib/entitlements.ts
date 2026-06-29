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
  users: 'Users',
  candidates: 'Candidates',
  clients: 'Clients',
  active_jobs: 'Jobs',
  storage_gb: 'Storage (GB)',
  team_members: 'team members',
  ai_candidate_discovery: 'AI Candidate Discovery',
  ai_prospect_search: 'AI Prospect Search',
  ai_matching: 'AI Candidate Matching',
  ai_matches_monthly: 'AI matches this month',
  open_web_discovery: 'Open Web Discovery',
  resume_parsing: 'Resume Parsing',
  executive_assessment: 'AI Executive Assessment',
  ai_email_generation: 'AI Email Generation',
  candidate_crm: 'Candidate CRM',
  client_crm: 'Client CRM',
  jobs_module: 'Jobs',
  pipeline: 'Pipeline',
  placements: 'Placements',
  finance: 'Finance',
  invoices: 'Invoices',
  reports: 'Reports',
  calendar: 'Calendar',
  email_integration: 'Email Integration',
  csv_import: 'CSV Import',
  csv_export: 'CSV Export',
  chrome_extension: 'Chrome Extension',
  team_dashboard: 'Team Dashboard',
  recruiter_bonuses: 'Recruiter Bonuses',
  work_tracking: 'Work Tracking',
  advanced_reports: 'Advanced Reports',
  bulk_import: 'Bulk Import',
  bulk_export: 'Bulk Export',
  api_access: 'API Access',
  white_label: 'White Label',
  custom_branding: 'Custom Branding',
  audit_logs: 'Audit Logs',
  advanced_permissions: 'Advanced Permissions',
  priority_support: 'Priority Support',
  finance_dashboard: 'Finance Dashboard',
  invoice_management: 'Invoice Management',
  recruiter_bonus_tracking: 'Recruiter Bonus Tracking',
  advanced_analytics: 'Advanced Analytics',
};
