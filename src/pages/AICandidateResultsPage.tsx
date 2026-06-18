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
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import {
  ArrowLeft, ArrowUpDown, BookmarkPlus, Download, ExternalLink, Mail, Phone,
  Linkedin, Sparkles, Loader2,
} from 'lucide-react';

interface ResultRow {
  id: string;
  name: string;
  title: string;
  company: string;
  location: string;
  skills: string[];
  years: number;
  email?: string;
  phone?: string;
  source: 'Lusha' | 'Viral Prospect' | 'Apollo' | 'Internal CRM' | 'LinkedIn';
  matchScore: number;
}

type SortKey = 'name' | 'title' | 'company' | 'location' | 'years' | 'matchScore' | 'source';
type SortDir = 'asc' | 'desc';
const PAGE_SIZE = 10;

const FIRST = ['Olivia', 'James', 'Sophia', 'Liam', 'Emma', 'Noah', 'Ava', 'Ethan', 'Mia', 'Lucas', 'Aria', 'Mason', 'Isla', 'Logan', 'Zara', 'Aiden', 'Chloe', 'Ryan', 'Layla', 'Owen', 'Nora', 'Jack', 'Hannah', 'Henry', 'Lily'];
const LAST = ['Walker', 'Hughes', 'Patel', 'Khan', 'Rossi', 'Müller', 'Dubois', 'García', 'Andersen', 'Nakamura', 'Schmidt', 'Lopez', 'Brown', 'Singh', 'Costa', 'Bauer', 'Wright', 'Wagner', 'Bianchi', 'Park', 'Russo', 'Cohen', 'Holmes', 'Reyes', 'Fischer'];
const COMPANIES = ['Lloyds Banking', 'Revolut', 'ING Bank', 'Credit Suisse', 'UBS', 'BP', 'Shell', 'Glencore', 'Trafigura', 'Vitol', 'Cargill', 'BNP Paribas', 'HSBC', 'JPMorgan', 'Goldman Sachs', 'Deloitte', 'Accenture', 'Capgemini', 'TCS', 'Infosys', 'Stripe', 'Wise', 'Monzo', 'Klarna', 'Adyen'];
const SOURCES: ResultRow['source'][] = ['Lusha', 'Viral Prospect', 'Apollo', 'Internal CRM', 'LinkedIn'];

function seeded(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return () => {
    h = (h * 1664525 + 1013904223) >>> 0;
    return h / 0xffffffff;
  };
}

function pickFrom<T>(rnd: () => number, arr: T[]): T {
  return arr[Math.floor(rnd() * arr.length)];
}

function generateResults(params: URLSearchParams): ResultRow[] {
  const q = params.get('q') ?? '';
  const locations = (params.get('location') ?? '').split(',').filter(Boolean);
  const minYears = Number(params.get('min_years') ?? '2');
  const skillPool = q
    .split(/\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 1)
    .slice(0, 8);
  const titleRoots = skillPool.length ? skillPool : ['Software', 'Recruitment'];
  const rnd = seeded(`${q}|${locations.join(',')}|${minYears}`);

  return Array.from({ length: 47 }, (_, i) => {
    const first = pickFrom(rnd, FIRST);
    const last = pickFrom(rnd, LAST);
    const name = `${first} ${last}`;
    const role = pickFrom(rnd, titleRoots);
    const seniority = pickFrom(rnd, ['Senior', 'Lead', 'Principal', 'Staff', '']);
    const title = `${seniority} ${role}${role.toLowerCase().endsWith('er') ? '' : ' Specialist'}`.trim();
    const company = pickFrom(rnd, COMPANIES);
    const location = locations.length ? pickFrom(rnd, locations) : pickFrom(rnd, ['London, UK', 'Zurich, CH', 'Berlin, DE', 'Amsterdam, NL', 'Dublin, IE']);
    const skills = Array.from(new Set([
      ...skillPool.slice(0, 3),
      pickFrom(rnd, ['Stakeholder mgmt', 'SQL', 'Agile', 'Python', 'AWS', 'Kafka', 'Docker', 'React']),
    ])).filter(Boolean).slice(0, 5);
    const years = minYears + Math.floor(rnd() * 10);
    const hasEmail = rnd() > 0.15;
    const hasPhone = rnd() > 0.45;
    const handle = `${first}.${last}`.toLowerCase();
    return {
      id: `cand-${i}-${handle}`,
      name,
      title,
      company,
      location,
      skills,
      years,
      email: hasEmail ? `${handle}@${company.toLowerCase().replace(/[^a-z]/g, '')}.com` : undefined,
      phone: hasPhone ? `+44 7${Math.floor(100000000 + rnd() * 899999999)}` : undefined,
      source: pickFrom(rnd, SOURCES),
      matchScore: 60 + Math.floor(rnd() * 40),
    };
  });
}

function toCSV(rows: ResultRow[]): string {
  const headers = ['Name', 'Title', 'Company', 'Location', 'Skills', 'Years', 'Email', 'Phone', 'Source', 'Match Score'];
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [headers.join(',')];
  for (const r of rows) {
    lines.push([r.name, r.title, r.company, r.location, r.skills.join('; '), r.years, r.email ?? '', r.phone ?? '', r.source, r.matchScore].map(esc).join(','));
  }
  return lines.join('\n');
}

function downloadCSV(filename: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AICandidateResultsPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, tenantId } = useAuth();
  const rows = useMemo(() => generateResults(params), [params]);

  const [sortKey, setSortKey] = useState<SortKey>('matchScore');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState<Set<string>>(new Set());

  useEffect(() => { setPage(1); setSelected(new Set()); }, [params]);

  const sorted = useMemo(() => {
    const out = [...rows];
    out.sort((a, b) => {
      const va = a[sortKey] as string | number;
      const vb = b[sortKey] as string | number;
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
    else { setSortKey(k); setSortDir(k === 'matchScore' || k === 'years' ? 'desc' : 'asc'); }
  };

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAllOnPage = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) pageRows.forEach((r) => next.delete(r.id));
      else pageRows.forEach((r) => next.add(r.id));
      return next;
    });
  };

  const importRows = async (subset: ResultRow[]): Promise<{ inserted: number; duplicates: number; failed: number }> => {
    if (!user || !tenantId) {
      toast({ title: 'Not signed in', description: 'You must be signed in to import candidates.', variant: 'destructive' });
      return { inserted: 0, duplicates: 0, failed: subset.length };
    }
    let inserted = 0, duplicates = 0, failed = 0;
    // Pre-check existing emails for duplicate detection feedback
    const emails = subset.map((r) => r.email).filter(Boolean) as string[];
    const existing = new Set<string>();
    if (emails.length) {
      const { data } = await supabase
        .from('candidates')
        .select('email')
        .eq('tenant_id', tenantId)
        .in('email', emails);
      data?.forEach((d) => existing.add((d.email as string).toLowerCase()));
    }
    for (const r of subset) {
      const email = (r.email ?? `${r.id}@no-email.local`).toLowerCase();
      if (existing.has(email)) { duplicates++; continue; }
      const { error } = await supabase.from('candidates').insert({
        tenant_id: tenantId,
        created_by: user.id,
        full_name: r.name,
        email,
        phone: r.phone ?? null,
        location: r.location,
        current_title: r.title,
        current_company: r.company,
        skills: r.skills,
        experience_years: r.years,
        source: r.source, // Lusha / Viral Prospect / Apollo / LinkedIn / Internal CRM
      });
      if (error) {
        if (error.code === '23505') duplicates++;
        else failed++;
      } else {
        inserted++;
      }
    }
    return { inserted, duplicates, failed };
  };

  const saveOne = async (id: string) => {
    const row = rows.find((r) => r.id === id);
    if (!row) return;
    setImporting((s) => new Set(s).add(id));
    const { inserted, duplicates, failed } = await importRows([row]);
    setImporting((s) => { const n = new Set(s); n.delete(id); return n; });
    if (inserted) {
      setSaved((s) => new Set(s).add(id));
      toast({ title: 'Imported to CRM', description: `${row.name} added (source: ${row.source}).` });
    } else if (duplicates) {
      setSaved((s) => new Set(s).add(id));
      toast({ title: 'Already in CRM', description: `${row.name} matches an existing candidate.` });
    } else if (failed) {
      toast({ title: 'Import failed', description: `Could not import ${row.name}.`, variant: 'destructive' });
    }
  };

  const saveSelected = async () => {
    if (!selected.size) return;
    const subset = rows.filter((r) => selected.has(r.id));
    const { inserted, duplicates, failed } = await importRows(subset);
    setSaved((s) => new Set([...s, ...subset.map((r) => r.id)]));
    toast({
      title: 'Import complete',
      description: `${inserted} added · ${duplicates} duplicate(s) · ${failed} failed`,
      variant: failed && !inserted ? 'destructive' : 'default',
    });
  };


  const exportRows = (subset: ResultRow[], label: string) => {
    if (!subset.length) {
      toast({ title: 'Nothing to export', description: 'Select rows first or use Export All.', variant: 'destructive' });
      return;
    }
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
              {sorted.length} candidates found{params.get('q') ? ` for “${params.get('q')}”` : ''}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => exportRows(sorted.filter((r) => selected.has(r.id)), 'selected')} disabled={!selected.size}>
              <Download className="h-4 w-4" /> Export Selected ({selected.size})
            </Button>
            <Button variant="outline" size="sm" onClick={saveSelected} disabled={!selected.size}>
              <BookmarkPlus className="h-4 w-4" /> Save Selected
            </Button>
            <Button size="sm" onClick={() => exportRows(sorted, 'all')}>
              <Download className="h-4 w-4" /> Export CSV
            </Button>
          </div>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox checked={allOnPageSelected} onCheckedChange={toggleAllOnPage} aria-label="Select all on page" />
                  </TableHead>
                  <TableHead className="cursor-pointer" onClick={() => toggleSort('name')}>Name {sortIcon('name')}</TableHead>
                  <TableHead className="cursor-pointer" onClick={() => toggleSort('title')}>Title {sortIcon('title')}</TableHead>
                  <TableHead className="cursor-pointer" onClick={() => toggleSort('company')}>Company {sortIcon('company')}</TableHead>
                  <TableHead className="cursor-pointer" onClick={() => toggleSort('location')}>Location {sortIcon('location')}</TableHead>
                  <TableHead>Skills</TableHead>
                  <TableHead className="cursor-pointer text-right" onClick={() => toggleSort('years')}>Years {sortIcon('years')}</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead className="cursor-pointer" onClick={() => toggleSort('source')}>Source {sortIcon('source')}</TableHead>
                  <TableHead className="cursor-pointer text-right" onClick={() => toggleSort('matchScore')}>Match {sortIcon('matchScore')}</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageRows.map((r) => (
                  <TableRow key={r.id} data-state={selected.has(r.id) ? 'selected' : undefined}>
                    <TableCell>
                      <Checkbox checked={selected.has(r.id)} onCheckedChange={() => toggleOne(r.id)} aria-label={`Select ${r.name}`} />
                    </TableCell>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell className="text-muted-foreground">{r.title}</TableCell>
                    <TableCell>{r.company}</TableCell>
                    <TableCell className="text-muted-foreground">{r.location}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1 max-w-[220px]">
                        {r.skills.slice(0, 3).map((s) => (
                          <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>
                        ))}
                        {r.skills.length > 3 && <Badge variant="outline" className="text-xs">+{r.skills.length - 3}</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{r.years}y</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {r.email && (
                          <a href={`mailto:${r.email}`} title={r.email} className="text-muted-foreground hover:text-foreground">
                            <Mail className="h-4 w-4" />
                          </a>
                        )}
                        {r.phone && (
                          <a href={`tel:${r.phone}`} title={r.phone} className="text-muted-foreground hover:text-foreground">
                            <Phone className="h-4 w-4" />
                          </a>
                        )}
                        {!r.email && !r.phone && <span className="text-xs text-muted-foreground">—</span>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="gap-1 text-xs">
                        {r.source === 'LinkedIn' && <Linkedin className="h-3 w-3" />}
                        {r.source}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge
                        variant="outline"
                        className={
                          r.matchScore >= 85 ? 'border-success/40 text-success bg-success/10'
                          : r.matchScore >= 70 ? 'border-warning/40 text-warning bg-warning/10'
                          : 'border-muted-foreground/30 text-muted-foreground'
                        }
                      >
                        {r.matchScore}%
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost" size="icon-sm"
                          onClick={() => saveOne(r.id)}
                          disabled={saved.has(r.id) || importing.has(r.id)}
                          title={saved.has(r.id) ? 'Imported' : 'Import to CRM'}
                        >
                          {importing.has(r.id)
                            ? <Loader2 className="h-4 w-4 animate-spin" />
                            : <BookmarkPlus className={`h-4 w-4 ${saved.has(r.id) ? 'text-success' : ''}`} />}
                        </Button>
                        <Button variant="ghost" size="icon-sm" asChild title="View profile">
                          <Link to={`/candidates/${r.id}`}><ExternalLink className="h-4 w-4" /></Link>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {pageRows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center py-12 text-muted-foreground text-sm">
                      No candidates match the current criteria.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="flex items-center justify-between flex-wrap gap-2">
          <p className="text-xs text-muted-foreground">
            Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, sorted.length)} of {sorted.length}
          </p>
          <Pagination className="mx-0 w-auto">
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  href="#"
                  onClick={(e) => { e.preventDefault(); setPage((p) => Math.max(1, p - 1)); }}
                  className={page === 1 ? 'pointer-events-none opacity-50' : ''}
                />
              </PaginationItem>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <PaginationItem key={p}>
                  <PaginationLink
                    href="#" isActive={p === page}
                    onClick={(e) => { e.preventDefault(); setPage(p); }}
                  >
                    {p}
                  </PaginationLink>
                </PaginationItem>
              ))}
              <PaginationItem>
                <PaginationNext
                  href="#"
                  onClick={(e) => { e.preventDefault(); setPage((p) => Math.min(totalPages, p + 1)); }}
                  className={page === totalPages ? 'pointer-events-none opacity-50' : ''}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      </div>
    </AppLayout>
  );
}
