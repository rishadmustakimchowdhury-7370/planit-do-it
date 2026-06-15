import { useEffect, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import {
  Sparkles, Loader2, Search, ExternalLink, Linkedin, AlertCircle, Wand2,
  ChevronLeft, ChevronRight, Lock,
} from 'lucide-react';

const EMPLOYEE_RANGES = ['', '1-10', '11-50', '51-200', '201-500', '501-1000', '1001-5000', '5001-10000', '10001+'];

interface Filters {
  keywords: string;
  industry: string;
  employeeRange: string;
  revenueMin: string;
  revenueMax: string;
  country: string;
  city: string;
  explanation?: string;
}

interface Person {
  id: string;
  name: string;
  title: string | null;
  linkedin_url: string | null;
  city: string | null;
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

interface SearchResult {
  people: Person[];
  page: number;
  per_page: number;
  total_entries: number;
  total_pages: number;
}

const EXAMPLES = [
  'Find recruitment agencies in London',
  'Find commodity companies in Switzerland',
  'Find healthcare staffing firms in Texas',
];

export default function AIProspectSearchPage() {
  const { tenantId, isOwner, isManager, isSuperAdmin, isRecruiter } = useAuth();
  const canUse = isOwner || isManager || isSuperAdmin;
  const { toast } = useToast();
  const [query, setQuery] = useState('');
  const [planSlug, setPlanSlug] = useState<string | null>(null);
  const [planLoading, setPlanLoading] = useState(true);
  const [parsing, setParsing] = useState(false);
  const [filters, setFilters] = useState<Filters | null>(null);
  const [searching, setSearching] = useState(false);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  useEffect(() => {
    (async () => {
      if (!tenantId) { setPlanLoading(false); return; }
      const { data: t } = await supabase.from('tenants').select('subscription_plan_id').eq('id', tenantId).maybeSingle();
      if (t?.subscription_plan_id) {
        const { data: p } = await supabase.from('subscription_plans').select('slug').eq('id', t.subscription_plan_id).maybeSingle();
        setPlanSlug((p?.slug as string) ?? null);
      }
      setPlanLoading(false);
    })();
  }, [tenantId]);

  const isAgency = planSlug === 'agency';

  const parseQuery = async () => {
    if (!query.trim()) return;
    setParsing(true); setError(null); setResult(null);
    const { data, error: e } = await supabase.functions.invoke('ai-prospect-parse', { body: { query } });
    setParsing(false);
    if (e || data?.error) {
      setError(data?.error ?? e?.message ?? 'Failed to parse query');
      return;
    }
    const f = data.filters;
    setFilters({
      keywords: f.keywords ?? '',
      industry: f.industry ?? '',
      employeeRange: f.employeeRange ?? '',
      revenueMin: f.revenueMin != null ? String(f.revenueMin) : '',
      revenueMax: f.revenueMax != null ? String(f.revenueMax) : '',
      country: f.country ?? '',
      city: f.city ?? '',
      explanation: f.explanation ?? '',
    });
  };

  const runSearch = async (pageNum = 1) => {
    if (!filters) return;
    setSearching(true); setError(null);
    const body = {
      keywords: filters.keywords,
      industry: filters.industry,
      employeeRange: filters.employeeRange,
      revenueMin: filters.revenueMin ? Number(filters.revenueMin) : undefined,
      revenueMax: filters.revenueMax ? Number(filters.revenueMax) : undefined,
      country: filters.country,
      city: filters.city,
      page: pageNum,
      perPage: 25,
    };
    const { data, error: e } = await supabase.functions.invoke('apollo-search', { body });
    setSearching(false);
    if (e || data?.error) {
      setError(data?.error ?? e?.message ?? 'Search failed');
      return;
    }
    setResult(data as SearchResult);
    setPage(pageNum);
  };

  if (planLoading) {
    return <AppLayout><div className="p-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin" /></div></AppLayout>;
  }

  if (!isAgency) {
    return (
      <AppLayout>
        <div className="max-w-2xl mx-auto p-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Lock className="w-5 h-5" /> Agency Plan Required</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-muted-foreground">
                AI Prospect Search converts natural-language queries into Apollo filters and runs targeted prospect discovery.
                It's available exclusively on the <strong>Agency</strong> plan.
              </p>
              <Button onClick={() => (window.location.href = '/billing')}>Upgrade to Agency</Button>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-accent" /> AI Prospect Search
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Describe the prospects you want. AI converts your request into Apollo filters — you approve, then we search.
          </p>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-base">Describe your search</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              rows={3}
              placeholder="e.g. Find recruitment agencies in London"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              {EXAMPLES.map((ex) => (
                <Badge key={ex} variant="secondary" className="cursor-pointer" onClick={() => setQuery(ex)}>{ex}</Badge>
              ))}
            </div>
            <div className="flex justify-end">
              <Button onClick={parseQuery} disabled={parsing || !query.trim()}>
                {parsing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Wand2 className="w-4 h-4 mr-2" />}
                Generate Filters
              </Button>
            </div>
          </CardContent>
        </Card>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="w-4 h-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {filters && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Generated Filters — review & approve</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {filters.explanation && (
                <p className="text-sm text-muted-foreground italic">{filters.explanation}</p>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div><Label>Keywords</Label><Input value={filters.keywords} onChange={(e) => setFilters({ ...filters, keywords: e.target.value })} /></div>
                <div><Label>Industry</Label><Input value={filters.industry} onChange={(e) => setFilters({ ...filters, industry: e.target.value })} /></div>
                <div>
                  <Label>Employee Range</Label>
                  <Select value={filters.employeeRange || '__any'} onValueChange={(v) => setFilters({ ...filters, employeeRange: v === '__any' ? '' : v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__any">Any</SelectItem>
                      {EMPLOYEE_RANGES.filter(Boolean).map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label>Revenue Min</Label><Input type="number" value={filters.revenueMin} onChange={(e) => setFilters({ ...filters, revenueMin: e.target.value })} /></div>
                  <div><Label>Revenue Max</Label><Input type="number" value={filters.revenueMax} onChange={(e) => setFilters({ ...filters, revenueMax: e.target.value })} /></div>
                </div>
                <div><Label>Country</Label><Input value={filters.country} onChange={(e) => setFilters({ ...filters, country: e.target.value })} /></div>
                <div><Label>City / Region</Label><Input value={filters.city} onChange={(e) => setFilters({ ...filters, city: e.target.value })} /></div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setFilters(null)}>Discard</Button>
                <Button onClick={() => runSearch(1)} disabled={searching}>
                  {searching ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Search className="w-4 h-4 mr-2" />}
                  Approve & Search Apollo
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {result && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between">
                <span>Results ({result.total_entries})</span>
                <div className="flex items-center gap-2 text-sm font-normal">
                  <Button size="sm" variant="outline" disabled={page <= 1 || searching} onClick={() => runSearch(page - 1)}>
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span>Page {result.page} / {result.total_pages}</span>
                  <Button size="sm" variant="outline" disabled={page >= result.total_pages || searching} onClick={() => runSearch(page + 1)}>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Links</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.people.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.company.name ?? '—'}</TableCell>
                      <TableCell>{p.name}</TableCell>
                      <TableCell className="text-muted-foreground">{p.title ?? '—'}</TableCell>
                      <TableCell className="text-muted-foreground">{[p.city, p.country].filter(Boolean).join(', ') || '—'}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          {p.company.website_url && <a href={p.company.website_url} target="_blank" rel="noreferrer"><ExternalLink className="w-4 h-4" /></a>}
                          {p.linkedin_url && <a href={p.linkedin_url} target="_blank" rel="noreferrer"><Linkedin className="w-4 h-4" /></a>}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {result.people.length === 0 && (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No results</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
