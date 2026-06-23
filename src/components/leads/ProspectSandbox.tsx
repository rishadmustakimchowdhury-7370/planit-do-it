import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  Building2, Linkedin, ExternalLink, Loader2, Bookmark, Download, UserPlus,
  StickyNote, Eye, Sparkles, CheckCircle2, Circle,
} from 'lucide-react';
import {
  DEMO_TABS, getDemoCompanies, type DemoCompany, type DemoDataset,
} from '@/lib/apolloDemoData';

type Recruiter = { id: string; full_name: string | null; email: string | null };

const WORKFLOW_STEPS = [
  { id: 'search', label: 'Search Prospect' },
  { id: 'save', label: 'Save to CRM' },
  { id: 'assign', label: 'Assign Recruiter' },
  { id: 'pipeline', label: 'Move to Pipeline' },
  { id: 'notes', label: 'Add Notes' },
  { id: 'export', label: 'Export CSV' },
] as const;
type StepId = typeof WORKFLOW_STEPS[number]['id'];

const scorePillClass = (n: number) =>
  n >= 85
    ? 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30'
    : n >= 70
      ? 'bg-amber-500/15 text-amber-700 border-amber-500/30'
      : 'bg-muted text-muted-foreground border-border';

export function ProspectSandbox({ tenantId }: { tenantId: string | null }) {
  const { toast } = useToast();
  const [dataset, setDataset] = useState<DemoDataset>('recruitment');
  const [companies, setCompanies] = useState<DemoCompany[]>(() => getDemoCompanies('recruitment'));
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [bulkSaving, setBulkSaving] = useState(false);
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [assignments, setAssignments] = useState<Record<string, string>>({}); // companyId -> recruiterId
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [recruiters, setRecruiters] = useState<Recruiter[]>([]);
  const [stepsDone, setStepsDone] = useState<Set<StepId>>(new Set(['search']));

  const [assignDialog, setAssignDialog] = useState<{ ids: string[] } | null>(null);
  const [assignRecruiter, setAssignRecruiter] = useState<string>('');
  const [noteDialog, setNoteDialog] = useState<{ id: string } | null>(null);
  const [noteDraft, setNoteDraft] = useState('');

  useEffect(() => {
    setCompanies(getDemoCompanies(dataset));
    setSelected(new Set());
  }, [dataset]);

  useEffect(() => {
    if (!tenantId) return;
    (async () => {
      const { data: roles } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .eq('tenant_id', tenantId)
        .in('role', ['owner', 'manager', 'recruiter']);
      const ids = Array.from(new Set((roles ?? []).map((r: any) => r.user_id)));
      if (!ids.length) { setRecruiters([]); return; }
      const { data: profs } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', ids);
      setRecruiters((profs ?? []) as Recruiter[]);
    })();
  }, [tenantId]);

  const markStep = (s: StepId) => setStepsDone((prev) => new Set(prev).add(s));

  const allSelected = companies.length > 0 && companies.every((c) => selected.has(c.id));
  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(companies.map((c) => c.id)));
  const toggleOne = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const drawerCompany = useMemo(
    () => companies.find((c) => c.id === drawerId) ?? null,
    [companies, drawerId],
  );

  const recruiterLabel = (id: string) =>
    recruiters.find((r) => r.id === id)?.full_name ||
    recruiters.find((r) => r.id === id)?.email ||
    'Recruiter';

  // ---- Save ----
  const saveCompany = async (c: DemoCompany): Promise<{ ok: boolean; companyId?: string }> => {
    const { data, error } = await supabase.functions.invoke('save-leads', {
      body: {
        mode: 'lead',
        company: {
          name: c.name,
          website: c.website_url,
          linkedin_url: c.linkedin_url,
          industry: c.industry,
          employee_count: c.estimated_num_employees,
          city: c.city,
          country: c.country,
        },
        contact: {
          first_name: c.contact.first_name,
          last_name: c.contact.last_name,
          full_name: c.contact.full_name,
          title: c.contact.title,
          email: c.contact.email,
          linkedin_url: c.contact.linkedin_url,
          city: c.city,
          country: c.country,
        },
      },
    });
    if (error || data?.error) return { ok: false };
    const companyId = data?.details?.[0]?.company?.id;
    return { ok: true, companyId };
  };

  const persistNote = async (companyId: string, text: string) => {
    if (!tenantId || !text.trim()) return;
    await supabase.from('lead_activities').insert({
      tenant_id: tenantId,
      company_id: companyId,
      activity_type: 'note',
      subject: 'Demo note',
      notes: text,
      occurred_at: new Date().toISOString(),
      metadata: { source: 'apollo_demo' },
    });
  };

  const persistAssignment = async (companyId: string, recruiterId: string) => {
    if (!tenantId) return;
    await supabase.from('lead_companies').update({ assigned_to: recruiterId }).eq('id', companyId);
    await supabase.from('lead_contacts').update({ assigned_to: recruiterId }).eq('company_id', companyId);
    await supabase.from('lead_activities').insert({
      tenant_id: tenantId,
      company_id: companyId,
      activity_type: 'assignment',
      subject: 'Recruiter assigned',
      notes: `Assigned to ${recruiterLabel(recruiterId)}`,
      occurred_at: new Date().toISOString(),
      assigned_to: recruiterId,
      metadata: { source: 'apollo_demo' },
    });
  };

  const handleRowSave = async (c: DemoCompany) => {
    setSavingIds((s) => new Set(s).add(c.id));
    const res = await saveCompany(c);
    setSavingIds((s) => { const n = new Set(s); n.delete(c.id); return n; });
    if (!res.ok) {
      toast({ title: 'Save failed', description: c.name, variant: 'destructive' });
      return;
    }
    setSavedIds((s) => new Set(s).add(c.id));
    markStep('save');
    // Persist any staged note/assignment
    if (res.companyId) {
      if (notes[c.id]) await persistNote(res.companyId, notes[c.id]);
      if (assignments[c.id]) await persistAssignment(res.companyId, assignments[c.id]);
      if (notes[c.id]) markStep('notes');
      if (assignments[c.id]) markStep('assign');
      markStep('pipeline'); // contacts are visible in pipeline once created
    }
    toast({ title: 'Saved to CRM', description: c.name });
  };

  const handleBulkSave = async () => {
    const list = selected.size > 0 ? companies.filter((c) => selected.has(c.id)) : companies;
    if (!list.length) return;
    setBulkSaving(true);
    let ok = 0, fail = 0;
    for (const c of list) {
      const res = await saveCompany(c);
      if (res.ok) {
        ok++;
        setSavedIds((s) => new Set(s).add(c.id));
        if (res.companyId) {
          if (notes[c.id]) await persistNote(res.companyId, notes[c.id]);
          if (assignments[c.id]) await persistAssignment(res.companyId, assignments[c.id]);
        }
      } else fail++;
    }
    setBulkSaving(false);
    setSelected(new Set());
    markStep('save');
    markStep('pipeline');
    toast({ title: 'Bulk save complete', description: `${ok} saved, ${fail} failed.` });
  };

  const handleBulkAssign = async () => {
    if (!assignDialog || !assignRecruiter) return;
    const ids = assignDialog.ids;
    setAssignments((a) => {
      const next = { ...a };
      ids.forEach((id) => { next[id] = assignRecruiter; });
      return next;
    });
    // For already-saved companies, persist immediately. For others, save first.
    for (const id of ids) {
      const c = companies.find((x) => x.id === id);
      if (!c) continue;
      let companyDbId: string | undefined;
      if (savedIds.has(id)) {
        const { data } = await supabase
          .from('lead_companies')
          .select('id')
          .eq('tenant_id', tenantId ?? '')
          .ilike('name', c.name)
          .is('deleted_at', null)
          .maybeSingle();
        companyDbId = data?.id;
      } else {
        const res = await saveCompany(c);
        if (res.ok) {
          setSavedIds((s) => new Set(s).add(id));
          companyDbId = res.companyId;
        }
      }
      if (companyDbId) await persistAssignment(companyDbId, assignRecruiter);
    }
    markStep('assign');
    markStep('save');
    setAssignDialog(null);
    setAssignRecruiter('');
    toast({ title: 'Recruiter assigned', description: `${ids.length} prospect${ids.length === 1 ? '' : 's'} updated.` });
  };

  const handleSaveNote = async () => {
    if (!noteDialog) return;
    const id = noteDialog.id;
    const text = noteDraft.trim();
    setNotes((n) => ({ ...n, [id]: text }));
    setNoteDialog(null);
    setNoteDraft('');
    if (savedIds.has(id)) {
      const c = companies.find((x) => x.id === id);
      if (c) {
        const { data } = await supabase
          .from('lead_companies')
          .select('id')
          .eq('tenant_id', tenantId ?? '')
          .ilike('name', c.name)
          .is('deleted_at', null)
          .maybeSingle();
        if (data?.id) await persistNote(data.id, text);
      }
    }
    markStep('notes');
    toast({ title: 'Note added', description: 'Will sync to CRM on save.' });
  };

  const exportCsv = () => {
    const list = selected.size > 0 ? companies.filter((c) => selected.has(c.id)) : companies;
    if (!list.length) return;
    const headers = [
      'Company', 'Contact', 'Title', 'Industry', 'Country', 'Employees', 'Revenue',
      'Website', 'LinkedIn', 'Email', 'Phone', 'Match Score', 'Demo',
    ];
    const rows = list.map((c) => [
      c.name, c.contact.full_name, c.contact.title, c.industry, c.country,
      c.estimated_num_employees, c.revenue_range, c.website_url, c.linkedin_url,
      c.contact.email, c.contact.phone, c.match_score, 'YES',
    ]);
    const esc = (v: unknown) => {
      const s = String(v ?? '');
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [headers, ...rows].map((r) => r.map(esc).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `apollo-demo-${dataset}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    markStep('export');
  };

  return (
    <div className="space-y-4">
      {/* Workflow stepper */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center gap-1 flex-wrap text-sm">
            <span className="font-medium mr-2">Demo Workflow</span>
            {WORKFLOW_STEPS.map((s, i) => {
              const done = stepsDone.has(s.id);
              return (
                <div key={s.id} className="flex items-center gap-1">
                  {done
                    ? <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    : <Circle className="h-4 w-4 text-muted-foreground" />}
                  <span className={done ? '' : 'text-muted-foreground'}>{s.label}</span>
                  {i < WORKFLOW_STEPS.length - 1 && <span className="mx-1 text-muted-foreground">→</span>}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="gap-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle className="flex items-center gap-2 flex-wrap">
              <Sparkles className="h-5 w-5 text-amber-500" />
              Prospecting Sandbox
              <Badge variant="outline" className="border-amber-400 text-amber-600 bg-amber-50">DEMO DATA</Badge>
              <Badge variant="secondary">{companies.length} prospects</Badge>
            </CardTitle>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={toggleAll}>
                {allSelected ? 'Clear Selection' : 'Select All'}
              </Button>
              <Button size="sm" onClick={handleBulkSave} disabled={bulkSaving}>
                {bulkSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Bookmark className="h-4 w-4 mr-2" />}
                Bulk Save {selected.size > 0 ? `(${selected.size})` : ''}
              </Button>
              <Button size="sm" variant="outline" disabled={selected.size === 0}
                onClick={() => { setAssignDialog({ ids: Array.from(selected) }); setAssignRecruiter(''); }}>
                <UserPlus className="h-4 w-4 mr-2" /> Bulk Assign
              </Button>
              <Button size="sm" variant="outline" onClick={exportCsv}>
                <Download className="h-4 w-4 mr-2" /> Export CSV
              </Button>
            </div>
          </div>
          <Tabs value={dataset} onValueChange={(v) => setDataset(v as DemoDataset)}>
            <TabsList className="flex-wrap h-auto">
              {DEMO_TABS.map((t) => (
                <TabsTrigger key={t.id} value={t.id}>{t.label}</TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8">
                    <Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="Select all" />
                  </TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Industry</TableHead>
                  <TableHead>Country</TableHead>
                  <TableHead className="text-right">Employees</TableHead>
                  <TableHead>Revenue</TableHead>
                  <TableHead>Website</TableHead>
                  <TableHead>LinkedIn</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead className="text-center">Score</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {companies.map((c) => {
                  const busy = savingIds.has(c.id);
                  const saved = savedIds.has(c.id);
                  return (
                    <TableRow key={c.id} data-state={selected.has(c.id) ? 'selected' : undefined}>
                      <TableCell>
                        <Checkbox checked={selected.has(c.id)} onCheckedChange={() => toggleOne(c.id)} aria-label={`Select ${c.name}`} />
                      </TableCell>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2 min-w-[200px]">
                          <img src={c.logo_url} alt="" className="w-7 h-7 rounded shrink-0" />
                          <div className="flex flex-col">
                            <button className="text-left hover:underline" onClick={() => setDrawerId(c.id)}>
                              {c.name}
                            </button>
                            <div className="flex gap-1 mt-0.5">
                              <Badge variant="outline" className="text-[10px] border-amber-400 text-amber-600 px-1 py-0">DEMO</Badge>
                              {saved && <Badge variant="outline" className="text-[10px] border-emerald-400 text-emerald-700 px-1 py-0">SAVED</Badge>}
                              {assignments[c.id] && (
                                <Badge variant="outline" className="text-[10px] px-1 py-0">
                                  → {recruiterLabel(assignments[c.id]).split(' ')[0]}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{c.contact.full_name}</TableCell>
                      <TableCell className="text-sm">{c.contact.title}</TableCell>
                      <TableCell className="text-sm">{c.industry}</TableCell>
                      <TableCell className="text-sm">{c.country}</TableCell>
                      <TableCell className="text-right text-sm">{c.estimated_num_employees}</TableCell>
                      <TableCell className="text-sm">{c.revenue_range}</TableCell>
                      <TableCell>
                        <a href={c.website_url} target="_blank" rel="noreferrer" className="text-primary inline-flex items-center gap-1 hover:underline text-sm">
                          Visit <ExternalLink className="h-3 w-3" />
                        </a>
                      </TableCell>
                      <TableCell>
                        <a href={c.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-primary inline-flex items-center gap-1 hover:underline text-sm">
                          <Linkedin className="h-3 w-3" /> Page
                        </a>
                      </TableCell>
                      <TableCell className="text-sm">{c.contact.email}</TableCell>
                      <TableCell className="text-sm whitespace-nowrap">{c.contact.phone}</TableCell>
                      <TableCell className="text-center">
                        <span className={`inline-flex items-center justify-center text-xs font-medium border rounded px-2 py-0.5 ${scorePillClass(c.match_score)}`}>
                          {c.match_score}
                        </span>
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <Button size="icon" variant="ghost" title="Save to CRM" onClick={() => handleRowSave(c)} disabled={busy}>
                          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bookmark className="h-4 w-4" />}
                        </Button>
                        <Button size="icon" variant="ghost" title="Assign Recruiter"
                          onClick={() => { setAssignDialog({ ids: [c.id] }); setAssignRecruiter(assignments[c.id] ?? ''); }}>
                          <UserPlus className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" title="Add Note"
                          onClick={() => { setNoteDialog({ id: c.id }); setNoteDraft(notes[c.id] ?? ''); }}>
                          <StickyNote className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" title="View Company" onClick={() => setDrawerId(c.id)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Detail Drawer */}
      <Sheet open={!!drawerId} onOpenChange={(o) => !o && setDrawerId(null)}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          {drawerCompany && (
            <>
              <SheetHeader>
                <div className="flex items-center gap-3">
                  <img src={drawerCompany.logo_url} alt="" className="w-12 h-12 rounded" />
                  <div>
                    <SheetTitle className="flex items-center gap-2 flex-wrap">
                      {drawerCompany.name}
                      <Badge variant="outline" className="border-amber-400 text-amber-600 bg-amber-50">DEMO DATA</Badge>
                    </SheetTitle>
                    <div className="text-sm text-muted-foreground">{drawerCompany.industry}</div>
                  </div>
                </div>
              </SheetHeader>
              <div className="mt-5 space-y-5 text-sm">
                <div className="flex gap-2 flex-wrap">
                  <Button asChild size="sm" variant="outline">
                    <a href={drawerCompany.website_url} target="_blank" rel="noreferrer">
                      <ExternalLink className="h-4 w-4 mr-1" /> Website
                    </a>
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <a href={drawerCompany.linkedin_url} target="_blank" rel="noopener noreferrer">
                      <Linkedin className="h-4 w-4 mr-1" /> LinkedIn
                    </a>
                  </Button>
                  <Button size="sm" onClick={() => handleRowSave(drawerCompany)} disabled={savingIds.has(drawerCompany.id)}>
                    {savingIds.has(drawerCompany.id) ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Bookmark className="h-4 w-4 mr-1" />}
                    Save to CRM
                  </Button>
                </div>

                <section className="rounded-md border p-3 space-y-1.5">
                  <div className="font-medium mb-1 flex items-center gap-2"><Building2 className="h-4 w-4" /> Company Profile</div>
                  <div className="grid grid-cols-2 gap-y-1.5">
                    <div className="text-muted-foreground">Industry</div><div>{drawerCompany.industry}</div>
                    <div className="text-muted-foreground">Location</div><div>{[drawerCompany.city, drawerCompany.state, drawerCompany.country].filter(Boolean).join(', ')}</div>
                    <div className="text-muted-foreground">Employees</div><div>{drawerCompany.estimated_num_employees}</div>
                    <div className="text-muted-foreground">Revenue</div><div>{drawerCompany.revenue_range}</div>
                    <div className="text-muted-foreground">Match Score</div>
                    <div><span className={`inline-flex items-center text-xs font-medium border rounded px-2 py-0.5 ${scorePillClass(drawerCompany.match_score)}`}>{drawerCompany.match_score}</span></div>
                  </div>
                  <p className="text-muted-foreground pt-2">{drawerCompany.short_description}</p>
                </section>

                <section className="rounded-md border p-3 space-y-1.5">
                  <div className="font-medium mb-1">Primary Contact</div>
                  <div className="grid grid-cols-2 gap-y-1.5">
                    <div className="text-muted-foreground">Name</div><div>{drawerCompany.contact.full_name}</div>
                    <div className="text-muted-foreground">Title</div><div>{drawerCompany.contact.title}</div>
                    <div className="text-muted-foreground">Email</div><div className="break-all">{drawerCompany.contact.email}</div>
                    <div className="text-muted-foreground">Phone</div><div>{drawerCompany.contact.phone}</div>
                    <div className="text-muted-foreground">LinkedIn</div>
                    <div><a className="text-primary hover:underline" href={drawerCompany.contact.linkedin_url} target="_blank" rel="noopener noreferrer">View profile</a></div>
                  </div>
                </section>

                <section className="rounded-md border p-3">
                  <div className="font-medium mb-2">Notes</div>
                  <Textarea
                    rows={3}
                    placeholder="Add a note about this prospect…"
                    value={notes[drawerCompany.id] ?? ''}
                    onChange={(e) => setNotes((n) => ({ ...n, [drawerCompany.id]: e.target.value }))}
                  />
                  <p className="text-xs text-muted-foreground mt-1">Notes sync to the CRM once the prospect is saved.</p>
                </section>

                <section className="rounded-md border p-3">
                  <div className="font-medium mb-2">Activity Timeline</div>
                  <ul className="space-y-2">
                    <li className="flex gap-2"><span className="text-muted-foreground w-24 shrink-0">Just now</span><span>Enriched via Apollo demo dataset</span></li>
                    {savedIds.has(drawerCompany.id) && (
                      <li className="flex gap-2"><span className="text-muted-foreground w-24 shrink-0">Saved</span><span>Added to CRM Companies & Prospect Pipeline</span></li>
                    )}
                    {assignments[drawerCompany.id] && (
                      <li className="flex gap-2"><span className="text-muted-foreground w-24 shrink-0">Assigned</span><span>{recruiterLabel(assignments[drawerCompany.id])}</span></li>
                    )}
                    {notes[drawerCompany.id] && (
                      <li className="flex gap-2"><span className="text-muted-foreground w-24 shrink-0">Note</span><span className="whitespace-pre-wrap">{notes[drawerCompany.id]}</span></li>
                    )}
                  </ul>
                </section>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Assign dialog */}
      <Dialog open={!!assignDialog} onOpenChange={(o) => { if (!o) { setAssignDialog(null); setAssignRecruiter(''); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Recruiter</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Assigning {assignDialog?.ids.length} prospect{assignDialog?.ids.length === 1 ? '' : 's'}.
            </p>
            <Select value={assignRecruiter} onValueChange={setAssignRecruiter}>
              <SelectTrigger><SelectValue placeholder="Choose recruiter" /></SelectTrigger>
              <SelectContent>
                {recruiters.length === 0 && <SelectItem value="__none" disabled>No team members found</SelectItem>}
                {recruiters.map((r) => (
                  <SelectItem key={r.id} value={r.id}>{r.full_name || r.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setAssignDialog(null); setAssignRecruiter(''); }}>Cancel</Button>
            <Button onClick={handleBulkAssign} disabled={!assignRecruiter}>Assign</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Note dialog */}
      <Dialog open={!!noteDialog} onOpenChange={(o) => { if (!o) { setNoteDialog(null); setNoteDraft(''); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Note</DialogTitle>
          </DialogHeader>
          <Textarea rows={5} value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} placeholder="Internal note…" />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setNoteDialog(null); setNoteDraft(''); }}>Cancel</Button>
            <Button onClick={handleSaveNote} disabled={!noteDraft.trim()}>Save Note</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
