import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Check, X, Star, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Feature {
  id: string;
  feature_key: string;
  feature_name: string;
  category: string | null;
  sort_order: number;
}
interface Plan { id: string; name: string; slug: string; price_monthly: number; }
interface Mapping { plan_id: string; feature_id: string; enabled: boolean; limit_value: number | null; }

const CATEGORY_ORDER: { key: string; label: string }[] = [
  { key: 'recruitment_core', label: 'Recruitment Core' },
  { key: 'client_submission', label: 'Client Submission' },
  { key: 'placement_management', label: 'Placement Management' },
  { key: 'team_management', label: 'Team Management' },
  { key: 'finance', label: 'Finance' },
  { key: 'communication', label: 'Communication' },
  { key: 'analytics', label: 'Analytics & Add-ons' },
  { key: 'limits', label: 'Usage Limits' },
];

const PREMIUM_KEYS = new Set([
  'client_submission_reports',
  'recruiter_performance_dashboard',
  'finance_dashboard',
  'invoice_management',
  'recruiter_bonus_tracking',
]);

const LIMIT_KEYS = new Set(['active_jobs', 'candidates', 'team_members', 'ai_matches_monthly']);

function formatLimit(featureKey: string, m: Mapping | undefined): React.ReactNode {
  if (!m || !m.enabled) return <X className="h-4 w-4 text-muted-foreground/50 mx-auto" />;
  if (LIMIT_KEYS.has(featureKey)) {
    if (m.limit_value == null) return <span className="font-semibold">Unlimited</span>;
    return <span className="font-semibold">{m.limit_value.toLocaleString()}</span>;
  }
  return <Check className="h-4 w-4 text-primary mx-auto" />;
}

export function PricingComparisonMatrix() {
  const [features, setFeatures] = useState<Feature[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [matrix, setMatrix] = useState<Record<string, Mapping>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [f, p, m] = await Promise.all([
        supabase.from('subscription_features').select('id,feature_key,feature_name,category,sort_order').eq('is_archived', false).order('sort_order'),
        supabase.from('subscription_plans').select('id,name,slug,price_monthly').eq('is_active', true).order('price_monthly'),
        supabase.from('subscription_plan_features').select('plan_id,feature_id,enabled,limit_value'),
      ]);
      if (cancelled) return;
      setFeatures((f.data ?? []) as Feature[]);
      setPlans((p.data ?? []) as Plan[]);
      const map: Record<string, Mapping> = {};
      ((m.data ?? []) as Mapping[]).forEach(r => { map[`${r.plan_id}:${r.feature_id}`] = r; });
      setMatrix(map);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  // Group features by category
  const byCategory = new Map<string, Feature[]>();
  features.forEach(f => {
    const k = f.category ?? 'other';
    if (!byCategory.has(k)) byCategory.set(k, []);
    byCategory.get(k)!.push(f);
  });

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="text-left p-4 min-w-[260px] font-semibold">Feature</th>
              {plans.map((p, i) => (
                <th key={p.id} className="text-center p-4 min-w-[140px]">
                  <div className="flex items-center justify-center gap-1.5 font-bold text-base">
                    {p.name}
                    {i === 1 && <Star className="h-3.5 w-3.5 fill-primary text-primary" />}
                  </div>
                  <div className="text-xs text-muted-foreground font-normal">${Number(p.price_monthly)}/mo</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {CATEGORY_ORDER.map(cat => {
              const rows = byCategory.get(cat.key) ?? [];
              if (rows.length === 0) return null;
              return (
                <React.Fragment key={cat.key}>
                  <tr className="bg-muted/20 border-t border-border">
                    <td colSpan={plans.length + 1} className="p-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      {cat.label}
                    </td>
                  </tr>
                  {rows.map(f => {
                    const premium = PREMIUM_KEYS.has(f.feature_key);
                    return (
                      <tr key={f.id} className="border-t border-border/60">
                        <td className="p-3">
                          <span className={cn('font-medium', premium && 'text-primary')}>{f.feature_name}</span>
                          {premium && (
                            <span className="ml-2 align-middle inline-flex items-center rounded-full bg-primary/10 text-primary text-[10px] font-semibold px-2 py-0.5">
                              Premium
                            </span>
                          )}
                        </td>
                        {plans.map(p => (
                          <td key={p.id} className="p-3 text-center">
                            {formatLimit(f.feature_key, matrix[`${p.id}:${f.id}`])}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
