import { useEffect, useState } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';
import { Loader2, Sparkles, RefreshCw, Database, FileText, Users, AlertTriangle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

type Progress = {
  tenant_id: string;
  total_jobs: number;
  structured_jobs: number;
  missing_jobs: number;
  total_candidates: number;
  structured_candidates: number;
  missing_candidates: number;
};

type Run = {
  id: string;
  scope: string;
  status: string;
  total: number;
  succeeded: number;
  failed: number;
  error: string | null;
  started_at: string;
  completed_at: string | null;
  details: any;
};

export default function AdminBackfillPage() {
  const { tenantId } = useAuth();
  const [progress, setProgress] = useState<Progress | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState<string | null>(null);

  async function load() {
    if (!tenantId) return;
    setLoading(true);
    const [{ data: p }, { data: r }] = await Promise.all([
      supabase.from('structuring_backfill_progress' as any).select('*').eq('tenant_id', tenantId).maybeSingle(),
      supabase.from('structuring_backfill_runs').select('*').eq('tenant_id', tenantId).order('started_at', { ascending: false }).limit(10),
    ]);
    setProgress((p as any) ?? null);
    setRuns((r as any[]) ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, [tenantId]);

  async function runBackfill(scope: 'jobs' | 'candidates' | 'both') {
    setRunning(scope);
    try {
      const { data, error } = await supabase.functions.invoke('backfill-structuring', {
        body: { scope, limit: 50, force: false, only_open: true },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success(`Backfill complete — jobs ${(data as any).jobs.succeeded}/${(data as any).jobs.total}, candidates ${(data as any).candidates.succeeded}/${(data as any).candidates.total}`);
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? 'Backfill failed');
    } finally {
      setRunning(null);
    }
  }

  const pctJobs = progress && progress.total_jobs > 0
    ? Math.round((progress.structured_jobs / progress.total_jobs) * 100) : 0;
  const pctCands = progress && progress.total_candidates > 0
    ? Math.round((progress.structured_candidates / progress.total_candidates) * 100) : 0;

  return (
    <AdminLayout title="AI Structuring Backfill">
      <div className="space-y-6 p-6">
        <header className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-accent" /> AI Structuring Backfill
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Populate <code>structured_jd</code> and <code>structured_profile</code> so the
              Role-First Validator (v2.1) can score function_family and role_similarity.
              Each batch processes up to 50 records.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading} className="gap-2">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <MetricCard
            icon={<FileText className="w-5 h-5" />}
            title="Jobs"
            total={progress?.total_jobs ?? 0}
            structured={progress?.structured_jobs ?? 0}
            missing={progress?.missing_jobs ?? 0}
            pct={pctJobs}
            cta={
              <Button size="sm" disabled={!!running} onClick={() => runBackfill('jobs')} className="gap-2">
                {running === 'jobs' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Database className="w-3.5 h-3.5" />}
                Backfill jobs (open/draft)
              </Button>
            }
          />
          <MetricCard
            icon={<Users className="w-5 h-5" />}
            title="Candidates"
            total={progress?.total_candidates ?? 0}
            structured={progress?.structured_candidates ?? 0}
            missing={progress?.missing_candidates ?? 0}
            pct={pctCands}
            cta={
              <Button size="sm" disabled={!!running} onClick={() => runBackfill('candidates')} className="gap-2">
                {running === 'candidates' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Database className="w-3.5 h-3.5" />}
                Backfill candidates
              </Button>
            }
          />
        </div>

        <Card className="p-4">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <h2 className="font-semibold">Run everything</h2>
              <p className="text-xs text-muted-foreground">
                Process jobs first, then candidates. Run repeatedly until "missing" is 0 — each call processes 50 records.
              </p>
            </div>
            <Button disabled={!!running} onClick={() => runBackfill('both')} className="gap-2">
              {running === 'both' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              Run combined batch
            </Button>
          </div>
        </Card>

        <Card className="p-4">
          <h2 className="font-semibold mb-3">Recent runs</h2>
          {runs.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">No backfill runs yet.</p>
          ) : (
            <div className="divide-y divide-border">
              {runs.map((r) => (
                <div key={r.id} className="py-3 flex items-start justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline">{r.scope}</Badge>
                      <Badge className={
                        r.status === 'success' ? 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30'
                          : r.status === 'partial' ? 'bg-amber-500/10 text-amber-700 border-amber-500/30'
                          : r.status === 'failed' ? 'bg-destructive/10 text-destructive border-destructive/30'
                          : 'bg-muted text-muted-foreground'
                      } variant="outline">{r.status}</Badge>
                      <span className="text-muted-foreground text-xs">
                        {formatDistanceToNow(new Date(r.started_at), { addSuffix: true })}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      total {r.total} · succeeded {r.succeeded} · failed {r.failed}
                      {r.details?.jobs ? ` · jobs ${r.details.jobs.ok}/${r.details.jobs.total}` : ''}
                      {r.details?.candidates ? ` · candidates ${r.details.candidates.ok}/${r.details.candidates.total}` : ''}
                    </div>
                    {r.error && (
                      <div className="flex items-start gap-1.5 mt-1 text-xs text-destructive">
                        <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                        <span className="break-all">{r.error.slice(0, 240)}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </AdminLayout>
  );
}

function MetricCard({ icon, title, total, structured, missing, pct, cta }: {
  icon: React.ReactNode; title: string; total: number; structured: number; missing: number; pct: number; cta: React.ReactNode;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-md bg-accent/10 flex items-center justify-center text-accent">{icon}</div>
        <h3 className="font-semibold">{title}</h3>
        <Badge variant="outline" className="ml-auto">{pct}% structured</Badge>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center mb-3">
        <Stat label="Total" value={total} />
        <Stat label="Structured" value={structured} tone="ok" />
        <Stat label="Missing" value={missing} tone={missing > 0 ? 'warn' : 'ok'} />
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden mb-3">
        <div className="h-full bg-accent transition-all" style={{ width: `${pct}%` }} />
      </div>
      {cta}
    </Card>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: 'ok' | 'warn' }) {
  return (
    <div>
      <div className={`text-2xl font-semibold ${tone === 'warn' ? 'text-amber-700' : tone === 'ok' ? 'text-emerald-700' : 'text-foreground'}`}>{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
    </div>
  );
}
