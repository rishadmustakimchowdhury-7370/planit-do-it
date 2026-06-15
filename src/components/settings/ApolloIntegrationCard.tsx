import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plug, CheckCircle2, XCircle, AlertCircle, Eye, EyeOff } from 'lucide-react';

type Status = 'connected' | 'disconnected' | 'error';
interface Integration {
  status: Status;
  last_tested_at?: string | null;
  last_error?: string | null;
  api_key_last_four?: string | null;
}

interface Props {
  canManage: boolean; // owner
}

export function ApolloIntegrationCard({ canManage }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [integration, setIntegration] = useState<Integration>({ status: 'disconnected' });
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);

  const invoke = async (action: string, payload: Record<string, unknown> = {}) => {
    const { data, error } = await supabase.functions.invoke('apollo-integration', {
      body: { action, ...payload },
    });
    if (error) throw new Error(error.message);
    if (data?.error) throw new Error(data.error);
    return data;
  };

  const loadStatus = async () => {
    setLoading(true);
    try {
      const data = await invoke('status');
      setIntegration(data.integration ?? { status: 'disconnected' });
    } catch (e) {
      console.error('Apollo status load failed', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  const handleSave = async () => {
    if (!apiKey.trim()) return;
    setSaving(true);
    try {
      const res = await invoke('save', { apiKey: apiKey.trim() });
      if (res.ok) {
        toast({ title: 'Apollo connected', description: 'API key saved and validated.' });
      } else {
        toast({ title: 'Saved with errors', description: res.error ?? 'Apollo could not verify the key', variant: 'destructive' });
      }
      setApiKey('');
      await loadStatus();
    } catch (e) {
      toast({ title: 'Save failed', description: e instanceof Error ? e.message : 'Unknown error', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const res = await invoke('test');
      toast({
        title: res.ok ? 'Connection healthy' : 'Connection failed',
        description: res.ok ? 'Apollo responded successfully.' : res.error ?? 'Unknown error',
        variant: res.ok ? 'default' : 'destructive',
      });
      await loadStatus();
    } catch (e) {
      toast({ title: 'Test failed', description: e instanceof Error ? e.message : 'Unknown error', variant: 'destructive' });
    } finally {
      setTesting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Disconnect Apollo? Your API key will be permanently removed.')) return;
    setDisconnecting(true);
    try {
      await invoke('disconnect');
      toast({ title: 'Apollo disconnected' });
      await loadStatus();
    } catch (e) {
      toast({ title: 'Disconnect failed', description: e instanceof Error ? e.message : 'Unknown error', variant: 'destructive' });
    } finally {
      setDisconnecting(false);
    }
  };

  const statusBadge = () => {
    if (integration.status === 'connected') {
      return <Badge variant="default" className="gap-1 bg-green-600 hover:bg-green-600"><CheckCircle2 className="h-3 w-3" /> Connected</Badge>;
    }
    if (integration.status === 'error') {
      return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> Error</Badge>;
    }
    return <Badge variant="secondary" className="gap-1"><AlertCircle className="h-3 w-3" /> Not connected</Badge>;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="rounded-md bg-primary/10 p-2">
              <Plug className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle>Apollo.io</CardTitle>
              <CardDescription>
                Connect your Apollo workspace to enrich leads and contacts. Your API key is encrypted at rest.
              </CardDescription>
            </div>
          </div>
          {!loading && statusBadge()}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {integration.status !== 'disconnected' && (
              <div className="grid gap-2 text-sm rounded-md border bg-muted/30 p-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">API key</span>
                  <span className="font-mono">•••• {integration.api_key_last_four ?? '----'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Last tested</span>
                  <span>{integration.last_tested_at ? new Date(integration.last_tested_at).toLocaleString() : 'Never'}</span>
                </div>
                {integration.last_error && (
                  <Alert variant="destructive" className="mt-1">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{integration.last_error}</AlertDescription>
                  </Alert>
                )}
              </div>
            )}

            {canManage ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="apollo-key">
                    {integration.status === 'disconnected' ? 'Apollo API Key' : 'Replace API Key'}
                  </Label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Input
                        id="apollo-key"
                        type={showKey ? 'text' : 'password'}
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder="Paste your Apollo API key"
                        autoComplete="off"
                      />
                      <button
                        type="button"
                        onClick={() => setShowKey((s) => !s)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        aria-label={showKey ? 'Hide key' : 'Show key'}
                      >
                        {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <Button onClick={handleSave} disabled={saving || !apiKey.trim()}>
                      {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                      Save
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Find your key in Apollo → Settings → Integrations → API.
                  </p>
                </div>

                {integration.status !== 'disconnected' && (
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={handleTest} disabled={testing}>
                      {testing && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                      Test Connection
                    </Button>
                    <Button variant="destructive" onClick={handleDisconnect} disabled={disconnecting}>
                      {disconnecting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                      Disconnect
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Only the workspace Owner can manage this integration. You can view its current status above.
                </AlertDescription>
              </Alert>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
