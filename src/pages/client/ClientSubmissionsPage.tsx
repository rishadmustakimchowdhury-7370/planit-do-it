import { useEffect, useState } from 'react';
import { ClientLayout } from '@/components/client/ClientLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Inbox, CheckCircle2, X, CalendarClock, Eye, Download, RefreshCw } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { SubmissionStatusBadge, SUBMISSION_STATUS_META, type SubmissionStatus } from '@/components/clients/SubmissionStatusBadge';
import { SubmissionPipelineBar } from '@/components/clients/SubmissionPipelineBar';
import { SubmissionActivityTimeline } from '@/components/clients/SubmissionActivityTimeline';
import { AIValidationCard } from '@/components/clients/AIValidationCard';
import { getSubmissionPackUrl } from '@/hooks/useSubmissionPack';

export default function ClientSubmissionsPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<any[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = async () => {
    if (!user) return;
    const { data: recs } = await supabase
      .from('submission_recipients' as any)
      .select('submission_id, decision, viewed_at')
      .eq('client_user_id', user.id);
    const ids = (recs ?? []).map((r: any) => r.submission_id);
    if (!ids.length) { setRows([]); return; }
    const { data } = await supabase
      .from('candidate_submissions')
      .select(`id, status, last_activity_at, submission_message, pack_pdf_url,
        candidate:candidate_id ( id, full_name, current_title ),
        job:job_id ( id, title )`)
      .in('id', ids)
      .order('last_activity_at', { ascending: false });
    setRows(data ?? []);
  };

  useEffect(() => { load(); }, [user?.id]);

  return (
    <ClientLayout title="Submissions" subtitle="Candidates submitted to you for review">
      {rows === null ? (
        <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-20" />)}</div>
      ) : rows.length === 0 ? (
        <Card><CardContent className="p-12 text-center">
          <Inbox className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">No submissions yet.</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {rows.map((r: any) => {
            const c = r.candidate;
            const initials = (c?.full_name || '?').split(' ').map((p: string) => p[0]).slice(0,2).join('').toUpperCase();
            return (
              <Card key={r.id} className="cursor-pointer hover:border-primary/40 transition-all" onClick={() => setOpenId(r.id)}>
                <CardContent className="p-4 flex items-center gap-4">
                  <Avatar className="h-10 w-10"><AvatarFallback className="bg-primary/10 text-primary">{initials}</AvatarFallback></Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{c?.full_name}</div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      For: <span className="font-medium text-foreground/80">{r.job?.title}</span>
                      {' · '}Updated {formatDistanceToNow(new Date(r.last_activity_at), { addSuffix: true })}
                    </div>
                  </div>
                  <SubmissionStatusBadge status={r.status as SubmissionStatus} />
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <ClientSubmissionView submissionId={openId} open={!!openId} onOpenChange={(v) => !v && setOpenId(null)} onChanged={load} />
    </ClientLayout>
  );
}

function ClientSubmissionView({ submissionId, open, onOpenChange, onChanged }: {
  submissionId: string | null; open: boolean; onOpenChange: (v: boolean) => void; onChanged?: () => void;
}) {
  const [data, setData] = useState<any | null>(null);
  const [packUrl, setPackUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!submissionId) return;
    const { data: row } = await supabase
      .from('candidate_submissions')
      .select(`*, candidate:candidate_id (*), job:job_id ( id, title, location, employment_type )`)
      .eq('id', submissionId).maybeSingle();
    setData(row);
    if (row?.pack_pdf_url) { try { setPackUrl(await getSubmissionPackUrl(row.pack_pdf_url)); } catch { setPackUrl(null); } }
    else setPackUrl(null);
    // Mark viewed
    await supabase.rpc('mark_submission_viewed' as any, { _submission_id: submissionId });
  };

  useEffect(() => { if (open && submissionId) { setData(null); load(); } }, [open, submissionId]);

  const respond = async (decision: 'approved' | 'rejected' | 'requested_interview') => {
    if (!submissionId) return;
    setBusy(true);
    const { error } = await supabase.rpc('respond_to_submission' as any, { _submission_id: submissionId, _decision: decision });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Marked as ${decision.replace('_',' ')}`);
    load();
    onChanged?.();
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-3xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            {data ? (
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground uppercase tracking-wide">{data.job?.title}</div>
                <div className="text-xl">{data.candidate?.full_name}</div>
              </div>
            ) : <Skeleton className="h-6 w-48" />}
          </SheetTitle>
        </SheetHeader>

        {!data ? (
          <div className="mt-4 space-y-3">{[1,2].map(i => <Skeleton key={i} className="h-24" />)}</div>
        ) : (
          <>
            <div className="mt-4 space-y-3">
              <SubmissionStatusBadge status={data.status} />
              <SubmissionPipelineBar status={data.status} />
              <div className="flex flex-wrap gap-2 pt-2">
                <Button size="sm" disabled={busy} onClick={() => respond('approved')}>
                  <CheckCircle2 className="h-4 w-4 mr-1.5" /> Approve
                </Button>
                <Button size="sm" variant="outline" disabled={busy} onClick={() => respond('requested_interview')}>
                  <CalendarClock className="h-4 w-4 mr-1.5" /> Request Interview
                </Button>
                <Button size="sm" variant="ghost" className="text-destructive" disabled={busy} onClick={() => respond('rejected')}>
                  <X className="h-4 w-4 mr-1.5" /> Reject
                </Button>
              </div>
            </div>

            <Tabs defaultValue="overview" className="mt-5">
              <TabsList className="grid grid-cols-3 w-full">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="pack">Pack</TabsTrigger>
                <TabsTrigger value="activity">Activity</TabsTrigger>
              </TabsList>
              <TabsContent value="overview" className="mt-4 space-y-4">
                <AIValidationCard jobId={data.job_id} candidateId={data.candidate_id} canRegenerate={false} clientSafe />
                {data.submission_message && (
                  <div className="rounded-lg border bg-muted/30 p-4">
                    <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">From the recruiter</div>
                    <p className="text-sm whitespace-pre-wrap">{data.submission_message}</p>
                  </div>
                )}
              </TabsContent>
              <TabsContent value="pack" className="mt-4 space-y-3">
                {packUrl ? (
                  <>
                    <Button asChild variant="outline" size="sm">
                      <a href={packUrl} target="_blank" rel="noreferrer"><Download className="h-4 w-4 mr-1.5" /> Open Pack</a>
                    </Button>
                    <iframe src={packUrl} title="Pack" className="w-full h-[60vh] rounded-lg border bg-muted/20" />
                  </>
                ) : <p className="text-sm text-muted-foreground">Pack not available yet.</p>}
              </TabsContent>
              <TabsContent value="activity" className="mt-4">
                <SubmissionActivityTimeline submissionId={data.id} />
              </TabsContent>
            </Tabs>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
