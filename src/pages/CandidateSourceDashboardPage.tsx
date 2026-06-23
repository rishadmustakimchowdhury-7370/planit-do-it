import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { friendlyDiscoveryError } from '@/lib/discoveryErrors';
import {
  Activity, CheckCircle2, XCircle, AlertCircle, Loader2, RefreshCw, Database, ExternalLink,
} from 'lucide-react';

type ProviderKey = 'apollo' | 'lusha' | 'vibe_prospecting';

interface SourceState {
  status: 'connected' | 'disconnected' | 'error';
  credits: number | null;
  lastSuccess: string | null;
  dailyUsage: number | null;
  error: string | null;
  loading: boolean;
}

const META: Record<ProviderKey, { title: string; description: string; integrationFn: string }> = {
  apollo: {
    title: 'Apollo',
    description: 'Apollo.io people & company database.',
    integrationFn: 'apollo-integration',
  },
  lusha: {
    title: 'Lusha',
    description: 'Verified contact details from LinkedIn and the open web.',
    integrationFn: 'candidate-source-integration',
  },
  vibe_prospecting: {
    title: 'Vibe Prospecting',
    description: 'Source passive candidates from the Vibe / Explorium database.',
    integrationFn: 'candidate-source-integration',
  },
};

function fmtDate(iso: string | null): string {
  if (!iso) return 'Never';
  const d = new Date(iso);
  return d.toLocaleString();
}

export default function CandidateSourceDashboardPage() {
  const { toast } = useToast();
  const [state, setState] = useState<Record<ProviderKey, SourceState>>({
    apollo: { status: 'disconnected', credits: null, lastSuccess: null, dailyUsage: null, error: null, loading: true },
    lusha: { status: 'disconnected', credits: null, lastSuccess: null, dailyUsage: null, error: null, loading: true },
    vibe_prospecting: { status: 'disconnected', credits: null, lastSuccess: null, dailyUsage: null, error: null, loading: true },
  });

  const loadDailyUsage = async (provider: ProviderKey): Promise<number | null> => {
    try {
      const since = new Date(); since.setHours(0, 0, 0, 0);
      const res = await (supabase as unknown as {
        from: (t: string) => {
          select: (c: string, o?: Record<string, unknown>) => {
            gte: (c: string, v: string) => {
              eq: (c: string, v: string) => Promise<{ count: number | null }>;
            };
          };
        };
      })
        .from('ai_usage')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', since.toISOString())
        .eq('operation_type', `discovery_${provider}`);
      return res.count ?? 0;
    } catch {
      return null;
    }
  };

  const loadOne = async (provider: ProviderKey) => {
    setState(s => ({ ...s, [provider]: { ...s[provider], loading: true } }));
    try {
      const fn = META[provider].integrationFn;
      const body = fn === 'apollo-integration' ? { action: 'status' } : { action: 'status', provider };
      const { data, error } = await supabase.functions.invoke(fn, { body });
      if (error) throw new Error(error.message);
      const integ = data?.integration ?? { status: 'disconnected' };
      const usage = await loadDailyUsage(provider);
      setState(s => ({
        ...s,
        [provider]: {
          status: integ.status ?? 'disconnected',
          credits: integ.credits_remaining ?? integ.credits ?? null,
          lastSuccess: integ.last_sync_at ?? null,
          dailyUsage: usage,
          error: integ.last_error ? friendlyDiscoveryError(integ.last_error) : null,
          loading: false,
        },
      }));
    } catch (e) {
      setState(s => ({
        ...s,
        [provider]: { ...s[provider], loading: false, error: friendlyDiscoveryError(e instanceof Error ? e.message : 'Failed to load') },
      }));
    }
  };

  const refreshOne = async (provider: ProviderKey) => {
    setState(s => ({ ...s, [provider]: { ...s[provider], loading: true } }));
    try {
      const fn = META[provider].integrationFn;
      const body = fn === 'apollo-integration' ? { action: 'test' } : { action: 'test_search', provider };
      const { data, error } = await supabase.functions.invoke(fn, { body });
      if (error) throw new Error(error.message);
      if (data?.ok === false) {
        toast({
          title: `${META[provider].title} check failed`,
          description: friendlyDiscoveryError(data.error, data.status),
          variant: 'destructive',
        });
      } else {
        toast({ title: `${META[provider].title} is healthy`, description: 'Connection verified.' });
      }
    } catch (e) {
      toast({
        title: 'Check failed',
        description: friendlyDiscoveryError(e instanceof Error ? e.message : 'Unknown error'),
        variant: 'destructive',
      });
    } finally {
      await loadOne(provider);
    }
  };

  useEffect(() => {
    (Object.keys(META) as ProviderKey[]).forEach(p => { void loadOne(p); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        <header className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="rounded-md bg-primary/10 p-2 mt-1"><Activity className="h-6 w-6 text-primary" /></div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Candidate Source Dashboard</h1>
              <p className="text-muted-foreground text-sm">
                Live status, credits and usage for every connected discovery source.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to="/candidate-discovery/internal"><Database className="h-4 w-4 mr-2" /> Internal CRM Search</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to="/candidate-discovery">Manage credentials <ExternalLink className="h-4 w-4 ml-2" /></Link>
            </Button>
          </div>
        </header>

        <div className="grid gap-4 md:grid-cols-3">
          {(Object.keys(META) as ProviderKey[]).map(p => {
            const s = state[p];
            const m = META[p];
            return (
              <Card key={p} className="flex flex-col">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{m.title}</CardTitle>
                    {s.status === 'connected' ? (
                      <Badge className="bg-green-500/10 text-green-700 hover:bg-green-500/10"><CheckCircle2 className="h-3 w-3 mr-1" />Connected</Badge>
                    ) : s.status === 'error' ? (
                      <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" />Error</Badge>
                    ) : (
                      <Badge variant="secondary"><XCircle className="h-3 w-3 mr-1" />Not connected</Badge>
                    )}
                  </div>
                  <CardDescription className="text-xs">{m.description}</CardDescription>
                </CardHeader>
                <CardContent className="flex-1 space-y-3 text-sm">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <div className="text-xs text-muted-foreground">Credits remaining</div>
                      <div className="font-medium">{s.credits ?? '—'}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Daily usage</div>
                      <div className="font-medium">{s.dailyUsage ?? '—'}</div>
                    </div>
                    <div className="col-span-2">
                      <div className="text-xs text-muted-foreground">Last successful search</div>
                      <div className="font-medium">{fmtDate(s.lastSuccess)}</div>
                    </div>
                  </div>

                  {s.error && (
                    <Alert variant="destructive" className="py-2">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription className="text-xs">{s.error}</AlertDescription>
                    </Alert>
                  )}

                  <div className="pt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full"
                      onClick={() => refreshOne(p)}
                      disabled={s.loading || s.status === 'disconnected'}
                    >
                      {s.loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                      Run health check
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
}
