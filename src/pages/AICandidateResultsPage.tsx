import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
  Linkedin, Sparkles, Loader2, AlertCircle, Bug, Check, X as XIcon,
} from 'lucide-react';

type SearchMode = 'strict' | 'balanced' | 'broad';

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
  source: 'Apollo' | 'Lusha' | 'Vibe Prospecting' | 'LinkedIn' | 'Internal CRM' | 'Open Web Discovery';
  source_url?: string | null;
  full_name: string;
  headline?: string | null;
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
  experience_summary?: string | null;
  education?: string | null;
  seniority?: string | null;
  confidence?: number | null;
  matchScore?: number;
  matchReasons?: string[];
  matchMissing?: string[];
}


interface SearchPassDebug {
  id: string;
  label: string;
  boolean: string;
  raw: number;
  accepted?: number;
  rejected?: number;
  generatedFilters?: { titles?: string[]; industries?: string[]; locations?: string[]; countries?: string[]; searchText?: string | null; skipped?: boolean; skipReason?: string };
  requestPayload?: unknown;
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
  const { user, tenantId, isOwner } = useAuth();

  const criteria = useMemo<Criteria>(() => {
    try {
      const raw = sessionStorage.getItem('ai-discovery-criteria');
      return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
  }, []);

  const [mode, setMode] = useState<SearchMode>(() => {
    const m = sessionStorage.getItem('ai-discovery-mode');
    return (m === 'strict' || m === 'broad') ? m : 'balanced';
  });
  const [developerMode, setDeveloperMode] = useState<boolean>(() => {
    return isOwner && localStorage.getItem('ai-discovery-dev-mode') === '1';
  });

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
        body: { criteria, limit: 25, mode },
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
  }, [criteria, mode]);

  const changeMode = (m: SearchMode) => {
    sessionStorage.setItem('ai-discovery-mode', m);
    setMode(m);
  };
  const toggleDeveloperMode = () => {
    const next = !developerMode;
    setDeveloperMode(next);
    localStorage.setItem('ai-discovery-dev-mode', next ? '1' : '0');
  };


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
              {loading ? 'Searching connected sources…' : `${sorted.length} candidate${sorted.length === 1 ? '' : 's'} matched${params.get('q') ? ` for "${params.get('q')}"` : ''}`}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Search Mode selector */}
            <div className="inline-flex rounded-md border bg-background p-0.5 text-xs">
              {(['strict', 'balanced', 'broad'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => changeMode(m)}
                  className={`px-2.5 py-1 rounded ${mode === m ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                  title={m === 'strict' ? 'Very precise' : m === 'broad' ? 'Maximum discovery' : 'Recommended default'}
                >
                  {m === 'strict' ? 'Strict' : m === 'broad' ? 'Broad' : 'Balanced'}
                </button>
              ))}
            </div>
            {isOwner && (
              <Button
                variant={developerMode ? 'default' : 'outline'}
                size="sm"
                onClick={toggleDeveloperMode}
                title="Owner-only: show search-pass diagnostics, payloads, and API responses"
              >
                <Bug className="h-4 w-4" /> Developer Mode
              </Button>
            )}
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

        {/* Provider errors: shown to everyone but as a quiet info banner for non-owners */}
        {Object.entries(providerErrors).map(([p, msg]) => (
          <Alert key={p} variant={developerMode ? 'destructive' : 'default'}>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>{p}:</strong>{' '}
              {developerMode
                ? msg
                : 'temporarily unavailable — continuing with other sources.'}
            </AlertDescription>
          </Alert>
        ))}

        {errorMsg && !loading && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{errorMsg}</AlertDescription>
          </Alert>
        )}

        {/* Recruiter-facing pass progress (no payloads / no JSON) */}
        {!developerMode && queries.length > 0 && !loading && (
          <Card>
            <CardContent className="p-3">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-medium text-muted-foreground">Search passes:</span>
                {queries.map((q) => (
                  <Badge key={q.id} variant="secondary" className="gap-1">
                    <Check className="h-3 w-3" /> {q.label.replace(/^Pass \d+: /, q.id === 'crm' ? '' : `Pass ${q.id.replace('p', '')} · `)} · {q.accepted ?? 0} kept
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Developer-only diagnostics */}
        {developerMode && queries.length > 0 && (

          <Card>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold">Generated Boolean Queries & Lusha Filters</h2>
                <span className="text-xs text-muted-foreground">{queries.length} search pass{queries.length === 1 ? '' : 'es'} run</span>
              </div>
              <div className="space-y-1.5">
                {queries.map((q) => (
                  <div key={q.id} className="text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-muted-foreground">{q.label}</span>
                      <div className="flex flex-wrap justify-end gap-1">
                        <Badge variant="outline" className="text-[10px]">{q.raw} returned</Badge>
                        <Badge variant="outline" className="text-[10px]">{q.accepted ?? 0} accepted</Badge>
                        <Badge variant="outline" className="text-[10px]">{q.rejected ?? 0} rejected</Badge>
                      </div>
                    </div>
                    <code className="block mt-0.5 px-2 py-1 rounded bg-muted text-foreground/80 font-mono break-all">
                      {q.boolean || '(no filters)'}
                    </code>
                    {q.generatedFilters && (
                      <div className="mt-1 rounded border border-border bg-muted/40 p-2 space-y-1">
                        <div className="font-medium text-foreground">Generated Filters</div>
                        <div><span className="text-muted-foreground">titles:</span> {(q.generatedFilters.titles ?? []).join(', ') || '—'}</div>
                        <div><span className="text-muted-foreground">industries:</span> {(q.generatedFilters.industries ?? []).join(', ') || '—'}</div>
                        <div><span className="text-muted-foreground">locations:</span> {(q.generatedFilters.locations ?? []).join(', ') || '—'}</div>
                        <div><span className="text-muted-foreground">countries:</span> {(q.generatedFilters.countries ?? []).join(', ') || '—'}</div>
                        {q.generatedFilters.searchText && <div><span className="text-muted-foreground">searchText:</span> {q.generatedFilters.searchText}</div>}
                        {q.generatedFilters.skipReason && <div className="text-destructive">{q.generatedFilters.skipReason}</div>}
                      </div>
                    )}
                    {q.requestPayload && (
                      <div className="mt-1 rounded border border-border bg-muted/40 p-2 space-y-1">
                        <div className="font-medium text-foreground">Lusha Request Payload</div>
                        <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded bg-background/70 p-2 font-mono text-[11px] text-foreground/80">
                          {JSON.stringify(q.requestPayload, null, 2)}
                        </pre>
                      </div>
                    )}
                    {q.providers && q.providers.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {q.providers.map((p) => (
                          <Badge key={`${q.id}-${p.provider}`} variant="secondary" className="text-[10px]">
                            {p.provider}: {p.records} record{p.records === 1 ? '' : 's'}{p.error ? ' · error' : ''}
                          </Badge>
                        ))}
                      </div>
                    )}
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
                    <Loader2 className="h-5 w-5 animate-spin inline mr-2" /> Searching connected sources…
                  </TableCell></TableRow>
                )}
                {!loading && pageRows.map((r) => (
                  <TableRow key={r.id} data-state={selected.has(r.id) ? 'selected' : undefined}>
                    <TableCell>
                      <Checkbox checked={selected.has(r.id)} onCheckedChange={() => toggleOne(r.id)} aria-label={`Select ${r.full_name}`} />
                    </TableCell>
                    <TableCell className="font-medium align-top">
                      {r.full_name}
                      {(r.matchReasons?.length || r.matchMissing?.length) ? (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {(r.matchReasons ?? []).slice(0, 5).map((reason, i) => (
                            <span key={`m-${i}`} className="inline-flex items-center gap-0.5 rounded bg-success/10 text-success px-1.5 py-0.5 text-[10px] font-medium">
                              <Check className="h-2.5 w-2.5" />{reason.replace(/^✓\s*/, '')}
                            </span>
                          ))}
                          {(r.matchMissing ?? []).slice(0, 3).map((m, i) => (
                            <span key={`x-${i}`} className="inline-flex items-center gap-0.5 rounded bg-muted text-muted-foreground px-1.5 py-0.5 text-[10px] font-medium">
                              <XIcon className="h-2.5 w-2.5" />{m}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-muted-foreground align-top">{r.current_title || '—'}</TableCell>
                    <TableCell className="align-top">{r.current_company || '—'}</TableCell>
                    <TableCell className="text-muted-foreground align-top">{r.industry || '—'}</TableCell>
                    <TableCell className="text-muted-foreground align-top">{r.location || '—'}</TableCell>
                    <TableCell className="text-muted-foreground text-xs align-top">
                      {r.languages.length ? r.languages.join(', ') : '—'}
                    </TableCell>
                    <TableCell className="align-top">
                      <div className="flex gap-2">
                        {r.email && <a href={`mailto:${r.email}`} title={r.email} className="text-muted-foreground hover:text-foreground"><Mail className="h-4 w-4" /></a>}
                        {r.phone && <a href={`tel:${r.phone}`} title={r.phone} className="text-muted-foreground hover:text-foreground"><Phone className="h-4 w-4" /></a>}
                        {r.linkedin_url && <a href={r.linkedin_url} target="_blank" rel="noopener noreferrer" title="View LinkedIn Profile" className="text-muted-foreground hover:text-[#0A66C2]"><Linkedin className="h-4 w-4" /></a>}
                        {!r.email && !r.phone && !r.linkedin_url && <span className="text-xs text-muted-foreground">—</span>}
                      </div>
                    </TableCell>

                    <TableCell>
                      {(() => {
                        const s = r.source;
                        const cls =
                          s === 'Open Web Discovery' ? 'border-primary/40 text-primary bg-primary/10'
                          : s === 'LinkedIn' ? 'border-[#0A66C2]/40 text-[#0A66C2] bg-[#0A66C2]/10'
                          : s === 'Apollo' ? 'border-purple-500/40 text-purple-600 bg-purple-500/10'
                          : s === 'Lusha' ? 'border-blue-500/40 text-blue-600 bg-blue-500/10'
                          : s === 'Vibe Prospecting' ? 'border-pink-500/40 text-pink-600 bg-pink-500/10'
                          : s === 'Internal CRM' ? 'border-emerald-500/40 text-emerald-600 bg-emerald-500/10'
                          : '';
                        const title =
                          s === 'Open Web Discovery' ? 'Found via public web search (fallback)'
                          : s === 'LinkedIn' ? 'Public LinkedIn profile' : undefined;
                        return (
                          <Badge variant="outline" className={`gap-1 text-xs ${cls}`} title={title}>{s}</Badge>
                        );
                      })()}
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
                            <a href={r.source_url} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" /></a>
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
