// Lightweight tab components for the Candidate 360 profile.
// Each one is intentionally small and scoped to a single data source so the
// candidate record stays a master view of everything the team knows.
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';
import { Loader2, Mic, Square, Trash2, Briefcase, Star, Award, Trophy } from 'lucide-react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { MarkAsPlacementDialog } from '@/components/placements/MarkAsPlacementDialog';
import { normalizeLinkedInUrl } from '@/lib/discovery';

type Candidate = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  location: string | null;
  current_title: string | null;
  current_company: string | null;
  summary: string | null;
  skills: string[] | null;
  experience_years: number | null;
  status: string;
  linkedin_url: string | null;
  created_at: string;
};

/* ---------------- Overview ---------------- */
export function CandidateOverviewTab({ candidate }: { candidate: Candidate }) {
  const [stats, setStats] = useState({ submissions: 0, interviews: 0, offers: 0, placements: 0 });

  useEffect(() => {
    (async () => {
      const [{ count: subs }, { count: ints }, { data: placements }] = await Promise.all([
        supabase.from('candidate_submissions').select('id', { count: 'exact', head: true }).eq('candidate_id', candidate.id),
        supabase.from('interview_requests').select('id', { count: 'exact', head: true }).eq('job_candidate_id', candidate.id),
        supabase.from('placement_outcomes').select('outcome_type').eq('candidate_id', candidate.id),
      ]);
      const offers = (placements ?? []).filter((p: any) => p.outcome_type === 'offer').length;
      const placed = (placements ?? []).filter((p: any) => p.outcome_type === 'placed' || p.outcome_type === 'hired').length;
      setStats({ submissions: subs ?? 0, interviews: ints ?? 0, offers, placements: placed });
    })();
  }, [candidate.id]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Submissions" value={stats.submissions} icon={Briefcase} />
        <StatCard label="Interviews" value={stats.interviews} icon={Star} />
        <StatCard label="Offers" value={stats.offers} icon={Award} />
        <StatCard label="Placements" value={stats.placements} icon={Trophy} />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Profile Summary</CardTitle></CardHeader>
        <CardContent className="space-y-4 text-sm">
          <Row label="Current role" value={[candidate.current_title, candidate.current_company].filter(Boolean).join(' at ')} />
          <Row label="Experience" value={candidate.experience_years ? `${candidate.experience_years} years` : null} />
          <Row label="Location" value={candidate.location} />
          <Row label="Email" value={candidate.email} />
          <Row label="Phone" value={candidate.phone} />
          <Row label="LinkedIn" value={normalizeLinkedInUrl(candidate.linkedin_url)} isLink />
          <Row label="In system since" value={format(new Date(candidate.created_at), 'PP')} />
          {candidate.summary && (
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Summary</p>
              <p className="whitespace-pre-wrap text-foreground">{candidate.summary}</p>
            </div>
          )}
          {candidate.skills && candidate.skills.length > 0 && (
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Skills</p>
              <div className="flex flex-wrap gap-1.5">
                {candidate.skills.map((s) => <Badge key={s} variant="secondary">{s}</Badge>)}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ label, value, icon: Icon }: any) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="text-2xl font-semibold leading-none">{value}</p>
          <p className="text-xs text-muted-foreground mt-1">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function Row({ label, value, isLink }: { label: string; value: string | null | undefined; isLink?: boolean }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-4">
      <span className="text-xs uppercase tracking-wide text-muted-foreground w-32 shrink-0 pt-0.5">{label}</span>
      {isLink ? (
        <a href={value} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline break-all">{value}</a>
      ) : (
        <span className="text-foreground break-words">{value}</span>
      )}
    </div>
  );
}

/* ---------------- Voice Notes ---------------- */
export function CandidateVoiceNotesTab({ candidateId, tenantId }: { candidateId: string; tenantId: string }) {
  const { profile } = useAuth();
  const [notes, setNotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [chunks, setChunks] = useState<Blob[]>([]);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('candidate_voice_notes' as any)
      .select('*')
      .eq('candidate_id', candidateId)
      .order('created_at', { ascending: false });
    setNotes((data as any) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [candidateId]);

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      const local: Blob[] = [];
      rec.ondataavailable = (e) => { if (e.data.size > 0) local.push(e.data); };
      rec.onstop = async () => {
        setChunks(local);
        stream.getTracks().forEach((t) => t.stop());
        await transcribe(new Blob(local, { type: rec.mimeType || 'audio/webm' }));
      };
      rec.start();
      setMediaRecorder(rec);
      setRecording(true);
    } catch {
      toast.error('Microphone access denied');
    }
  };

  const stop = () => {
    mediaRecorder?.stop();
    setRecording(false);
  };

  const transcribe = async (blob: Blob) => {
    setBusy(true);
    try {
      const form = new FormData();
      form.append('file', new File([blob], 'voice-note.webm', { type: blob.type || 'audio/webm' }));
      const { data, error } = await supabase.functions.invoke('transcribe-voice-note', { body: form });
      if (error) throw error;
      setTranscript(data?.text || '');
    } catch (e: any) {
      toast.error(e?.message || 'Transcription failed');
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!transcript.trim() || !profile?.id) return;
    setBusy(true);
    try {
      const { error } = await supabase.from('candidate_voice_notes' as any).insert({
        tenant_id: tenantId,
        candidate_id: candidateId,
        author_user_id: profile.id,
        transcript: transcript.trim(),
      });
      if (error) throw error;
      toast.success('Voice note saved');
      setTranscript('');
      setChunks([]);
      load();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to save');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from('candidate_voice_notes' as any).delete().eq('id', id);
    if (error) return toast.error(error.message);
    setNotes((n) => n.filter((x) => x.id !== id));
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="text-base">Record a Voice Note</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            {!recording ? (
              <Button onClick={start} disabled={busy} className="gap-2"><Mic className="h-4 w-4" /> Start recording</Button>
            ) : (
              <Button variant="destructive" onClick={stop} className="gap-2"><Square className="h-4 w-4" /> Stop</Button>
            )}
            {busy && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </div>
          <Textarea
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            rows={4}
            placeholder="Transcript will appear here. You can edit before saving."
          />
          <div className="flex justify-end">
            <Button onClick={save} disabled={busy || !transcript.trim()}>Save voice note</Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {loading ? (
          <Skeleton className="h-24 w-full" />
        ) : notes.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No voice notes yet.</p>
        ) : notes.map((n) => (
          <Card key={n.id}>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">{format(new Date(n.created_at), 'PPp')}</p>
                <Button variant="ghost" size="icon" onClick={() => remove(n.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-sm whitespace-pre-wrap">{n.transcript}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

/* ---------------- Client Submissions ---------------- */
export function CandidateClientSubmissionsTab({ candidateId }: { candidateId: string }) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('candidate_submissions')
        .select('id, status, submitted_at, created_at, job_id, client_org_id, jobs(title), client_organizations(name)')
        .eq('candidate_id', candidateId)
        .order('created_at', { ascending: false });
      setRows(data ?? []);
      setLoading(false);
    })();
  }, [candidateId]);

  if (loading) return <Skeleton className="h-24 w-full" />;
  if (rows.length === 0) return <p className="text-sm text-muted-foreground text-center py-8">No client submissions yet.</p>;
  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <Card key={r.id}>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="font-medium">{r.jobs?.title || 'Job'}</p>
              <p className="text-sm text-muted-foreground">{r.client_organizations?.name || 'Client'}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {r.submitted_at ? `Submitted ${format(new Date(r.submitted_at), 'PP')}` : `Created ${format(new Date(r.created_at), 'PP')}`}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="capitalize">{(r.status || '').replace(/_/g, ' ')}</Badge>
              <Link to={`/jobs/${r.job_id}`} className="text-sm text-primary hover:underline">Open job</Link>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/* ---------------- Interview Feedback ---------------- */
export function CandidateInterviewFeedbackTab({ candidateId }: { candidateId: string }) {
  const [interviews, setInterviews] = useState<any[]>([]);
  const [feedback, setFeedback] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      // Find job_candidate rows that belong to this candidate
      const { data: jcs } = await supabase.from('job_candidates').select('id, job_id, jobs(title)').eq('candidate_id', candidateId);
      const jcIds = (jcs ?? []).map((j: any) => j.id);
      if (jcIds.length === 0) { setLoading(false); return; }
      const [{ data: ir }, { data: fb }] = await Promise.all([
        supabase.from('interview_requests').select('id, status, meeting_format, duration_minutes, selected_slot, recruiter_notes, client_notes, created_at, job_candidate_id').in('job_candidate_id', jcIds).order('created_at', { ascending: false }),
        supabase.from('candidate_feedback').select('id, rating, decision, comment, author_type, created_at, job_candidate_id').in('job_candidate_id', jcIds).order('created_at', { ascending: false }),
      ]);
      const jcMap = new Map((jcs ?? []).map((j: any) => [j.id, j.jobs?.title]));
      setInterviews((ir ?? []).map((x: any) => ({ ...x, jobTitle: jcMap.get(x.job_candidate_id) })));
      setFeedback((fb ?? []).map((x: any) => ({ ...x, jobTitle: jcMap.get(x.job_candidate_id) })));
      setLoading(false);
    })();
  }, [candidateId]);

  if (loading) return <Skeleton className="h-24 w-full" />;
  if (interviews.length === 0 && feedback.length === 0)
    return <p className="text-sm text-muted-foreground text-center py-8">No interview feedback recorded yet.</p>;

  return (
    <div className="space-y-6">
      {interviews.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground">Interviews</h3>
          {interviews.map((i) => (
            <Card key={i.id}>
              <CardContent className="p-4 space-y-1">
                <div className="flex items-center justify-between">
                  <p className="font-medium">{i.jobTitle || 'Interview'}</p>
                  <Badge variant="outline" className="capitalize">{i.status}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {i.meeting_format} · {i.duration_minutes} min · {format(new Date(i.created_at), 'PP')}
                </p>
                {i.recruiter_notes && <p className="text-sm mt-2"><span className="text-muted-foreground">Recruiter:</span> {i.recruiter_notes}</p>}
                {i.client_notes && <p className="text-sm"><span className="text-muted-foreground">Client:</span> {i.client_notes}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      {feedback.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground">Feedback</h3>
          {feedback.map((f) => (
            <Card key={f.id}>
              <CardContent className="p-4 space-y-1">
                <div className="flex items-center justify-between">
                  <p className="font-medium">{f.jobTitle || 'Feedback'}</p>
                  <div className="flex items-center gap-2">
                    {f.rating != null && <Badge variant="secondary">{f.rating}/5</Badge>}
                    {f.decision && <Badge variant="outline" className="capitalize">{f.decision}</Badge>}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">{f.author_type} · {format(new Date(f.created_at), 'PP')}</p>
                {f.comment && <p className="text-sm mt-2 whitespace-pre-wrap">{f.comment}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------- Offers ---------------- */
export function CandidateOffersTab({ candidateId }: { candidateId: string }) {
  return <PlacementsList candidateId={candidateId} filter={['offer', 'offer_accepted', 'offer_declined']} emptyLabel="No offers recorded yet." />;
}

/* ---------------- Placements ---------------- */
export function CandidatePlacementsTab({ candidateId }: { candidateId: string }) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('placements')
      .select('id, placement_date, start_date, salary, placement_fee, currency, status, notes, jobs:job_id(title), clients:client_id(company_name)')
      .eq('candidate_id', candidateId)
      .order('placement_date', { ascending: false });
    setRows(data ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [candidateId]);

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-medium text-muted-foreground">Placement History</h3>
        <Button size="sm" onClick={() => setOpen(true)} className="gap-2">
          <Trophy className="w-4 h-4" /> Mark as Placement
        </Button>
      </div>
      {loading ? <Skeleton className="h-24 w-full" /> :
        rows.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">No placements yet.</p> :
        rows.map((r) => (
          <Card key={r.id}>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="font-medium">{r.jobs?.title || 'Role'}</p>
                <p className="text-sm text-muted-foreground">{r.clients?.company_name}</p>
                <p className="text-xs text-muted-foreground mt-1">Placed {format(new Date(r.placement_date), 'PP')}</p>
                {r.notes && <p className="text-sm mt-2">{r.notes}</p>}
              </div>
              <div className="text-right">
                <Badge variant="secondary" className="capitalize">{r.status}</Badge>
                {r.placement_fee && (
                  <p className="text-sm font-semibold mt-2">
                    {new Intl.NumberFormat(undefined, { style: 'currency', currency: r.currency || 'USD', maximumFractionDigits: 0 }).format(Number(r.placement_fee))}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        ))
      }
      <MarkAsPlacementDialog open={open} onOpenChange={setOpen} candidateId={candidateId} onSaved={load} />
    </div>
  );
}

function PlacementsList({ candidateId, filter, emptyLabel }: { candidateId: string; filter: string[]; emptyLabel: string }) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('placement_outcomes')
        .select('id, outcome_type, outcome_reason, created_at, job_id, client_org_id, jobs(title), client_organizations(name)')
        .eq('candidate_id', candidateId)
        .in('outcome_type', filter)
        .order('created_at', { ascending: false });
      setRows(data ?? []);
      setLoading(false);
    })();
  }, [candidateId, filter.join(',')]);

  if (loading) return <Skeleton className="h-24 w-full" />;
  if (rows.length === 0) return <p className="text-sm text-muted-foreground text-center py-8">{emptyLabel}</p>;
  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <Card key={r.id}>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="font-medium">{r.jobs?.title || 'Role'}</p>
              <p className="text-sm text-muted-foreground">{r.client_organizations?.name}</p>
              <p className="text-xs text-muted-foreground mt-1">{format(new Date(r.created_at), 'PP')}</p>
              {r.outcome_reason && <p className="text-sm mt-2">{r.outcome_reason}</p>}
            </div>
            <Badge variant="outline" className="capitalize">{r.outcome_type.replace(/_/g, ' ')}</Badge>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
