import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { CalendarClock, CheckCircle2, XCircle, Loader2, Video, Phone, MapPin, Clock } from 'lucide-react';
import { format as fmt } from 'date-fns';

interface Props {
  /** Optional: scope to a single job candidate. If omitted, lists all for tenant. */
  jobCandidateId?: string;
}

type Req = {
  id: string;
  status: string;
  meeting_format: string;
  duration_minutes: number;
  proposed_slots: any[];
  client_notes: string | null;
  recruiter_notes: string | null;
  selected_slot: any | null;
  created_at: string;
  job_id: string;
  job_candidate_id: string;
  client_org_id: string;
  tenant_id: string;
  event_id: string | null;
  client_organizations?: { name: string } | null;
};

const formatIcon = (f: string) => f === 'phone' ? Phone : f === 'onsite' ? MapPin : Video;

export function InterviewRequestsInbox({ jobCandidateId }: Props) {
  const { tenantId, user } = useAuth();
  const [items, setItems] = useState<Req[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});

  const load = async () => {
    if (!tenantId) return;
    setLoading(true);
    let q = supabase
      .from('interview_requests' as any)
      .select('*, client_organizations:client_org_id(name)')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });
    if (jobCandidateId) q = q.eq('job_candidate_id', jobCandidateId);
    const { data } = await q;
    setItems((data as any) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [tenantId, jobCandidateId]);

  useEffect(() => {
    if (!tenantId) return;
    const ch = supabase.channel(`ir-${tenantId}-${jobCandidateId || 'all'}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'interview_requests', filter: `tenant_id=eq.${tenantId}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [tenantId, jobCandidateId]);

  const accept = async (req: Req, slot: any) => {
    if (!user || !tenantId) return;
    setBusy(req.id);
    try {
      // Create event
      const { data: evt, error: evtErr } = await supabase.from('events').insert({
        tenant_id: tenantId,
        title: `Interview · ${req.client_organizations?.name || 'Client'}`,
        event_type: 'interview' as any,
        status: 'scheduled' as any,
        location_type: req.meeting_format === 'onsite' ? 'in_person' : (req.meeting_format === 'phone' ? 'phone' : 'video'),
        start_time: slot.start_time,
        end_time: slot.end_time,
        timezone: slot.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
        organizer_id: user.id,
        job_id: req.job_id,
        interview_request_id: req.id,
        description: req.client_notes || null,
        internal_notes: notesDraft[req.id] || null,
      } as any).select('id').maybeSingle();
      if (evtErr) throw evtErr;

      const { error: updErr } = await supabase
        .from('interview_requests' as any)
        .update({
          status: 'accepted',
          responded_by: user.id,
          responded_at: new Date().toISOString(),
          selected_slot: slot,
          recruiter_notes: notesDraft[req.id] || null,
          event_id: evt?.id || null,
        })
        .eq('id', req.id);
      if (updErr) throw updErr;

      toast.success('Interview confirmed and event created.');
      load();
    } catch (e: any) {
      toast.error(e.message || 'Failed to confirm');
    } finally { setBusy(null); }
  };

  const decline = async (req: Req) => {
    if (!user) return;
    setBusy(req.id);
    try {
      const { error } = await supabase.from('interview_requests' as any).update({
        status: 'declined',
        responded_by: user.id,
        responded_at: new Date().toISOString(),
        recruiter_notes: notesDraft[req.id] || null,
      }).eq('id', req.id);
      if (error) throw error;
      toast.success('Request declined.');
      load();
    } catch (e: any) {
      toast.error(e.message || 'Failed');
    } finally { setBusy(null); }
  };

  if (loading) return <Skeleton className="h-40 w-full" />;

  if (!items.length) {
    return (
      <div className="text-center py-10 text-muted-foreground">
        <CalendarClock className="h-10 w-10 mx-auto mb-2 opacity-40" />
        <p className="text-sm">No interview requests yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map(req => {
        const Icon = formatIcon(req.meeting_format);
        const statusColor =
          req.status === 'pending' ? 'bg-amber-500/10 text-amber-700 border-amber-200' :
          req.status === 'accepted' ? 'bg-emerald-500/10 text-emerald-700 border-emerald-200' :
          req.status === 'declined' ? 'bg-red-500/10 text-red-700 border-red-200' :
          'bg-muted text-muted-foreground';
        return (
          <Card key={req.id}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Icon className="h-4 w-4 text-primary" />
                    {req.client_organizations?.name || 'Client'} · {req.duration_minutes}m {req.meeting_format}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">Requested {fmt(new Date(req.created_at), 'PPp')}</p>
                </div>
                <Badge variant="outline" className={`capitalize ${statusColor}`}>{req.status}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {req.client_notes && (
                <p className="text-sm bg-muted/50 rounded-md p-3 border border-border">
                  <span className="text-xs uppercase tracking-wide text-muted-foreground font-semibold block mb-1">Client notes</span>
                  {req.client_notes}
                </p>
              )}

              <div className="space-y-2">
                <div className="text-xs uppercase tracking-wide text-muted-foreground font-semibold flex items-center gap-1.5">
                  <Clock className="h-3 w-3" /> {req.status === 'accepted' ? 'Confirmed slot' : 'Proposed slots'}
                </div>
                {(req.status === 'accepted' && req.selected_slot ? [req.selected_slot] : req.proposed_slots).map((slot: any, i: number) => (
                  <div key={i} className="flex items-center justify-between gap-2 border border-border rounded-md p-2.5">
                    <div className="text-sm">
                      <div className="font-medium">{fmt(new Date(slot.start_time), 'EEE, MMM d · p')}</div>
                      <div className="text-xs text-muted-foreground">{slot.timezone}</div>
                    </div>
                    {req.status === 'pending' && (
                      <Button size="sm" onClick={() => accept(req, slot)} disabled={busy === req.id}>
                        {busy === req.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                        Confirm
                      </Button>
                    )}
                  </div>
                ))}
              </div>

              {req.status === 'pending' && (
                <>
                  <Textarea
                    placeholder="Internal note (optional, sent to client on confirm/decline)"
                    rows={2}
                    value={notesDraft[req.id] || ''}
                    onChange={e => setNotesDraft({ ...notesDraft, [req.id]: e.target.value })}
                  />
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="outline" onClick={() => decline(req)} disabled={busy === req.id}>
                      <XCircle className="h-3.5 w-3.5" /> Decline
                    </Button>
                  </div>
                </>
              )}

              {req.recruiter_notes && req.status !== 'pending' && (
                <p className="text-xs text-muted-foreground italic border-l-2 border-border pl-3">
                  Recruiter: {req.recruiter_notes}
                </p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
