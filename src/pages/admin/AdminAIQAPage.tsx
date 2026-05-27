import { useState } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Play, ShieldCheck, AlertTriangle, CheckCircle2, XCircle, Activity } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';
import { Navigate } from 'react-router-dom';

type QAResult = {
  id: string; industry: string; label: string; scenario_type: string;
  expected: string; recommendation?: string; within?: boolean;
  inflation?: number; deflation?: number; isFalsePositive?: boolean;
  stable?: boolean; summary?: string; industryDetected?: string | null;
  mandatoryCount?: number; mandatoryMissing?: number;
  qa?: Record<string, number>;
  error?: string;
};

type QASummary = {
  total: number; correct: number; accuracy: number;
  inflated: number; deflated: number; falsePositives: number;
  unstable: number; stabilityRuns: number;
  avgEvidenceQuality: number; avgFunctionalOwnership: number;
  avgMandatoryCoverage: number; avgTransferabilityDiscipline: number;
  avgIndustryAlignment: number; avgAntiInflation: number;
  generatedAt: string;
};

const recColor = (r?: string) => {
  if (r === 'highly_recommended') return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30';
  if (r === 'recommended') return 'bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/30';
  if (r === 'moderate_fit') return 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30';
  if (r === 'limited_alignment') return 'bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30';
  return 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30';
};

export default function AdminAIQAPage() {
  const { isSuperAdmin } = useAuth();
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<QAResult[]>([]);
  const [summary, setSummary] = useState<QASummary | null>(null);
  const [runs, setRuns] = useState<number>(2);

  if (!isSuperAdmin) return <Navigate to="/dashboard" replace />;

  const run = async () => {
    setRunning(true);
    setResults([]);
    setSummary(null);
    try {
      const { data, error } = await supabase.functions.invoke('ai-qa-runner', {
        body: { stability_runs: runs },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setSummary(data.summary);
      setResults(data.results);
      toast.success(`QA complete — ${data.summary.correct}/${data.summary.total} within expected band`);
    } catch (e: any) {
      toast.error(e?.message ?? 'QA run failed');
    } finally {
      setRunning(false);
    }
  };

  const Metric = ({ label, value, tone = 'default' }: { label: string; value: string | number; tone?: 'good' | 'bad' | 'default' }) => (
    <div className="rounded-lg border bg-card p-4">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${tone === 'good' ? 'text-emerald-600' : tone === 'bad' ? 'text-rose-600' : ''}`}>{value}</div>
    </div>
  );

  return (
    <AdminLayout title="AI Validation QA">
      <div className="space-y-6 max-w-7xl">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <ShieldCheck className="w-6 h-6 text-primary" /> AI Validation QA Harness
            </h1>
            <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
              Internal recruiter-grade test suite. Runs synthetic JD + CV pairs across industries
              against the live validation engine and measures false positives, recommendation
              inflation, evidence quality, functional ownership and recommendation stability.
              Hidden from clients and recruiters.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={runs}
              onChange={(e) => setRuns(Number(e.target.value))}
              className="rounded-md border bg-background px-2 py-1.5 text-sm"
              disabled={running}
            >
              <option value={1}>1 run / scenario</option>
              <option value={2}>2 runs (stability)</option>
              <option value={3}>3 runs (strict)</option>
            </select>
            <Button onClick={run} disabled={running} className="gap-2">
              {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              Run QA suite
            </Button>
          </div>
        </div>

        {summary && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Metric label="Within Expected Band" value={`${summary.correct}/${summary.total}`} tone={summary.accuracy >= 0.8 ? 'good' : 'bad'} />
              <Metric label="False Positives" value={summary.falsePositives} tone={summary.falsePositives === 0 ? 'good' : 'bad'} />
              <Metric label="Inflated" value={summary.inflated} tone={summary.inflated === 0 ? 'good' : 'bad'} />
              <Metric label="Unstable" value={summary.unstable} tone={summary.unstable === 0 ? 'good' : 'bad'} />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
              <Metric label="Evidence Quality" value={summary.avgEvidenceQuality} />
              <Metric label="Functional Ownership" value={summary.avgFunctionalOwnership} />
              <Metric label="Mandatory Coverage" value={summary.avgMandatoryCoverage} />
              <Metric label="Transferability Discipline" value={summary.avgTransferabilityDiscipline} />
              <Metric label="Industry Alignment" value={summary.avgIndustryAlignment} />
              <Metric label="Anti-Inflation" value={summary.avgAntiInflation} />
            </div>
          </>
        )}

        {results.length > 0 && (
          <Card className="overflow-hidden">
            <div className="border-b px-5 py-3 flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" />
              <h2 className="font-semibold text-sm">Scenario results</h2>
            </div>
            <div className="divide-y">
              {results.map((r) => (
                <div key={r.id} className="px-5 py-4 grid grid-cols-12 gap-3 items-start">
                  <div className="col-span-12 md:col-span-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-[10px]">{r.industry}</Badge>
                      <Badge variant="outline" className="text-[10px]">{r.scenario_type}</Badge>
                    </div>
                    <div className="font-medium text-sm">{r.label}</div>
                    <div className="text-[11px] text-muted-foreground mt-1">Expected: {r.expected}</div>
                  </div>
                  <div className="col-span-12 md:col-span-3 space-y-2">
                    {r.error ? (
                      <Badge className="bg-rose-500/15 text-rose-700 border-rose-500/30">Error</Badge>
                    ) : (
                      <>
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${recColor(r.recommendation)}`}>
                          {r.recommendation}
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {r.within ? (
                            <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-500/30 gap-1"><CheckCircle2 className="w-3 h-3" /> within band</Badge>
                          ) : (
                            <Badge className="bg-rose-500/15 text-rose-700 border-rose-500/30 gap-1"><XCircle className="w-3 h-3" /> out of band</Badge>
                          )}
                          {r.isFalsePositive && (
                            <Badge className="bg-rose-500/15 text-rose-700 border-rose-500/30 gap-1"><AlertTriangle className="w-3 h-3" /> false positive</Badge>
                          )}
                          {r.stable === false && (
                            <Badge className="bg-amber-500/15 text-amber-700 border-amber-500/30">unstable</Badge>
                          )}
                          {(r.inflation ?? 0) > 0 && (
                            <Badge className="bg-orange-500/15 text-orange-700 border-orange-500/30">+{r.inflation} inflation</Badge>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                  <div className="col-span-12 md:col-span-5 text-xs text-muted-foreground space-y-2">
                    {r.summary && <p className="leading-relaxed">{r.summary}</p>}
                    {r.qa && (
                      <div className="grid grid-cols-3 gap-1.5 text-[10px]">
                        <span>Evidence {r.qa.evidenceQuality}</span>
                        <span>Ownership {r.qa.functionalOwnership}</span>
                        <span>Mandatory {r.qa.mandatoryCoverage}</span>
                        <span>Transfer {r.qa.transferabilityDiscipline}</span>
                        <span>Industry {r.qa.industryAlignment}</span>
                        <span>Anti-infl {r.qa.antiInflation}</span>
                      </div>
                    )}
                    {r.error && <p className="text-rose-600">{r.error}</p>}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {!summary && !running && (
          <Card className="p-10 text-center text-sm text-muted-foreground">
            Run the suite to validate the engine across Tech, Commodities, Banking, Cybersecurity, Oil &amp; Gas and Aviation scenarios.
          </Card>
        )}
      </div>
    </AdminLayout>
  );
}
