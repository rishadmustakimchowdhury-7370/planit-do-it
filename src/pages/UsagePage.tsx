import { useEffect, useMemo, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { useFeatureUsageBatch } from '@/hooks/useFeatureUsage';
import { FEATURE_LABELS } from '@/lib/entitlements';
import { useNavigate } from 'react-router-dom';
import {
  Users, Briefcase, UserCheck, Sparkles, Search, FileText, Mail, Database,
  Building2, Brain, ScanLine, FileSpreadsheet, Plug, ArrowUpRight,
} from 'lucide-react';

const SECTIONS: Array<{
  title: string;
  features: Array<{ key: string; label?: string; icon: any }>;
}> = [
  {
    title: 'Workspace',
    features: [
      { key: 'team_members', label: 'Team Members', icon: Users },
      { key: 'active_jobs', label: 'Active Jobs', icon: Briefcase },
      { key: 'candidates', label: 'Candidates', icon: UserCheck },
      { key: 'clients', label: 'Clients', icon: Building2 },
      { key: 'storage_gb', label: 'Storage (GB)', icon: Database },
    ],
  },
  {
    title: 'AI & Discovery (this month)',
    features: [
      { key: 'ai_candidate_discovery', icon: Sparkles },
      { key: 'ai_prospect_search', icon: Search },
      { key: 'open_web_discovery', icon: Search },
      { key: 'ai_matching', icon: Brain },
      { key: 'resume_parsing', icon: ScanLine },
      { key: 'executive_assessment', icon: FileText },
      { key: 'ai_email_generation', icon: Mail },
    ],
  },
  {
    title: 'Productivity',
    features: [
      { key: 'csv_import', label: 'CSV Imports', icon: FileSpreadsheet },
      { key: 'csv_export', label: 'CSV Exports', icon: FileSpreadsheet },
      { key: 'bulk_import', label: 'Bulk Imports', icon: FileSpreadsheet },
      { key: 'reports', label: 'Reports', icon: FileText },
      { key: 'api_access', label: 'API Connections', icon: Plug },
    ],
  },
];

const ALL_KEYS = SECTIONS.flatMap(s => s.features.map(f => f.key));

interface PlanInfo {
  name: string;
  price_monthly: number | null;
  currency: string | null;
  current_period_end: string | null;
  status: string | null;
}

export default function UsagePage() {
  const { tenantId } = useAuth() as any;
  const navigate = useNavigate();
  const { data, loading, refresh } = useFeatureUsageBatch(ALL_KEYS);
  const [plan, setPlan] = useState<PlanInfo | null>(null);

  useEffect(() => {
    if (!tenantId) return;
    (async () => {
      const { data: trow } = await supabase
        .from('tenants')
        .select('subscription_plan_id, subscription_status, current_period_end')
        .eq('id', tenantId)
        .maybeSingle();
      const t: any = trow;
      let p: any = null;
      if (t?.subscription_plan_id) {
        const { data: prow } = await supabase
          .from('subscription_plans')
          .select('name, price_monthly, currency')
          .eq('id', t.subscription_plan_id)
          .maybeSingle();
        p = prow;
      }
      setPlan({
        name: p?.name ?? 'Free',
        price_monthly: p?.price_monthly ?? null,
        currency: p?.currency ?? 'USD',
        current_period_end: t?.current_period_end ?? null,
        status: t?.subscription_status ?? null,
      });
    })();
  }, [tenantId]);

  // Realtime refresh when counters change
  useEffect(() => {
    if (!tenantId) return;
    const ch = supabase
      .channel(`usage-${tenantId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'subscription_usage_counters', filter: `tenant_id=eq.${tenantId}` },
        () => { void refresh(); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [tenantId, refresh]);

  const hasWarnings = useMemo(() => Object.values(data).some(d => !d.unlimited && d.percent >= 80), [data]);

  return (
    <AppLayout title="Workspace Usage" subtitle="Live view of your plan limits and usage">
      <div className="space-y-6">
        {/* Plan summary */}
        <Card>
          <CardContent className="p-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-semibold">{plan?.name ?? 'Free'} plan</h2>
                {plan?.status && (
                  <Badge variant={plan.status === 'active' || plan.status === 'trialing' ? 'default' : 'secondary'}>
                    {plan.status}
                  </Badge>
                )}
                {hasWarnings && <Badge variant="destructive">Approaching limits</Badge>}
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {plan?.price_monthly != null
                  ? `${plan.currency ?? 'USD'} $${plan.price_monthly}/month`
                  : 'Free workspace'}
                {plan?.current_period_end &&
                  ` · Renews ${new Date(plan.current_period_end).toLocaleDateString()}`}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => navigate('/billing')}>Manage billing</Button>
              <Button onClick={() => navigate('/billing')} className="gap-1.5">
                Upgrade <ArrowUpRight className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {SECTIONS.map(section => (
          <Card key={section.title}>
            <CardHeader>
              <CardTitle className="text-base">{section.title}</CardTitle>
              <CardDescription>Live counters across your workspace</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {section.features.map(f => {
                  const Icon = f.icon;
                  const u = data[f.key];
                  const label = f.label ?? FEATURE_LABELS[f.key] ?? f.key;
                  if (loading && !u) {
                    return <Skeleton key={f.key} className="h-24" />;
                  }
                  if (!u || !u.enabled) {
                    return (
                      <div key={f.key} className="rounded-lg border p-4 bg-muted/30">
                        <div className="flex items-center gap-2 mb-2">
                          <Icon className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm font-medium">{label}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">Not included on current plan</p>
                        <Button variant="link" size="sm" className="px-0 h-auto" onClick={() => navigate('/billing')}>
                          Upgrade to unlock
                        </Button>
                      </div>
                    );
                  }
                  const limit = u.unlimited ? '∞' : u.limit ?? '∞';
                  const warn = !u.unlimited && u.percent >= 80;
                  const block = !u.unlimited && u.percent >= 100;
                  return (
                    <div key={f.key} className={`rounded-lg border p-4 ${block ? 'border-destructive/40 bg-destructive/5' : warn ? 'border-amber-500/30 bg-amber-50/40 dark:bg-amber-950/20' : ''}`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Icon className="w-4 h-4 text-primary" />
                          <span className="text-sm font-medium">{label}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">{u.usage} / {limit}</span>
                      </div>
                      {!u.unlimited && <Progress value={Math.min(100, u.percent)} className="h-2" />}
                      {block && <p className="text-xs text-destructive mt-2">Limit reached. Upgrade to continue.</p>}
                      {warn && !block && <p className="text-xs text-amber-700 dark:text-amber-400 mt-2">{Math.round(u.percent)}% used</p>}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </AppLayout>
  );
}
