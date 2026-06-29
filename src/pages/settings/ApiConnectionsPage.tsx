import { useEffect, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Loader2, CheckCircle2, XCircle, Plug, RefreshCw, Trash2, Shield } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useFeatureUsageBatch } from '@/hooks/useFeatureUsage';

interface Connection {
  id: string;
  provider: 'apollo' | 'lusha' | 'vibe';
  status: 'pending' | 'connected' | 'error' | null;
  last_tested_at: string | null;
  last_error: string | null;
  key_hint: string | null;
  label: string | null;
  updated_at: string | null;
}

const PROVIDERS: Array<{ key: 'apollo' | 'lusha' | 'vibe'; name: string; description: string; usageKey: string }> = [
  { key: 'apollo', name: 'Apollo.io', description: 'B2B contact + company database with email finder.', usageKey: 'ai_prospect_search' },
  { key: 'lusha', name: 'Lusha', description: 'Direct phone numbers and business emails.', usageKey: 'ai_prospect_search' },
  { key: 'vibe', name: 'Vibe Prospecting', description: 'AI-augmented prospect intelligence.', usageKey: 'open_web_discovery' },
];

const USAGE_KEYS = [
  'ai_candidate_discovery',
  'ai_prospect_search',
  'ai_matching',
  'open_web_discovery',
  'resume_parsing',
  'executive_assessment',
  'ai_email_generation',
];

const USAGE_LABELS: Record<string, string> = {
  ai_candidate_discovery: 'AI Candidate Discovery',
  ai_prospect_search: 'AI Prospect Search',
  ai_matching: 'AI Candidate Matching',
  open_web_discovery: 'Open Web Discovery',
  resume_parsing: 'Resume Parsing',
  executive_assessment: 'AI Executive Assessment',
  ai_email_generation: 'AI Email Generation',
};

export default function ApiConnectionsPage() {
  const [conns, setConns] = useState<Record<string, Connection>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const usage = useFeatureUsageBatch(USAGE_KEYS);

  const refresh = async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke('tenant-api-connection', {
      body: { action: 'list' },
    });
    if (error) toast.error(error.message);
    else {
      const map: Record<string, Connection> = {};
      ((data?.connections ?? []) as Connection[]).forEach(c => { map[c.provider] = c; });
      setConns(map);
    }
    setLoading(false);
  };

  useEffect(() => { refresh(); }, []);

  const save = async (provider: string) => {
    const apiKey = drafts[provider]?.trim();
    if (!apiKey) return toast.error('Enter an API key first');
    setBusy(provider);
    const { data, error } = await supabase.functions.invoke('tenant-api-connection', {
      body: { action: 'save', provider, apiKey },
    });
    setBusy(null);
    if (error || data?.error) return toast.error(error?.message || data?.error);
    toast.success('Saved & encrypted');
    setDrafts(d => ({ ...d, [provider]: '' }));
    refresh();
  };

  const test = async (provider: string) => {
    setBusy(provider);
    const { data, error } = await supabase.functions.invoke('tenant-api-connection', {
      body: { action: 'test', provider },
    });
    setBusy(null);
    if (error) return toast.error(error.message);
    if (data?.ok) toast.success(`${provider} connection healthy`);
    else toast.error(`${provider} test failed: ${data?.detail || 'unknown'}`);
    refresh();
  };

  const disconnect = async (provider: string) => {
    if (!confirm(`Disconnect ${provider}? This deletes the encrypted key.`)) return;
    setBusy(provider);
    const { error } = await supabase.functions.invoke('tenant-api-connection', {
      body: { action: 'disconnect', provider },
    });
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success('Disconnected');
    refresh();
  };

  const statusBadge = (c?: Connection) => {
    if (!c) return <Badge variant="outline">Not connected</Badge>;
    if (c.status === 'connected') return <Badge className="bg-emerald-600"><CheckCircle2 className="h-3 w-3 mr-1" />Connected</Badge>;
    if (c.status === 'error') return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Error</Badge>;
    return <Badge variant="secondary">Pending</Badge>;
  };

  return (
    <AppLayout>
      <div className="container mx-auto py-8 px-4 max-w-5xl space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">API Connections</h1>
            <p className="text-muted-foreground mt-1">
              Connect your own data-provider keys. AI models are provided by HireMetrics.
            </p>
          </div>
          <Shield className="h-8 w-8 text-primary" />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Plug className="h-5 w-5" />Data Providers</CardTitle>
            <CardDescription>
              Keys are encrypted at rest (AES-GCM). No other workspace can read them.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {loading ? (
              <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : PROVIDERS.map((p, i) => {
              const c = conns[p.key];
              return (
                <div key={p.key}>
                  {i > 0 && <Separator className="mb-6" />}
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-lg">{p.name}</h3>
                        {statusBadge(c)}
                      </div>
                      <p className="text-sm text-muted-foreground">{p.description}</p>
                      {c?.key_hint && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Key: <code>{c.key_hint}</code>
                          {c.last_tested_at && <> · Last tested {new Date(c.last_tested_at).toLocaleString()}</>}
                          {c.last_error && <span className="text-destructive ml-2">({c.last_error})</span>}
                        </p>
                      )}
                    </div>
                    {c && (
                      <div className="flex gap-2 shrink-0">
                        <Button size="sm" variant="outline" disabled={busy === p.key} onClick={() => test(p.key)}>
                          <RefreshCw className={`h-4 w-4 mr-1 ${busy === p.key ? 'animate-spin' : ''}`} />Test
                        </Button>
                        <Button size="sm" variant="outline" disabled={busy === p.key} onClick={() => disconnect(p.key)}>
                          <Trash2 className="h-4 w-4 mr-1" />Disconnect
                        </Button>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 items-end">
                    <div className="flex-1">
                      <Label htmlFor={`key-${p.key}`}>{c ? 'Replace API key' : 'API key'}</Label>
                      <Input
                        id={`key-${p.key}`}
                        type="password"
                        placeholder={c ? 'Paste new key to replace…' : 'Paste your API key…'}
                        value={drafts[p.key] ?? ''}
                        onChange={(e) => setDrafts(d => ({ ...d, [p.key]: e.target.value }))}
                        autoComplete="off"
                      />
                    </div>
                    <Button disabled={busy === p.key || !drafts[p.key]} onClick={() => save(p.key)}>
                      {busy === p.key ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
                    </Button>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Monthly Usage</CardTitle>
            <CardDescription>Counters reset automatically each billing cycle.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {usage.loading ? (
              <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : USAGE_KEYS.map(k => {
              const u = usage.data[k];
              if (!u || !u.enabled) return null;
              const label = USAGE_LABELS[k] ?? k;
              return (
                <div key={k}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium">{label}</span>
                    <span className="text-muted-foreground">
                      {u.usage} / {u.unlimited ? '∞' : (u.limit ?? '—')}
                    </span>
                  </div>
                  {!u.unlimited && u.limit != null && (
                    <Progress value={u.percent} className="h-2" />
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
