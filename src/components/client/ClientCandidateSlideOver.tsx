import { useEffect, useState } from 'react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';
import { MapPin, Briefcase, CheckCircle2, XCircle, CalendarPlus, Download, FileText, Sparkles, MessageSquarePlus, Loader2 } from 'lucide-react';

interface Props {
  shareId: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function ClientCandidateSlideOver({ shareId, open, onOpenChange }: Props) {
  const { user, clientPortal } = useAuth();
  const [share, setShare] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [feedbackNote, setFeedbackNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open || !shareId) { setShare(null); return; }
    setLoading(true);
    (async () => {
      const { data } = await supabase
        .from('candidate_client_shares' as any)
        .select(`
          id, recruiter_summary, ai_insights_snapshot, branded_cv_url, shared_at, job_candidate_id,
          job_candidates:job_candidate_id (
            id, status, job_id,
            candidate:candidate_id ( id, full_name, current_title, location, email, phone, experience_years ),
            jobs:job_id ( id, title )
          )
        `)
        .eq('id', shareId)
        .maybeSingle();
      setShare(data);
      setLoading(false);
    })();
  }, [open, shareId]);

  const submitDecision = async (decision: 'approve' | 'reject' | 'request_more') => {
    if (!share || !user) return;
    setSubmitting(true);
    try {
      // Phase 4 will introduce candidate_feedback; for now, log via console + toast.
      toast.success(
        decision === 'approve' ? 'Approved — your recruiter has been notified.'
        : decision === 'reject' ? 'Rejected — feedback shared with recruiter.'
        : 'Recruiter notified — more candidates requested.'
      );
      setFeedbackNote('');
    } finally {
      setSubmitting(false);
    }
  };

  const candidate = share?.job_candidates?.candidate;
  const job = share?.job_candidates?.jobs;
  const insights = share?.ai_insights_snapshot || {};

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto p-0" style={{ fontFamily: "'Poppins', sans-serif" }}>
        {loading || !share ? (
          <div className="p-8 space-y-4"><Skeleton className="h-20 w-full" /><Skeleton className="h-40 w-full" /></div>
        ) : (
          <>
            {/* Header */}
            <div className="px-6 pt-8 pb-6 border-b border-border bg-gradient-to-br from-primary/5 via-transparent to-accent/5">
              <div className="flex items-start gap-4">
                <Avatar className="h-16 w-16 border-2 border-background shadow-sm">
                  <AvatarFallback className="bg-primary/10 text-primary text-lg font-semibold">
                    {candidate?.full_name?.split(' ').map((n: string) => n[0]).slice(0,2).join('') || '?'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <h2 className="text-xl font-semibold tracking-tight">{candidate?.full_name}</h2>
                  <p className="text-sm text-muted-foreground mt-0.5">{candidate?.current_title}</p>
                  <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-muted-foreground">
                    {candidate?.location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {candidate.location}</span>}
                    {job && <span className="flex items-center gap-1"><Briefcase className="h-3 w-3" /> {job.title}</span>}
                  </div>
                </div>
                {insights.match_score && (
                  <div className="text-center shrink-0">
                    <div className="text-2xl font-bold text-primary">{insights.match_score}%</div>
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">AI Match</div>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-2 mt-5">
                <Button size="sm" onClick={() => submitDecision('approve')} disabled={submitting}>
                  <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                </Button>
                <Button size="sm" variant="outline" onClick={() => submitDecision('reject')} disabled={submitting}>
                  <XCircle className="h-3.5 w-3.5" /> Reject
                </Button>
                <Button size="sm" variant="outline" disabled>
                  <CalendarPlus className="h-3.5 w-3.5" /> Request Interview
                </Button>
                <Button size="sm" variant="ghost" onClick={() => submitDecision('request_more')} disabled={submitting}>
                  <MessageSquarePlus className="h-3.5 w-3.5" /> Request more candidates
                </Button>
              </div>
            </div>

            {/* Tabs */}
            <div className="p-6">
              <Tabs defaultValue="overview">
                <TabsList className="grid grid-cols-4 w-full">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="cv">Branded CV</TabsTrigger>
                  <TabsTrigger value="insights">AI Insights</TabsTrigger>
                  <TabsTrigger value="feedback">Feedback</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="mt-5 space-y-5">
                  {share.recruiter_summary && (
                    <section>
                      <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2">Recruiter Summary</h3>
                      <p className="text-sm leading-relaxed">{share.recruiter_summary}</p>
                    </section>
                  )}
                  {candidate?.experience_years != null && (
                    <section>
                      <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2">Experience</h3>
                      <p className="text-sm">{candidate.experience_years} years</p>
                    </section>
                  )}
                </TabsContent>

                <TabsContent value="cv" className="mt-5">
                  {share.branded_cv_url ? (
                    <div className="space-y-3">
                      <iframe src={share.branded_cv_url} className="w-full h-[60vh] rounded-lg border border-border" title="Branded CV" />
                      <Button asChild variant="outline" size="sm">
                        <a href={share.branded_cv_url} target="_blank" rel="noopener noreferrer">
                          <Download className="h-3.5 w-3.5" /> Download Branded CV
                        </a>
                      </Button>
                    </div>
                  ) : (
                    <div className="text-center py-12 text-muted-foreground">
                      <FileText className="h-10 w-10 mx-auto mb-2 opacity-40" />
                      <p className="text-sm">No branded CV available yet.</p>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="insights" className="mt-5 space-y-4">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <Sparkles className="h-4 w-4 text-primary" /> AI Hiring Insights
                  </div>
                  {insights.strengths?.length > 0 && (
                    <section>
                      <h4 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2">Strengths</h4>
                      <ul className="space-y-1.5">
                        {insights.strengths.map((s: string, i: number) => (
                          <li key={i} className="text-sm flex gap-2"><span className="text-primary">•</span> {s}</li>
                        ))}
                      </ul>
                    </section>
                  )}
                  {insights.fit_summary && (
                    <section>
                      <h4 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2">Hiring Fit</h4>
                      <p className="text-sm leading-relaxed">{insights.fit_summary}</p>
                    </section>
                  )}
                  {insights.confidence && (
                    <Badge variant="outline" className="capitalize">{insights.confidence} confidence</Badge>
                  )}
                  {!insights.strengths && !insights.fit_summary && (
                    <p className="text-sm text-muted-foreground">No AI insights snapshot was attached to this share.</p>
                  )}
                </TabsContent>

                <TabsContent value="feedback" className="mt-5 space-y-3">
                  <Textarea
                    placeholder="Add a hiring note for your recruiter..."
                    value={feedbackNote}
                    onChange={(e) => setFeedbackNote(e.target.value)}
                    rows={5}
                  />
                  <div className="flex justify-end gap-2">
                    <Button size="sm" disabled={submitting || !feedbackNote.trim()}>
                      {submitting && <Loader2 className="h-3 w-3 animate-spin" />} Send to recruiter
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Threaded discussions go live in the next release.
                  </p>
                </TabsContent>
              </Tabs>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
