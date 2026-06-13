import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const METERS: Array<{ key: string; label: string }> = [
  { key: 'active_jobs', label: 'Active Jobs' },
  { key: 'candidates', label: 'Candidates' },
  { key: 'team_members', label: 'Team Members' },
  { key: 'ai_matches_monthly', label: 'AI Matches (this month)' },
];

interface Row { feature_key: string; enabled: boolean; limit: number | null; usage: number; remaining: number; unlimited: boolean; }

export function UsageMetersCard() {
  const { tenantId, isSuperAdmin } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!tenantId) return;
    (async () => {
      setLoading(true);
      const results = await Promise.all(
        METERS.map(m => supabase.rpc('get_tenant_feature', { _tenant_id: tenantId, _feature_key: m.key })),
      );
      setRows(results.map((r, i) => ((r.data as unknown) as Row) ?? { feature_key: METERS[i].key, enabled: false, limit: 0, usage: 0, remaining: 0, unlimited: false }));
      setLoading(false);
    })();
  }, [tenantId]);

  if (isSuperAdmin) return null;

  return (
    <Card>
      <CardHeader><CardTitle>Plan Usage</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : rows.map((r, i) => {
          const meter = METERS[i];
          const pct = r.unlimited || !r.limit ? 0 : Math.min(100, Math.round((r.usage / r.limit) * 100));
          const limitLabel = r.unlimited ? 'Unlimited' : r.limit;
          return (
            <div key={meter.key} className="space-y-1">
              <div className="flex justify-between text-sm">
                <span>{meter.label}</span>
                <span className="text-muted-foreground">{r.usage} / {limitLabel}</span>
              </div>
              {!r.unlimited && <Progress value={pct} />}
              {!r.unlimited && pct >= 80 && (
                <div className="flex justify-end">
                  <Button variant="link" size="sm" className="h-auto p-0" onClick={() => navigate('/billing')}>
                    {pct >= 100 ? 'Limit reached — Upgrade' : 'Approaching limit — Upgrade'}
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
