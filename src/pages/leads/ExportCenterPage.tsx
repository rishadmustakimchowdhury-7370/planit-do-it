import { useState } from 'react';
import * as XLSX from 'xlsx';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { Download, Loader2, Lock, AlertCircle } from 'lucide-react';

type Dataset = 'leads' | 'companies' | 'contacts';
type Scope = 'full' | 'filtered' | 'selected';
type Format = 'csv' | 'xlsx';

const LEAD_STATUSES = ['new','contacted','follow_up','meeting_booked','proposal_sent','negotiation','client_won','lost'];

const COMPANY_COLS = ['id','name','domain','website','industry','company_size','employee_count','revenue_range','country','city','linkedin_url','tags','created_at'];
const CONTACT_COLS = ['id','full_name','first_name','last_name','email','phone','title','seniority','department','country','city','linkedin_url','company_id','status','tags','notes','created_at'];

export default function ExportCenterPage() {
  const { tenantId, isOwner, isManager } = useAuth();
  const { toast } = useToast();
  const [dataset, setDataset] = useState<Dataset>('leads');
  const [scope, setScope] = useState<Scope>('full');
  const [format, setFormat] = useState<Format>('csv');
  const [status, setStatus] = useState<string>('all');
  const [country, setCountry] = useState('');
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState('');
  const [busy, setBusy] = useState(false);

  if (!isOwner && !isManager) {
    return (
      <AppLayout>
        <div className="max-w-xl mx-auto p-8">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Lock className="w-5 h-5" /> Restricted</CardTitle></CardHeader>
            <CardContent><p className="text-muted-foreground">Export Center is available to Owners and Managers only.</p></CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  const tableFor = (d: Dataset) => (d === 'companies' ? 'lead_companies' : 'lead_contacts');
  const colsFor = (d: Dataset) => (d === 'companies' ? COMPANY_COLS : CONTACT_COLS);

  const buildQuery = () => {
    const table = tableFor(dataset);
    const cols = colsFor(dataset);
    let q = supabase.from(table as 'lead_contacts').select(cols.join(',')).is('deleted_at', null);
    if (tenantId) q = q.eq('tenant_id', tenantId);

    if (scope === 'selected') {
      const ids = selectedIds.split(/[\s,]+/).map(s => s.trim()).filter(Boolean);
      if (!ids.length) throw new Error('Paste at least one ID for Selected Records');
      q = q.in('id', ids);
    } else if (scope === 'filtered') {
      if (dataset === 'leads' && status !== 'all') q = q.eq('status', status as never);
      if (country) q = q.ilike('country', `%${country}%`);
      if (search) {
        const field = dataset === 'companies' ? 'name' : 'full_name';
        q = q.ilike(field, `%${search}%`);
      }
    }
    return q.order('created_at', { ascending: false }).limit(10000);
  };

  const exportData = async () => {
    setBusy(true);
    try {
      const { data, error } = await buildQuery();
      if (error) throw error;
      const rows = ((data ?? []) as unknown) as Record<string, unknown>[];
      if (!rows.length) { toast({ title: 'Nothing to export', description: 'Query returned 0 rows.' }); return; }

      const flat = rows.map(r => {
        const o: Record<string, unknown> = {};
        for (const k of Object.keys(r)) {
          const v = r[k];
          o[k] = Array.isArray(v) ? v.join('; ') : (v && typeof v === 'object' ? JSON.stringify(v) : v);
        }
        return o;
      });

      const filename = `${dataset}_${new Date().toISOString().slice(0,10)}.${format}`;
      if (format === 'csv') {
        const ws = XLSX.utils.json_to_sheet(flat);
        const csv = XLSX.utils.sheet_to_csv(ws);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        download(blob, filename);
      } else {
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(flat), dataset);
        XLSX.writeFile(wb, filename);
      }
      toast({ title: 'Export ready', description: `${rows.length} record(s) exported as ${format.toUpperCase()}.` });
    } catch (e) {
      toast({ title: 'Export failed', description: e instanceof Error ? e.message : 'Error', variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const download = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Download className="w-6 h-6 text-accent" /> Export Center</h1>
          <p className="text-muted-foreground text-sm mt-1">Export leads, companies, and contacts to CSV or XLSX.</p>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-base">1. Choose dataset</CardTitle></CardHeader>
          <CardContent>
            <RadioGroup value={dataset} onValueChange={(v) => setDataset(v as Dataset)} className="grid grid-cols-3 gap-3">
              {[
                { v: 'leads', label: 'Leads', desc: 'Saved contacts in CRM pipeline' },
                { v: 'companies', label: 'Companies', desc: 'Saved company records' },
                { v: 'contacts', label: 'Contacts', desc: 'All contact records' },
              ].map((o) => (
                <label key={o.v} className={`border rounded-lg p-3 cursor-pointer ${dataset === o.v ? 'border-primary bg-primary/5' : 'border-border'}`}>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value={o.v} />
                    <span className="font-medium">{o.label}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{o.desc}</p>
                </label>
              ))}
            </RadioGroup>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">2. Choose scope</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <RadioGroup value={scope} onValueChange={(v) => setScope(v as Scope)} className="grid grid-cols-3 gap-3">
              {[
                { v: 'full', label: 'Full List' },
                { v: 'filtered', label: 'Filtered Records' },
                { v: 'selected', label: 'Selected Records' },
              ].map((o) => (
                <label key={o.v} className={`border rounded-lg p-3 cursor-pointer ${scope === o.v ? 'border-primary bg-primary/5' : 'border-border'}`}>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value={o.v} />
                    <span className="font-medium">{o.label}</span>
                  </div>
                </label>
              ))}
            </RadioGroup>

            {scope === 'filtered' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                {dataset === 'leads' && (
                  <div>
                    <Label>Status</Label>
                    <Select value={status} onValueChange={setStatus}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        {LEAD_STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace('_',' ')}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div><Label>Country contains</Label><Input value={country} onChange={(e) => setCountry(e.target.value)} placeholder="e.g. United Kingdom" /></div>
                <div><Label>Name contains</Label><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="search term" /></div>
              </div>
            )}

            {scope === 'selected' && (
              <div className="pt-2">
                <Label>Record IDs (one per line or comma-separated)</Label>
                <Textarea rows={4} value={selectedIds} onChange={(e) => setSelectedIds(e.target.value)} placeholder="uuid-1, uuid-2, ..." />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">3. Choose format</CardTitle></CardHeader>
          <CardContent>
            <RadioGroup value={format} onValueChange={(v) => setFormat(v as Format)} className="flex gap-3">
              {(['csv','xlsx'] as Format[]).map((f) => (
                <label key={f} className={`border rounded-lg px-4 py-2 cursor-pointer ${format === f ? 'border-primary bg-primary/5' : 'border-border'}`}>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value={f} />
                    <span className="font-medium uppercase">{f}</span>
                  </div>
                </label>
              ))}
            </RadioGroup>
          </CardContent>
        </Card>

        <Alert>
          <AlertCircle className="w-4 h-4" />
          <AlertDescription>Exports are capped at 10,000 records per file and respect your tenant permissions.</AlertDescription>
        </Alert>

        <div className="flex justify-end">
          <Button onClick={exportData} disabled={busy} size="lg">
            {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
            Export
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}
