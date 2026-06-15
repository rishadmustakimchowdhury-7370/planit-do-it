import { useEffect, useMemo, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/auth';
import {
  Search, Loader2, ExternalLink, Linkedin, ChevronLeft, ChevronRight, AlertCircle,
  Bookmark, Building2, UserPlus, Check, X, RefreshCw, Sparkles, Download,
} from 'lucide-react';
import { generateDemoCompanies } from '@/lib/apolloDemoData';

interface Person {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  name: string;
  title: string | null;
  linkedin_url: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  company: {
    name: string | null;
    website_url: string | null;
    linkedin_url: string | null;
    industry: string | null;
    estimated_num_employees: number | null;
    city: string | null;
    country: string | null;
  };
}

interface CompanyResult {
  id: string;
  name: string | null;
  website_url: string | null;
  linkedin_url: string | null;
  industry: string | null;
  estimated_num_employees: number | null;
  city: string | null;
  state?: string | null;
  country: string | null;
  short_description?: string | null;
}

interface SearchResult {
  mode?: 'people' | 'companies';
  planTier?: string;
  capabilities?: { people_search?: boolean; org_search?: boolean };
  people: Person[];
  companies?: CompanyResult[];
  page: number;
  per_page: number;
  total_entries: number;
  total_pages: number;
  isDemo?: boolean;
}

const EMPLOYEE_RANGES = ['1-10', '11-50', '51-200', '201-500', '501-1000', '1001-5000', '5001-10000', '10001+'];

const toPayload = (p: Person) => ({
  company: {
    name: p.company.name,
    website: p.company.website_url,
    linkedin_url: p.company.linkedin_url,
    industry: p.company.industry,
    employee_count: p.company.estimated_num_employees,
    city: p.company.city,
    country: p.company.country,
  },
  contact: {
    first_name: p.first_name ?? null,
    last_name: p.last_name ?? null,
    full_name: p.name,
    title: p.title,
    linkedin_url: p.linkedin_url,
    city: p.city,
    country: p.country,
  },
});

export default function ProspectSearchPage() {
  const { toast } = useToast();
  const [filters, setFilters] = useState({
    keywords: '', industry: '', employeeRange: '', revenueMin: '', revenueMax: '', country: '', city: '',
  });
  const [page, setPage] = useState(1);
  const [perPage] = useState(25);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [rowSaving, setRowSaving] = useState<Record<string, 'lead' | 'company' | null>>({});
  const [bulkSaving, setBulkSaving] = useState(false);
  const [mode, setMode] = useState<'people' | 'companies'>('people');
  const [planTier, setPlanTier] = useState<string>('unknown');
  const [capabilities, setCapabilities] = useState<{ people_search?: boolean; org_search?: boolean }>({});
  const [retesting, setRetesting] = useState(false);

  const loadStatus = async () => {
    const { data } = await supabase.functions.invoke('apollo-integration', { body: { action: 'status' } });
    const integ = data?.integration ?? {};
    const caps = integ.capabilities ?? {};
    const tier = integ.plan_tier ?? 'unknown';
    setCapabilities(caps);
    setPlanTier(tier);
    if (tier === 'free' || caps.people_search === false) setMode('companies');
    return { tier, caps };
  };

  useEffect(() => { loadStatus(); }, []);

  const retestConnection = async () => {
    setRetesting(true);
    try {
      const { data, error: err } = await supabase.functions.invoke('apollo-integration', { body: { action: 'test' } });
      if (err) throw new Error(err.message);
      if (data?.error && !data?.ok) throw new Error(data.error);
      const tier = data?.plan_tier ?? 'unknown';
      const caps = data?.capabilities ?? {};
      setPlanTier(tier);
      setCapabilities(caps);
      if (tier !== 'free' && (caps.people_search || caps.org_search)) {
        toast({ title: 'Apollo plan upgraded', description: 'Prospect Search features unlocked.' });
        if (caps.people_search) setMode('people');
      } else {
        toast({ title: 'Still on Free plan', description: 'Upgrade your Apollo subscription, then retest.', variant: 'destructive' });
      }
    } catch (e) {
      toast({ title: 'Retest failed', description: e instanceof Error ? e.message : 'Unknown error', variant: 'destructive' });
    } finally {
      setRetesting(false);
    }
  };

  const loadDemoResults = () => {
    const companies = generateDemoCompanies();
    setMode('companies');
    setError(null);
    setSelected(new Set());
    setResult({
      mode: 'companies',
      planTier,
      capabilities,
      people: [],
      companies,
      page: 1,
      per_page: companies.length,
      total_entries: companies.length,
      total_pages: 1,
      isDemo: true,
    });
    toast({ title: 'Sample data loaded', description: `${companies.length} demo prospects ready. Marked as DEMO DATA.` });
  };

  const exportCompaniesCsv = () => {
    if (!result?.companies?.length) return;
    const headers = ['Company', 'Website', 'LinkedIn', 'Industry', 'Employees', 'Country', 'City', 'Revenue Range', 'Demo'];
    const rows = result.companies.map((c: any) => [
      c.name ?? '', c.website_url ?? '', c.linkedin_url ?? '', c.industry ?? '',
      c.estimated_num_employees ?? '', c.country ?? '', c.city ?? '', c.revenue_range ?? '',
      result.isDemo ? 'YES' : 'NO',
    ]);
    const escape = (v: any) => {
      const s = String(v ?? '');
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [headers, ...rows].map((r) => r.map(escape).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `apollo-${result.isDemo ? 'demo-' : ''}companies-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const bulkSaveCompanies = async () => {
    if (!result?.companies?.length) return;
    const list = selected.size > 0 ? result.companies.filter((c) => selected.has(c.id)) : result.companies;
    setBulkSaving(true);
    let ok = 0, dup = 0, fail = 0;
    for (const c of list) {
      try {
        const { data, error: err } = await supabase.functions.invoke('save-leads', {
          body: {
            mode: 'company',
            company: {
              name: c.name, website: c.website_url, linkedin_url: c.linkedin_url,
              industry: c.industry, employee_count: c.estimated_num_employees,
              city: c.city, country: c.country,
              source: result.isDemo ? 'apollo_demo' : 'apollo',
              is_demo: !!result.isDemo,
            },
          },
        });
        if (err || data?.error) { fail++; continue; }
        if (data?.created) ok++; else dup++;
      } catch { fail++; }
    }
    setBulkSaving(false);
    setSelected(new Set());
    toast({ title: 'Bulk save complete', description: `${ok} saved, ${dup} duplicates, ${fail} failed.` });
  };




  const runSearch = async (newPage = 1, overrideMode?: 'people' | 'companies') => {
    const useMode = overrideMode ?? mode;
    setLoading(true); setError(null); setSelected(new Set());
    try {
      const { data, error: invokeErr } = await supabase.functions.invoke('apollo-search', {
        body: {
          ...filters,
          mode: useMode,
          revenueMin: filters.revenueMin ? Number(filters.revenueMin) : undefined,
          revenueMax: filters.revenueMax ? Number(filters.revenueMax) : undefined,
          employeeRange: filters.employeeRange || undefined,
          page: newPage, perPage,
        },
      });
      if (invokeErr) throw new Error(invokeErr.message);
      if (data?.capabilities) setCapabilities(data.capabilities);
      if (data?.planTier) setPlanTier(data.planTier);
      if (data?.error) {
        // Auto-fallback to companies if people search is plan-restricted
        if (data.fallback === 'companies' && useMode === 'people') {
          setMode('companies');
          toast({ title: 'Switched to Company search', description: data.error });
          await runSearch(1, 'companies');
          return;
        }
        throw new Error(data.error);
      }
      setResult(data); setPage(newPage);
      if (data?.mode && data.mode !== mode) setMode(data.mode);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Search failed';
      setError(msg);
      toast({ title: 'Search failed', description: msg, variant: 'destructive' });
    } finally { setLoading(false); }
  };

  const onSubmit = (e: React.FormEvent) => { e.preventDefault(); runSearch(1); };

  const locationText = (p: Person) =>
    [p.city, p.state, p.country].filter(Boolean).join(', ') || '—';

  const totalPages = result?.total_pages ?? 1;

  const allSelected = useMemo(
    () => !!result?.people.length && result.people.every((p) => selected.has(p.id)),
    [result, selected],
  );

  const toggleAll = () => {
    if (!result) return;
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(result.people.map((p) => p.id)));
  };
  const toggleOne = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const saveOne = async (p: Person, kind: 'lead' | 'company') => {
    setRowSaving((s) => ({ ...s, [p.id]: kind }));
    try {
      const payload = toPayload(p);
      const body = kind === 'company'
        ? { mode: 'company', company: payload.company }
        : { mode: 'lead', company: payload.company, contact: payload.contact };
      const { data, error: err } = await supabase.functions.invoke('save-leads', { body });
      if (err) throw new Error(err.message);
      if (data?.error) throw new Error(data.error);
      if (kind === 'company') {
        toast({
          title: data.created ? 'Company saved' : 'Already saved',
          description: data.skipped ?? p.company.name ?? '',
        });
      } else {
        const created = (data.companiesCreated ?? 0) + (data.contactsCreated ?? 0);
        const dup = data.duplicates ?? 0;
        toast({
          title: created > 0 ? 'Lead saved' : 'Already in your leads',
          description: `${data.contactsCreated ?? 0} contact${(data.contactsCreated ?? 0) === 1 ? '' : 's'} added, ${dup} duplicate${dup === 1 ? '' : 's'} skipped`,
        });
      }
    } catch (e) {
      toast({ title: 'Save failed', description: e instanceof Error ? e.message : 'Unknown error', variant: 'destructive' });
    } finally {
      setRowSaving((s) => ({ ...s, [p.id]: null }));
    }
  };

  const saveSelected = async () => {
    if (!result || selected.size === 0) return;
    setBulkSaving(true);
    try {
      const items = result.people.filter((p) => selected.has(p.id)).map(toPayload);
      const { data, error: err } = await supabase.functions.invoke('save-leads', {
        body: { mode: 'leads', items },
      });
      if (err) throw new Error(err.message);
      if (data?.error) throw new Error(data.error);
      toast({
        title: 'Bulk save complete',
        description: `${data.contactsCreated ?? 0} new contacts, ${data.companiesCreated ?? 0} new companies, ${data.duplicates ?? 0} duplicates skipped${data.errors ? `, ${data.errors} errors` : ''}.`,
      });
      setSelected(new Set());
    } catch (e) {
      toast({ title: 'Bulk save failed', description: e instanceof Error ? e.message : 'Unknown error', variant: 'destructive' });
    } finally {
      setBulkSaving(false);
    }
  };

  const { isOwner, isManager, isSuperAdmin, isRecruiter } = useAuth();
  const canSearch = isOwner || isManager || isSuperAdmin;

  if (!canSearch && isRecruiter) {
    return (
      <AppLayout title="Prospect Search" subtitle="Restricted">
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            Recruiters don't have access to Apollo prospect search. Ask your Owner or Manager to share assigned leads with you.
          </CardContent>
        </Card>
      </AppLayout>
    );
  }

  const isFree = planTier === 'free';
  const peopleDisabled = capabilities.people_search === false || isFree;

  const planLabel =
    planTier === 'free' ? 'Free' :
    planTier === 'paid' ? 'Paid' :
    planTier === 'unknown' ? 'Unknown' :
    planTier.charAt(0).toUpperCase() + planTier.slice(1);

  if (isFree) {
    const currentFeatures = [
      { label: 'Connect Apollo account', available: true },
      { label: 'Test API key', available: true },
      { label: 'People Search', available: false },
      { label: 'Company Search', available: false },
      { label: 'Save Prospects to CRM', available: false },
      { label: 'Bulk Save', available: false },
      { label: 'CSV Export', available: false },
    ];
    const unlockedFeatures = [
      'People Search',
      'Company Search',
      'Save Prospects to CRM',
      'Bulk Save',
      'CSV Export',
    ];
    return (
      <AppLayout title="Prospect Search" subtitle="Apollo paid subscription required">
        <Card className="max-w-3xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 flex-wrap">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              Apollo paid plan required
              <Badge variant="outline" className="ml-2">Detected plan: {planLabel}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5 text-sm">
            <p>
              Your connected Apollo account is on the <strong>{planLabel} plan</strong>, which does
              not expose the search API endpoints HireMetrics needs for Prospect Search.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-md border p-4">
                <div className="font-medium mb-2">Available on your current plan</div>
                <ul className="space-y-1.5">
                  {currentFeatures.map((f) => (
                    <li key={f.label} className="flex items-center gap-2">
                      {f.available ? (
                        <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                      ) : (
                        <X className="h-4 w-4 text-muted-foreground shrink-0" />
                      )}
                      <span className={f.available ? '' : 'text-muted-foreground line-through'}>{f.label}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-md border p-4 bg-primary/5 border-primary/20">
                <div className="font-medium mb-2">Unlocked after upgrade</div>
                <ul className="space-y-1.5">
                  {unlockedFeatures.map((f) => (
                    <li key={f} className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-primary shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <p className="text-muted-foreground">
              Already upgraded? Click <strong>Retest Connection</strong> — features unlock
              automatically, no need to disconnect or re-enter your API key.
            </p>

            <div className="flex gap-2 pt-1 flex-wrap">
              <Button asChild>
                <a href="https://app.apollo.io/#/settings/plans" target="_blank" rel="noreferrer">
                  Upgrade Apollo <ExternalLink className="h-4 w-4 ml-2" />
                </a>
              </Button>
              <Button variant="secondary" onClick={retestConnection} disabled={retesting}>
                {retesting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                Retest Connection
              </Button>
              <Button variant="outline" onClick={loadDemoResults}>
                <Sparkles className="h-4 w-4 mr-2" />
                Load Sample Apollo Results
              </Button>
              <Button variant="ghost" asChild>
                <a href="/settings">Manage integration</a>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Demo mode loads 20 realistic recruitment-agency prospects so you can test Save to CRM,
              Bulk Save, and CSV export without a paid Apollo plan. All records are tagged as DEMO DATA.
            </p>
          </CardContent>
        </Card>
      </AppLayout>
    );
  }


  return (
    <AppLayout title="Prospect Search" subtitle={isSuperAdmin ? 'Demo workspace — uses your own Apollo account' : 'Find companies and contacts via your connected Apollo account'}>
      <div className="space-y-6">


        <Card>
          <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-3">
            <CardTitle>Search filters</CardTitle>
            <div className="inline-flex rounded-md border p-1 bg-muted/40">
              <button type="button"
                className={`px-3 py-1.5 text-sm rounded ${mode === 'people' ? 'bg-background shadow-sm' : 'text-muted-foreground'} ${peopleDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                onClick={() => !peopleDisabled && setMode('people')}
                disabled={peopleDisabled}
                title={peopleDisabled ? 'People search requires a paid Apollo plan' : ''}>
                People
              </button>
              <button type="button"
                className={`px-3 py-1.5 text-sm rounded ${mode === 'companies' ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}
                onClick={() => setMode('companies')}>
                Companies
              </button>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-3">
                <Label htmlFor="keywords">Keywords</Label>
                <Input id="keywords" placeholder="e.g. VP Engineering, SaaS"
                  value={filters.keywords} onChange={(e) => setFilters({ ...filters, keywords: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="industry">Industry</Label>
                <Input id="industry" placeholder="e.g. Information Technology"
                  value={filters.industry} onChange={(e) => setFilters({ ...filters, industry: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="employees">Employee Count</Label>
                <Select value={filters.employeeRange || 'any'}
                  onValueChange={(v) => setFilters({ ...filters, employeeRange: v === 'any' ? '' : v })}>
                  <SelectTrigger id="employees"><SelectValue placeholder="Any" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any</SelectItem>
                    {EMPLOYEE_RANGES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Revenue (USD)</Label>
                <div className="flex gap-2">
                  <Input type="number" placeholder="Min" value={filters.revenueMin}
                    onChange={(e) => setFilters({ ...filters, revenueMin: e.target.value })} />
                  <Input type="number" placeholder="Max" value={filters.revenueMax}
                    onChange={(e) => setFilters({ ...filters, revenueMax: e.target.value })} />
                </div>
              </div>
              <div>
                <Label htmlFor="country">Country</Label>
                <Input id="country" placeholder="e.g. United States"
                  value={filters.country} onChange={(e) => setFilters({ ...filters, country: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="city">City</Label>
                <Input id="city" placeholder="e.g. San Francisco"
                  value={filters.city} onChange={(e) => setFilters({ ...filters, city: e.target.value })} />
              </div>
              <div className="md:col-span-3 flex justify-end">
                <Button type="submit" disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Search className="h-4 w-4 mr-2" />}
                  Search
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {result && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
              <CardTitle className="flex items-center gap-2 flex-wrap">
                Results <Badge variant="secondary">{result.total_entries.toLocaleString()}</Badge>
                {result.isDemo && (
                  <Badge variant="outline" className="border-amber-400 text-amber-600 bg-amber-50">
                    DEMO DATA
                  </Badge>
                )}
              </CardTitle>
              <div className="flex items-center gap-2 flex-wrap">
                {selected.size > 0 && (
                  <span className="text-sm text-muted-foreground">{selected.size} selected</span>
                )}
                {(result.mode ?? mode) === 'companies' ? (
                  <>
                    <Button size="sm" onClick={bulkSaveCompanies} disabled={bulkSaving || !result.companies?.length}>
                      {bulkSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Bookmark className="h-4 w-4 mr-2" />}
                      {selected.size > 0 ? `Save ${selected.size}` : 'Save All'} Compan{(selected.size === 1) ? 'y' : 'ies'}
                    </Button>
                    <Button size="sm" variant="outline" onClick={exportCompaniesCsv} disabled={!result.companies?.length}>
                      <Download className="h-4 w-4 mr-2" /> Export CSV
                    </Button>
                  </>
                ) : (
                  <Button size="sm" onClick={saveSelected} disabled={bulkSaving || selected.size === 0}>
                    {bulkSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Bookmark className="h-4 w-4 mr-2" />}
                    Save {selected.size > 0 ? `${selected.size} ` : ''}Lead{selected.size === 1 ? '' : 's'}
                  </Button>
                )}
                <span className="text-sm text-muted-foreground ml-2">Page {result.page} of {totalPages}</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="overflow-x-auto">
                {(result.mode ?? mode) === 'companies' ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8">
                          <Checkbox
                            checked={!!result.companies?.length && result.companies.every((c) => selected.has(c.id))}
                            onCheckedChange={() => {
                              if (!result.companies) return;
                              const all = result.companies.every((c) => selected.has(c.id));
                              setSelected(all ? new Set() : new Set(result.companies.map((c) => c.id)));
                            }}
                            aria-label="Select all companies"
                          />
                        </TableHead>
                        <TableHead>Company</TableHead>
                        <TableHead>Industry</TableHead>
                        <TableHead>Employees</TableHead>
                        <TableHead>Revenue</TableHead>
                        <TableHead>Website</TableHead>
                        <TableHead>LinkedIn</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(result.companies ?? []).length === 0 ? (
                        <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                          No companies found. Try adjusting your filters.
                        </TableCell></TableRow>
                      ) : (
                        (result.companies ?? []).map((c) => {
                          const busy = rowSaving[c.id];
                          return (
                            <TableRow key={c.id} data-state={selected.has(c.id) ? 'selected' : undefined}>
                              <TableCell>
                                <Checkbox checked={selected.has(c.id)} onCheckedChange={() => toggleOne(c.id)} aria-label={`Select ${c.name}`} />
                              </TableCell>
                              <TableCell className="font-medium">
                                <div className="flex items-center gap-2">
                                  <span>{c.name ?? '—'}</span>
                                  {result.isDemo && <Badge variant="outline" className="text-[10px] border-amber-400 text-amber-600">DEMO</Badge>}
                                </div>
                              </TableCell>
                              <TableCell className="text-sm">{c.industry ?? '—'}</TableCell>
                              <TableCell className="text-sm">{c.estimated_num_employees ?? '—'}</TableCell>
                              <TableCell className="text-sm">{(c as any).revenue_range ?? '—'}</TableCell>
                              <TableCell>
                                {c.website_url ? (
                                  <a href={c.website_url} target="_blank" rel="noreferrer" className="text-primary inline-flex items-center gap-1 hover:underline">
                                    Visit <ExternalLink className="h-3 w-3" />
                                  </a>
                                ) : '—'}
                              </TableCell>
                              <TableCell>
                                {c.linkedin_url ? (
                                  <a href={c.linkedin_url} target="_blank" rel="noreferrer" className="text-primary inline-flex items-center gap-1 hover:underline">
                                    <Linkedin className="h-3 w-3" /> Page
                                  </a>
                                ) : '—'}
                              </TableCell>
                              <TableCell className="text-sm">{[c.city, c.state, c.country].filter(Boolean).join(', ') || '—'}</TableCell>
                              <TableCell className="text-right">
                                <Button size="sm" variant="outline"
                                  disabled={!!busy || !c.name}
                                  onClick={() => saveOne({
                                    id: c.id, name: c.name ?? '', first_name: null, last_name: null,
                                    title: null, linkedin_url: null, city: c.city, state: c.state ?? null, country: c.country,
                                    company: {
                                      name: c.name, website_url: c.website_url, linkedin_url: c.linkedin_url,
                                      industry: c.industry, estimated_num_employees: c.estimated_num_employees,
                                      city: c.city, country: c.country,
                                    },
                                  } as Person, 'company')}>
                                  {busy === 'company' ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Building2 className="h-4 w-4 mr-1" />}
                                  Save Company
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8">
                          <Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="Select all" />
                        </TableHead>
                        <TableHead>Company</TableHead>
                        <TableHead>Contact</TableHead>
                        <TableHead>Title</TableHead>
                        <TableHead>Website</TableHead>
                        <TableHead>LinkedIn</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {result.people.length === 0 ? (
                        <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                          No prospects found. Try adjusting your filters.
                        </TableCell></TableRow>
                      ) : (
                        result.people.map((p) => {
                          const busy = rowSaving[p.id];
                          return (
                            <TableRow key={p.id} data-state={selected.has(p.id) ? 'selected' : undefined}>
                              <TableCell>
                                <Checkbox checked={selected.has(p.id)} onCheckedChange={() => toggleOne(p.id)} aria-label={`Select ${p.name}`} />
                              </TableCell>
                              <TableCell className="font-medium">
                                {p.company.name ?? '—'}
                                {p.company.industry && <div className="text-xs text-muted-foreground">{p.company.industry}</div>}
                              </TableCell>
                              <TableCell>{p.name || '—'}</TableCell>
                              <TableCell className="max-w-[220px] truncate">{p.title ?? '—'}</TableCell>
                              <TableCell>
                                {p.company.website_url ? (
                                  <a href={p.company.website_url} target="_blank" rel="noreferrer" className="text-primary inline-flex items-center gap-1 hover:underline">
                                    Visit <ExternalLink className="h-3 w-3" />
                                  </a>
                                ) : '—'}
                              </TableCell>
                              <TableCell>
                                {p.linkedin_url ? (
                                  <a href={p.linkedin_url} target="_blank" rel="noreferrer" className="text-primary inline-flex items-center gap-1 hover:underline">
                                    <Linkedin className="h-3 w-3" /> Profile
                                  </a>
                                ) : '—'}
                              </TableCell>
                              <TableCell className="text-sm">{locationText(p)}</TableCell>
                              <TableCell className="text-right whitespace-nowrap">
                                <Button size="sm" variant="ghost" onClick={() => saveOne(p, 'company')} disabled={!!busy || !p.company.name} title="Save company only">
                                  {busy === 'company' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Building2 className="h-4 w-4" />}
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => saveOne(p, 'lead')} disabled={!!busy} className="ml-1">
                                  {busy === 'lead' ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <UserPlus className="h-4 w-4 mr-1" />}
                                  Save Lead
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                )}
              </div>


              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  Showing {(result.page - 1) * result.per_page + 1}–
                  {Math.min(result.page * result.per_page, result.total_entries)} of {result.total_entries.toLocaleString()}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={loading || result.page <= 1} onClick={() => runSearch(result.page - 1)}>
                    <ChevronLeft className="h-4 w-4" /> Previous
                  </Button>
                  <Button variant="outline" size="sm" disabled={loading || result.page >= totalPages} onClick={() => runSearch(result.page + 1)}>
                    Next <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
