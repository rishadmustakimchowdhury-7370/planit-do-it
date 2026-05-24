import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';
import { Send, Star, Loader2, MessageSquare, ThumbsUp } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

interface Props {
  jobCandidateId: string;
  tenantId: string;
  clientOrgId: string;       // already resolved by caller
  authorType: 'internal' | 'client';
}

type Discussion = {
  id: string;
  body: string;
  author_user_id: string;
  author_type: 'internal' | 'client';
  created_at: string;
  parent_id: string | null;
  author?: { full_name: string | null; email: string | null } | null;
};

type Feedback = {
  id: string;
  rating: number | null;
  decision: string | null;
  comment: string | null;
  author_user_id: string;
  author_type: 'internal' | 'client';
  created_at: string;
  author?: { full_name: string | null; email: string | null } | null;
};

const decisionLabel: Record<string, string> = {
  advance: 'Advance', hold: 'Hold', reject: 'Reject',
  interview: 'Interview', offer: 'Offer',
};

const decisionTone: Record<string, string> = {
  advance: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  hold: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  reject: 'bg-destructive/10 text-destructive border-destructive/20',
  interview: 'bg-primary/10 text-primary border-primary/20',
  offer: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
};

export function CandidateCollaborationPanel({ jobCandidateId, tenantId, clientOrgId, authorType }: Props) {
  const { user } = useAuth();
  const [discussions, setDiscussions] = useState<Discussion[]>([]);
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState('');
  const [posting, setPosting] = useState(false);

  // Feedback form state
  const [rating, setRating] = useState<number>(0);
  const [decision, setDecision] = useState<string>('');
  const [comment, setComment] = useState('');
  const [submittingFb, setSubmittingFb] = useState(false);

  const load = async () => {
    setLoading(true);
    const [{ data: d }, { data: f }] = await Promise.all([
      supabase
        .from('candidate_discussions')
        .select('id, body, author_user_id, author_type, created_at, parent_id, author:author_user_id(full_name, email)' as any)
        .eq('job_candidate_id', jobCandidateId)
        .eq('client_org_id', clientOrgId)
        .order('created_at', { ascending: true }),
      supabase
        .from('candidate_feedback')
        .select('id, rating, decision, comment, author_user_id, author_type, created_at, author:author_user_id(full_name, email)' as any)
        .eq('job_candidate_id', jobCandidateId)
        .eq('client_org_id', clientOrgId)
        .order('created_at', { ascending: false }),
    ]);
    setDiscussions((d as any) || []);
    setFeedback((f as any) || []);
    setLoading(false);
  };

  useEffect(() => {
    if (!jobCandidateId || !clientOrgId) return;
    load();

    const channel = supabase
      .channel(`cand-collab-${jobCandidateId}-${clientOrgId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'candidate_discussions', filter: `job_candidate_id=eq.${jobCandidateId}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'candidate_feedback', filter: `job_candidate_id=eq.${jobCandidateId}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobCandidateId, clientOrgId]);

  const postMessage = async () => {
    if (!body.trim() || !user) return;
    setPosting(true);
    try {
      const { error } = await supabase.from('candidate_discussions').insert({
        tenant_id: tenantId,
        client_org_id: clientOrgId,
        job_candidate_id: jobCandidateId,
        author_user_id: user.id,
        author_type: authorType,
        body: body.trim(),
      });
      if (error) throw error;
      setBody('');
    } catch (e: any) {
      toast.error(e.message || 'Failed to post');
    } finally {
      setPosting(false);
    }
  };

  const submitFeedback = async () => {
    if (!user) return;
    if (!rating && !decision && !comment.trim()) {
      toast.error('Add a rating, decision, or comment'); return;
    }
    setSubmittingFb(true);
    try {
      const { error } = await supabase.from('candidate_feedback').insert({
        tenant_id: tenantId,
        client_org_id: clientOrgId,
        job_candidate_id: jobCandidateId,
        author_user_id: user.id,
        author_type: authorType,
        rating: rating || null,
        decision: decision || null,
        comment: comment.trim() || null,
      });
      if (error) throw error;
      setRating(0); setDecision(''); setComment('');
      toast.success('Feedback submitted');
    } catch (e: any) {
      toast.error(e.message || 'Failed to submit feedback');
    } finally {
      setSubmittingFb(false);
    }
  };

  return (
    <div className="space-y-6" style={{ fontFamily: "'Poppins', sans-serif" }}>
      {/* Structured feedback */}
      <section className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <ThumbsUp className="h-4 w-4 text-primary" /> Structured Feedback
        </div>

        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <div className="flex items-center gap-3">
            <span className="text-xs uppercase tracking-wider text-muted-foreground">Rating</span>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map(n => (
                <button key={n} type="button" onClick={() => setRating(n === rating ? 0 : n)}>
                  <Star className={cn('h-5 w-5', n <= rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/40')} />
                </button>
              ))}
            </div>
            <div className="flex-1" />
            <Select value={decision} onValueChange={setDecision}>
              <SelectTrigger className="w-[140px]"><SelectValue placeholder="Decision" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="advance">Advance</SelectItem>
                <SelectItem value="interview">Interview</SelectItem>
                <SelectItem value="offer">Offer</SelectItem>
                <SelectItem value="hold">Hold</SelectItem>
                <SelectItem value="reject">Reject</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Textarea
            placeholder="Add context for this decision (optional)…"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
          />
          <div className="flex justify-end">
            <Button size="sm" onClick={submitFeedback} disabled={submittingFb}>
              {submittingFb ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : null}
              Submit Feedback
            </Button>
          </div>
        </div>

        {loading ? <Skeleton className="h-16 w-full" /> : feedback.length === 0 ? (
          <p className="text-xs text-muted-foreground">No feedback yet.</p>
        ) : (
          <ul className="space-y-2">
            {feedback.map(f => (
              <li key={f.id} className="rounded-lg border border-border p-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {f.author?.full_name || f.author?.email || 'Unknown'}
                  </span>
                  <Badge variant="outline" className="capitalize text-[10px]">{f.author_type}</Badge>
                  <span>· {formatDistanceToNow(new Date(f.created_at), { addSuffix: true })}</span>
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  {f.rating ? (
                    <div className="flex">
                      {[1,2,3,4,5].map(n => (
                        <Star key={n} className={cn('h-3.5 w-3.5', n <= (f.rating || 0) ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30')} />
                      ))}
                    </div>
                  ) : null}
                  {f.decision && (
                    <Badge className={cn('border capitalize', decisionTone[f.decision] || 'bg-muted')}>
                      {decisionLabel[f.decision] || f.decision}
                    </Badge>
                  )}
                </div>
                {f.comment && <p className="text-sm mt-2 whitespace-pre-wrap leading-relaxed">{f.comment}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Threaded discussion */}
      <section className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <MessageSquare className="h-4 w-4 text-primary" /> Discussion
        </div>

        <div className="rounded-lg border border-border bg-card divide-y">
          {loading ? (
            <div className="p-4"><Skeleton className="h-12 w-full" /></div>
          ) : discussions.length === 0 ? (
            <p className="p-4 text-xs text-muted-foreground">No messages yet. Start the conversation.</p>
          ) : (
            discussions.map(m => {
              const isMine = m.author_user_id === user?.id;
              return (
                <div key={m.id} className="p-3 flex gap-3">
                  <Avatar className="h-7 w-7 shrink-0">
                    <AvatarFallback className={cn('text-[10px]', m.author_type === 'client' ? 'bg-primary/10 text-primary' : 'bg-muted')}>
                      {(m.author?.full_name || m.author?.email || '?').slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">
                        {isMine ? 'You' : (m.author?.full_name || m.author?.email || 'Unknown')}
                      </span>
                      <Badge variant="outline" className="capitalize text-[10px] h-4">{m.author_type}</Badge>
                      <span>· {formatDistanceToNow(new Date(m.created_at), { addSuffix: true })}</span>
                    </div>
                    <p className="text-sm mt-1 whitespace-pre-wrap leading-relaxed">{m.body}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="space-y-2">
          <Textarea
            placeholder={authorType === 'client' ? 'Message your recruiter…' : 'Reply to client…'}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={2}
          />
          <div className="flex justify-end">
            <Button size="sm" onClick={postMessage} disabled={!body.trim() || posting}>
              {posting ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : <Send className="h-3.5 w-3.5 mr-2" />}
              Send
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
