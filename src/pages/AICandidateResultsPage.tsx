import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Pagination, PaginationContent, PaginationItem, PaginationLink,
  PaginationNext, PaginationPrevious,
} from '@/components/ui/pagination';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import {
  ArrowLeft, ArrowUpDown, BookmarkPlus, Download, ExternalLink, Mail, Phone,
  Linkedin, Sparkles, Loader2, AlertCircle,
} from 'lucide-react';

interface Criteria {
  role_titles?: string[];
  skills?: string[];
  locations?: string[];
  industries?: string[];
  seniority?: string | null;
  min_years_experience?: number | null;
  max_years_experience?: number | null;
  keywords?: string[];
  languages?: string[];
}

interface ResultRow {
  id: string;
  source: 'Lusha' | 'Vibe Prospecting';
  source_url?: string | null;
  full_name: string;
  current_title: string;
  current_company: string;
  industry?: string | null;
  location: string;
  languages: string[];
  linkedin_url?: string | null;
  email?: string | null;
  phone?: string | null;
  skills: string[];
  experience_years?: number | null;
  seniority?: string | null;
  matchScore?: number;
  matchReasons?: string[];
}

interface SearchPassDebug {
  id: string;
  label: string;
  boolean: string;
  raw: number;
  accepted?: number;
  rejected?: number;
  generatedFilters?: { titles?: string[]; industries?: string[]; locations?: string[]; countries?: string[]; searchText?: string | null; skipped?: boolean; skipReason?: string };
  providers?: { provider: string; records: number; error?: string }[];
}

type SortKey = 'full_name' | 'current_title' | 'current_company' | 'location' | 'experience_years' | 'matchScore' | 'source';
type SortDir = 'asc' | 'desc';
const PAGE_SIZE = 10;

function toCSV(rows: ResultRow[]): string {
  const headers = ['Name', 'Title', 'Company', 'Industry', 'Location', 'Languages', 'LinkedIn', 'Source URL', 'Email', 'Phone', 'Source', 'Match Score', 'Match Reasons'];
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [headers.join(',')];
  for (const r of rows) {
    lines.push([
      r.full_name, r.current_title, r.current_company, r.industry ?? '', r.location,
      r.languages.join('; '), r.linkedin_url ?? '', r.source_url ?? '',
      r.email ?? '', r.phone ?? '', r.source, r.matchScore ?? '',
      (r.matchReasons ?? []).join(' | '),
    ].map(esc).join(','));
  }
  return lines.join('\n');
}
function downloadCSV(filename: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export default function AICandidateResultsPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, tenantId } = useAuth();

  const criteria = useMemo<Criteria>(() => {
    try {
      const raw = sessionStorage.getItem('ai-discovery-criteria');
      return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
  }, []);

  const [rows, setRows] = useState<ResultRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [providerErrors, setProviderErrors] = useState<Record<string, string>>({});
  const [queries, setQueries] = useState<SearchPassDebug[]>([]);
  const [sortKey, setSortKey] = useState<SortKey>('matchScore');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true); setErrorMsg(null); setProviderErrors({}); setQueries([]);
      const { data, error } = await supabase.functions.invoke('ai-candidate-search', {
        body: { criteria, limit: 25 },
      });
      if (cancelled) return;
      if (error) { setErrorMsg(error.message); setRows([]); setLoading(false); return; }
      if (data?.error) { setErrorMsg(data.error); setRows([]); setLoading(false); return; }
      setRows((data?.candidates ?? []) as ResultRow[]);
      setProviderErrors(data?.errors ?? {});
      setQueries(data?.queries ?? []);
      if (data?.message && (!data?.candidates || data.candidates.length === 0)) setErrorMsg(data.message);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [criteria]);

  const sorted = useMemo(() => {
    const out = [...rows];
    out.sort((a, b) => {
      const va = (a as any)[sortKey] ?? '';
      const vb = (b as any)[sortKey] ?? '';
      const cmp = typeof va === 'number' && typeof vb === 'number'
        ? va - vb
        : String(va).localeCompare(String(vb));
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return out;
  }, [rows, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const pageRows = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const allOnPageSelected = pageRows.length > 0 && pageRows.every((r) => selected.has(r.id));

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(k); setSortDir(k === 'matchScore' || k === 'experience_years' ? 'desc' : 'asc'); }
  };
  const toggleOne = (id: string) => setSelected((prev) => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next;
  });
  const toggleAllOnPage = () => setSelected((prev) => {
    const next = new Set(prev);
    if (allOnPageSelected) pageRows.forEach((r) => next.delete(r.id));
    else pageRows.forEach((r) => next.add(r.id));
    return next;
  });

  const importRows = async (subset: ResultRow[]) => {
    if (!user || !tenantId) {
      toast({ title: 'Not signed in', description: 'You must be signed in to import candidates.', variant: 'destructive' });
      return { inserted: 0, duplicates: 0, failed: subset.length };
    }
    let inserted = 0, duplicates = 0, failed = 0;
    const emails = subset.map((r) => r.email).filter(Boolean) as string[];
    const existing = new Set<string>();
    if (emails.length) {
      const { data } = await supabase.from('candidates').select('email').eq('tenant_id', tenantId).in('email', emails);
      data?.forEach((d) => existing.add((d.email as string).toLowerCase()));
    }
    for (const r of subset) {
      const email = (r.email ?? `${r.id}@no-email.local`).toLowerCase();
      if (existing.has(email)) { duplicates++; continue; }
      const { error } = await supabase.from('candidates').insert({
        tenant_id: tenantId,
        created_by: user.id,
        full_name: r.full_name,
        email,
        phone: r.phone ?? null,
        location: r.location,
        current_title: r.current_title,
        current_company: r.current_company,
        skills: r.skills,
        experience_years: r.experience_years ?? null,
        source: r.source,
        linkedin_url: r.linkedin_url ?? null,
      } as any);
      if (error) { (error.code === '23505') ? duplicates++ : failed++; } else inserted++;
    }
    return { inserted, duplicates, failed };
  };

  const saveOne = async (id: string) => {
    const row = rows.find((r) => r.id === id);
    if (!row) return;
    setImporting((s) => new Set(s).add(id));
    const { inserted, duplicates, failed } = await importRows([row]);
    setImporting((s) => { const n = new Set(s); n.delete(id); return n; });
    if (inserted || duplicates) setSaved((s) => new Set(s).add(id));
    if (inserted) toast({ title: 'Imported to CRM', description: `${row.full_name} added (source: ${row.source}).` });
    else if (duplicates) toast({ title: 'Already in CRM', description: `${row.full_name} matches an existing candidate.` });
    else if (failed) toast({ title: 'Import failed', description: `Could not import ${row.full_name}.`, variant: 'destructive' });
  };

  const saveSelected = async () => {
    if (!selected.size) return;
    const subset = rows.filter((r) => selected.has(r.id));
    const { inserted, duplicates, failed } = await importRows(subset);
    setSaved((s) => new Set([...s, ...subset.map((r) => r.id)]));
    toast({ title: 'Import complete', description: `${inserted} added · ${duplicates} duplicate(s) · ${failed} failed`, variant: failed && !inserted ? 'destructive' : 'default' });
  };

  const exportRows = (subset: ResultRow[], label: string) => {
    if (!subset.length) { toast({ title: 'Nothing to export', variant: 'destructive' }); return; }
    downloadCSV(`candidates-${label}-${Date.now()}.csv`, toCSV(subset));
    toast({ title: 'Exported', description: `${subset.length} row(s) downloaded.` });
  };

  const sortIcon = (k: SortKey) => (
    <ArrowUpDown className={`h-3 w-3 ml-1 inline ${sortKey === k ? 'text-foreground' : 'text-muted-foreground/50'}`} />
  );

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto w-full px-6 py-6 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <Button variant="ghost" size="sm" onClick={() => navigate('/candidate-discovery/ai')} className="mb-2 -ml-2">
              <ArrowLeft className="h-4 w-4" /> Back to AI Discovery
            </Button>
            <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" /> Candidate Results
            </h1>
            <p className="text-sm text-muted-foreground">
              {loading ? 'Searching connected sources…' : `${sorted.length} candidate${sorted.length === 1 ? '' : 's'} from Lusha & Vibe Prospecting${params.get('q') ? ` for “${params.get('q')}”` : ''}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => exportRows(sorted.filter((r) => selected.has(r.id)), 'selected')} disabled={!selected.size}>
              <Download className="h-4 w-4" /> Export Selected ({selected.size})
            </Button>
            <Button variant="outline" size="sm" onClick={saveSelected} disabled={!selected.size}>
              <BookmarkPlus className="h-4 w-4" /> Save Selected
            </Button>
            <Button size="sm" onClick={() => exportRows(sorted, 'all')} disabled={!sorted.length}>
              <Download className="h-4 w-4" /> Export CSV
            </Button>
          </div>
        </div>

        {Object.entries(providerErrors).map(([p, msg]) => (
          <Alert key={p} variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription><strong>{p}:</strong> {msg}</AlertDescription>
          </Alert>
        ))}

        {errorMsg && !loading && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{errorMsg}</AlertDescription>
          </Alert>
        )}

        {queries.length > 0 && (
          <Card>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold">Generated Boolean Queries</h2>
                <span className="text-xs text-muted-foreground">{queries.length} search pass{queries.length === 1 ? '' : 'es'} run</span>
              </div>
              <div className="space-y-1.5">
                {queries.map((q) => (
                  <div key={q.id} className="text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-muted-foreground">{q.label}</span>
                      <Badge variant="outline" className="text-[10px]">{q.raw} raw</Badge>
                    </div>
                    <code className="block mt-0.5 px-2 py-1 rounded bg-muted text-foreground/80 font-mono break-all">
                      {q.boolean || '(no filters)'}
                    </code>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}


        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox checked={allOnPageSelected} onCheckedChange={toggleAllOnPage} aria-label="Select all" />
                  </TableHead>
                  <TableHead className="cursor-pointer" onClick={() => toggleSort('full_name')}>Name {sortIcon('full_name')}</TableHead>
                  <TableHead className="cursor-pointer" onClick={() => toggleSort('current_title')}>Title {sortIcon('current_title')}</TableHead>
                  <TableHead className="cursor-pointer" onClick={() => toggleSort('current_company')}>Company {sortIcon('current_company')}</TableHead>
                  <TableHead>Industry</TableHead>
                  <TableHead className="cursor-pointer" onClick={() => toggleSort('location')}>Location {sortIcon('location')}</TableHead>
                  <TableHead>Languages</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead className="cursor-pointer" onClick={() => toggleSort('source')}>Source {sortIcon('source')}</TableHead>
                  <TableHead className="cursor-pointer text-right" onClick={() => toggleSort('matchScore')}>Match {sortIcon('matchScore')}</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && (
                  <TableRow><TableCell colSpan={11} className="text-center py-12">
                    <Loader2 className="h-5 w-5 animate-spin inline mr-2" /> Searching Lusha & Vibe Prospecting…
                  </TableCell></TableRow>
                )}
                {!loading && pageRows.map((r) => (
                  <TableRow key={r.id} data-state={selected.has(r.id) ? 'selected' : undefined}>
                    <TableCell>
                      <Checkbox checked={selected.has(r.id)} onCheckedChange={() => toggleOne(r.id)} aria-label={`Select ${r.full_name}`} />
                    </TableCell>
                    <TableCell className="font-medium">
                      {r.full_name}
                      {r.matchReasons && r.matchReasons.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {r.matchReasons.slice(0, 4).map((reason, i) => (
                            <span key={i} className="text-[11px] text-muted-foreground">{reason}</span>
                          ))}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{r.current_title || '—'}</TableCell>
                    <TableCell>{r.current_company || '—'}</TableCell>
                    <TableCell className="text-muted-foreground">{r.industry || '—'}</TableCell>
                    <TableCell className="text-muted-foreground">{r.location || '—'}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {r.languages.length ? r.languages.join(', ') : '—'}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {r.email && <a href={`mailto:${r.email}`} title={r.email} className="text-muted-foreground hover:text-foreground"><Mail className="h-4 w-4" /></a>}
                        {r.phone && <a href={`tel:${r.phone}`} title={r.phone} className="text-muted-foreground hover:text-foreground"><Phone className="h-4 w-4" /></a>}
                        {r.linkedin_url && <a href={r.linkedin_url} target="_blank" rel="noreferrer" title="LinkedIn" className="text-muted-foreground hover:text-foreground"><Linkedin className="h-4 w-4" /></a>}
                        {!r.email && !r.phone && !r.linkedin_url && <span className="text-xs text-muted-foreground">—</span>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="gap-1 text-xs">{r.source}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {r.matchScore != null ? (
                        <Badge variant="outline" className={
                          r.matchScore >= 85 ? 'border-success/40 text-success bg-success/10'
                          : r.matchScore >= 70 ? 'border-warning/40 text-warning bg-warning/10'
                          : 'border-muted-foreground/30 text-muted-foreground'
                        }>{r.matchScore}%</Badge>
                      ) : <span className="text-xs text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon-sm" onClick={() => saveOne(r.id)}
                          disabled={saved.has(r.id) || importing.has(r.id)}
                          title={saved.has(r.id) ? 'Imported' : 'Import to CRM'}>
                          {importing.has(r.id) ? <Loader2 className="h-4 w-4 animate-spin" />
                            : <BookmarkPlus className={`h-4 w-4 ${saved.has(r.id) ? 'text-success' : ''}`} />}
                        </Button>
                        {r.source_url && (
                          <Button variant="ghost" size="icon-sm" asChild title="Open source">
                            <a href={r.source_url} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" /></a>
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {!loading && pageRows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center py-12 text-muted-foreground text-sm">
                      No candidates returned from connected sources.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {sorted.length > 0 && (
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-xs text-muted-foreground">
              Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, sorted.length)} of {sorted.length}
            </p>
            <Pagination className="mx-0 w-auto">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious href="#" onClick={(e) => { e.preventDefault(); setPage((p) => Math.max(1, p - 1)); }}
                    className={page === 1 ? 'pointer-events-none opacity-50' : ''} />
                </PaginationItem>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <PaginationItem key={p}>
                    <PaginationLink href="#" isActive={p === page} onClick={(e) => { e.preventDefault(); setPage(p); }}>{p}</PaginationLink>
                  </PaginationItem>
                ))}
                <PaginationItem>
                  <PaginationNext href="#" onClick={(e) => { e.preventDefault(); setPage((p) => Math.min(totalPages, p + 1)); }}
                    className={page === totalPages ? 'pointer-events-none opacity-50' : ''} />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
