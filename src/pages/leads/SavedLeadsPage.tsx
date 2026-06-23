import { useEffect, useMemo, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/auth';
import {
  DndContext, DragEndEvent, PointerSensor, useSensor, useSensors,
  useDraggable, useDroppable, DragOverlay, DragStartEvent,
} from '@dnd-kit/core';
import {
  Loader2, Mail, Phone, Linkedin, Building2, Search, Clock, StickyNote,
  LayoutGrid, Table as TableIcon, GripVertical,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { normalizeLinkedInUrl, openLinkedInUrl } from '@/lib/discovery';

type LeadStatus =
  | 'new' | 'contacted' | 'follow_up' | 'meeting_booked'
  | 'proposal_sent' | 'negotiation' | 'client_won' | 'lost';

const STATUSES: { value: LeadStatus; label: string; color: string }[] = [
  { value: 'new', label: 'New', color: 'bg-slate-500' },
  { value: 'contacted', label: 'Contacted', color: 'bg-blue-500' },
  { value: 'follow_up', label: 'Follow Up', color: 'bg-amber-500' },
  { value: 'meeting_booked', label: 'Meeting Booked', color: 'bg-violet-500' },
  { value: 'proposal_sent', label: 'Proposal Sent', color: 'bg-indigo-500' },
  { value: 'negotiation', label: 'Negotiation', color: 'bg-orange-500' },
  { value: 'client_won', label: 'Client Won', color: 'bg-emerald-600' },
  { value: 'lost', label: 'Lost', color: 'bg-rose-500' },
];

interface LeadRow {
  id: string;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  title: string | null;
  linkedin_url: string | null;
  status: LeadStatus;
  notes: string | null;
  company_id: string | null;
  updated_at: string;
  created_at: string;
  lead_companies?: { id: string; name: string | null; domain: string | null } | null;
}

interface Activity {
  id: string;
  activity_type: string;
  subject: string | null;
  notes: string | null;
  occurred_at: string;
}

function statusMeta(s: LeadStatus) {
  return STATUSES.find(x => x.value === s) ?? STATUSES[0];
}

function displayName(l: LeadRow) {
  return l.full_name || [l.first_name, l.last_name].filter(Boolean).join(' ') || l.email || 'Unnamed lead';
}

interface CompanyRow {
  id: string;
  name: string | null;
  domain: string | null;
  website: string | null;
  linkedin_url: string | null;
  industry: string | null;
  country: string | null;
  city: string | null;
  enrichment_source: string | null;
  created_at: string;
  updated_at: string;
}

export default function SavedLeadsPage() {
  const { tenantId } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [search, setSearch] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selected, setSelected] = useState<LeadRow | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [noteDraft, setNoteDraft] = useState('');
  const [newActivity, setNewActivity] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const load = async () => {
    if (!tenantId) return;
    setLoading(true);
    const [{ data, error }, { data: cData, error: cErr }] = await Promise.all([
      supabase
        .from('lead_contacts')
        .select('id, full_name, first_name, last_name, email, phone, title, linkedin_url, status, notes, company_id, updated_at, created_at, lead_companies(id, name, domain)')
        .is('deleted_at', null)
        .order('updated_at', { ascending: false })
        .limit(500),
      supabase
        .from('lead_companies')
        .select('id, name, domain, website, linkedin_url, industry, country, city, enrichment_source, created_at, updated_at')
        .is('deleted_at', null)
        .order('updated_at', { ascending: false })
        .limit(500),
    ]);
    if (error) {
      toast({ title: 'Failed to load leads', description: error.message, variant: 'destructive' });
    } else {
      setLeads((data as any[]) ?? []);
    }
    if (cErr) {
      toast({ title: 'Failed to load companies', description: cErr.message, variant: 'destructive' });
    } else {
      setCompanies((cData as any[]) ?? []);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [tenantId]);


  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return leads;
    return leads.filter(l =>
      displayName(l).toLowerCase().includes(q) ||
      (l.email ?? '').toLowerCase().includes(q) ||
      (l.title ?? '').toLowerCase().includes(q) ||
      (l.lead_companies?.name ?? '').toLowerCase().includes(q)
    );
  }, [leads, search]);

  const grouped = useMemo(() => {
    const map = new Map<LeadStatus, LeadRow[]>();
    STATUSES.forEach(s => map.set(s.value, []));
    filtered.forEach(l => map.get(l.status)?.push(l));
    return map;
  }, [filtered]);

  const updateStatus = async (id: string, status: LeadStatus) => {
    const prev = leads;
    setLeads(ls => ls.map(l => l.id === id ? { ...l, status } : l));
    const { error } = await supabase.from('lead_contacts').update({ status }).eq('id', id);
    if (error) {
      setLeads(prev);
      toast({ title: 'Update failed', description: error.message, variant: 'destructive' });
      return;
    }
    const lead = prev.find(l => l.id === id);
    await supabase.from('lead_activities').insert({
      tenant_id: tenantId,
      contact_id: id,
      company_id: lead?.company_id ?? null,
      activity_type: 'status_change',
      subject: `Status → ${statusMeta(status).label}`,
      performed_by: (await supabase.auth.getUser()).data.user?.id ?? null,
    });
  };

  const onDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));
  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const id = String(e.active.id);
    const overId = e.over?.id ? String(e.over.id) : null;
    if (!overId) return;
    const status = overId as LeadStatus;
    if (!STATUSES.find(s => s.value === status)) return;
    const lead = leads.find(l => l.id === id);
    if (!lead || lead.status === status) return;
    updateStatus(id, status);
  };

  const openDetail = async (lead: LeadRow) => {
    setSelected(lead);
    setNoteDraft(lead.notes ?? '');
    setActivityLoading(true);
    const { data } = await supabase
      .from('lead_activities')
      .select('id, activity_type, subject, notes, occurred_at')
      .eq('contact_id', lead.id)
      .is('deleted_at', null)
      .order('occurred_at', { ascending: false })
      .limit(100);
    setActivities((data as Activity[]) ?? []);
    setActivityLoading(false);
  };

  const saveNote = async () => {
    if (!selected) return;
    setSavingNote(true);
    const { error } = await supabase
      .from('lead_contacts')
      .update({ notes: noteDraft })
      .eq('id', selected.id);
    setSavingNote(false);
    if (error) {
      toast({ title: 'Failed to save note', description: error.message, variant: 'destructive' });
      return;
    }
    setLeads(ls => ls.map(l => l.id === selected.id ? { ...l, notes: noteDraft } : l));
    setSelected(s => s ? { ...s, notes: noteDraft } : s);
    toast({ title: 'Notes saved' });
  };

  const addActivity = async () => {
    if (!selected || !newActivity.trim()) return;
    const userId = (await supabase.auth.getUser()).data.user?.id ?? null;
    const { data, error } = await supabase.from('lead_activities').insert({
      tenant_id: tenantId,
      contact_id: selected.id,
      company_id: selected.company_id,
      activity_type: 'note',
      subject: newActivity.trim().slice(0, 120),
      notes: newActivity.trim(),
      performed_by: userId,
    }).select('id, activity_type, subject, notes, occurred_at').single();
    if (error) {
      toast({ title: 'Failed to log activity', description: error.message, variant: 'destructive' });
      return;
    }
    setActivities(a => [data as Activity, ...a]);
    setNewActivity('');
  };

  return (
    <AppLayout>
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold">Saved Leads</h1>
            <p className="text-sm text-muted-foreground">Manage your lead pipeline from contact to close.</p>
          </div>
          <div className="relative w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search leads…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        <Tabs defaultValue="companies">
          <TabsList>
            <TabsTrigger value="companies"><Building2 className="w-4 h-4 mr-2" />Companies ({companies.length})</TabsTrigger>
            <TabsTrigger value="kanban"><LayoutGrid className="w-4 h-4 mr-2" />Kanban</TabsTrigger>
            <TabsTrigger value="table"><TableIcon className="w-4 h-4 mr-2" />Contacts Table</TabsTrigger>
          </TabsList>

          <TabsContent value="companies" className="mt-4">
            <Card>
              <CardContent className="p-0">
                {loading ? (
                  <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Company</TableHead>
                        <TableHead>Industry</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead>Source</TableHead>
                        <TableHead>Links</TableHead>
                        <TableHead>Saved</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {companies
                        .filter(c => !search.trim() || (c.name ?? '').toLowerCase().includes(search.trim().toLowerCase()) || (c.domain ?? '').toLowerCase().includes(search.trim().toLowerCase()))
                        .map(c => (
                          <TableRow key={c.id}>
                            <TableCell className="font-medium">{c.name ?? '—'}</TableCell>
                            <TableCell className="text-muted-foreground">{c.industry ?? '—'}</TableCell>
                            <TableCell className="text-muted-foreground">{[c.city, c.country].filter(Boolean).join(', ') || '—'}</TableCell>
                            <TableCell><Badge variant="outline">{c.enrichment_source ?? 'manual'}</Badge></TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                {c.website && <a href={c.website} target="_blank" rel="noreferrer" className="text-primary"><Building2 className="w-4 h-4" /></a>}
                                {(() => { const u = normalizeLinkedInUrl(c.linkedin_url); return u ? <button type="button" onClick={() => openLinkedInUrl(u)} className="text-primary"><Linkedin className="w-4 h-4" /></button> : null; })()}
                              </div>
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm">{formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}</TableCell>
                          </TableRow>
                        ))}
                      {companies.length === 0 && (
                        <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No saved companies yet. Save companies from Prospect Search to see them here.</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>


          <TabsContent value="kanban" className="mt-4">
            {loading ? (
              <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
            ) : (
              <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
                <div className="flex gap-4 overflow-x-auto pb-4">
                  {STATUSES.map(col => (
                    <KanbanColumn key={col.value} status={col.value} label={col.label} color={col.color}
                      leads={grouped.get(col.value) ?? []} onOpen={openDetail} />
                  ))}
                </div>
                <DragOverlay>
                  {activeId ? (() => {
                    const l = leads.find(x => x.id === activeId);
                    return l ? <LeadCard lead={l} dragging /> : null;
                  })() : null}
                </DragOverlay>
              </DndContext>
            )}
          </TabsContent>

          <TabsContent value="table" className="mt-4">
            <Card>
              <CardContent className="p-0">
                {loading ? (
                  <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Title</TableHead>
                        <TableHead>Company</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Updated</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map(l => (
                        <TableRow key={l.id} className="cursor-pointer" onClick={() => openDetail(l)}>
                          <TableCell className="font-medium">{displayName(l)}</TableCell>
                          <TableCell className="text-muted-foreground">{l.title ?? '—'}</TableCell>
                          <TableCell>{l.lead_companies?.name ?? '—'}</TableCell>
                          <TableCell className="text-muted-foreground">{l.email ?? '—'}</TableCell>
                          <TableCell onClick={e => e.stopPropagation()}>
                            <Select value={l.status} onValueChange={(v) => updateStatus(l.id, v as LeadStatus)}>
                              <SelectTrigger className="h-8 w-[160px]"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {formatDistanceToNow(new Date(l.updated_at), { addSuffix: true })}
                          </TableCell>
                        </TableRow>
                      ))}
                      {filtered.length === 0 && (
                        <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No saved leads yet.</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle>{displayName(selected)}</SheetTitle>
                <SheetDescription>
                  {selected.title ?? '—'}{selected.lead_companies?.name ? ` · ${selected.lead_companies.name}` : ''}
                </SheetDescription>
              </SheetHeader>

              <div className="mt-4 space-y-2 text-sm">
                {selected.email && <div className="flex items-center gap-2"><Mail className="w-4 h-4 text-muted-foreground" /> {selected.email}</div>}
                {selected.phone && <div className="flex items-center gap-2"><Phone className="w-4 h-4 text-muted-foreground" /> {selected.phone}</div>}
                {(() => {
                  const linkedInUrl = normalizeLinkedInUrl(selected.linkedin_url);
                  return linkedInUrl ? <button type="button" onClick={() => openLinkedInUrl(linkedInUrl)} className="flex items-center gap-2 text-primary hover:underline"><Linkedin className="w-4 h-4" /> LinkedIn</button> : null;
                })()}
                {selected.lead_companies?.domain && <div className="flex items-center gap-2"><Building2 className="w-4 h-4 text-muted-foreground" /> {selected.lead_companies.domain}</div>}
              </div>

              <div className="mt-6">
                <label className="text-sm font-medium">Status</label>
                <Select value={selected.status} onValueChange={(v) => { updateStatus(selected.id, v as LeadStatus); setSelected(s => s ? { ...s, status: v as LeadStatus } : s); }}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="mt-6">
                <div className="flex items-center gap-2 text-sm font-medium mb-2"><StickyNote className="w-4 h-4" /> Notes</div>
                <Textarea rows={5} value={noteDraft} onChange={e => setNoteDraft(e.target.value)} placeholder="Add notes about this lead…" />
                <div className="flex justify-end mt-2">
                  <Button size="sm" onClick={saveNote} disabled={savingNote}>
                    {savingNote && <Loader2 className="w-3 h-3 mr-2 animate-spin" />} Save notes
                  </Button>
                </div>
              </div>

              <div className="mt-8">
                <div className="flex items-center gap-2 text-sm font-medium mb-2"><Clock className="w-4 h-4" /> Activity timeline</div>
                <div className="flex gap-2 mb-3">
                  <Input placeholder="Log activity (call, email, meeting…)" value={newActivity} onChange={e => setNewActivity(e.target.value)} />
                  <Button size="sm" onClick={addActivity} disabled={!newActivity.trim()}>Add</Button>
                </div>
                {activityLoading ? (
                  <div className="flex justify-center py-6"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>
                ) : activities.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No activity yet.</p>
                ) : (
                  <ol className="relative border-l border-border ml-2 space-y-4">
                    {activities.map(a => (
                      <li key={a.id} className="ml-4">
                        <div className="absolute -left-1.5 w-3 h-3 rounded-full bg-primary" />
                        <time className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(a.occurred_at), { addSuffix: true })}</time>
                        <p className="text-sm font-medium">{a.subject ?? a.activity_type}</p>
                        {a.notes && <p className="text-sm text-muted-foreground whitespace-pre-wrap">{a.notes}</p>}
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </AppLayout>
  );
}

function KanbanColumn({ status, label, color, leads, onOpen }: {
  status: LeadStatus; label: string; color: string; leads: LeadRow[]; onOpen: (l: LeadRow) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <div ref={setNodeRef}
      className={`flex-shrink-0 w-72 bg-muted/30 rounded-lg p-3 transition-colors ${isOver ? 'bg-muted/60 ring-2 ring-primary/30' : ''}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${color}`} />
          <h3 className="text-sm font-semibold">{label}</h3>
        </div>
        <Badge variant="secondary">{leads.length}</Badge>
      </div>
      <div className="space-y-2 min-h-[100px]">
        {leads.map(l => <DraggableLeadCard key={l.id} lead={l} onOpen={() => onOpen(l)} />)}
      </div>
    </div>
  );
}

function DraggableLeadCard({ lead, onOpen }: { lead: LeadRow; onOpen: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: lead.id });
  return (
    <div ref={setNodeRef} {...attributes} style={{ opacity: isDragging ? 0.4 : 1 }}>
      <LeadCard lead={lead} dragHandleProps={listeners} onOpen={onOpen} />
    </div>
  );
}

function LeadCard({ lead, dragging, dragHandleProps, onOpen }: {
  lead: LeadRow; dragging?: boolean; dragHandleProps?: any; onOpen?: () => void;
}) {
  return (
    <Card className={`cursor-pointer hover:shadow-md transition ${dragging ? 'shadow-lg' : ''}`} onClick={onOpen}>
      <CardContent className="p-3">
        <div className="flex items-start gap-2">
          <button {...dragHandleProps} onClick={e => e.stopPropagation()} className="text-muted-foreground hover:text-foreground mt-0.5 cursor-grab">
            <GripVertical className="w-4 h-4" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">{displayName(lead)}</p>
            {lead.title && <p className="text-xs text-muted-foreground truncate">{lead.title}</p>}
            {lead.lead_companies?.name && <p className="text-xs text-muted-foreground truncate">{lead.lead_companies.name}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
