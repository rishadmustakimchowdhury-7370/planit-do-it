import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ClientLayout } from '@/components/client/ClientLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ClientCandidateSlideOver } from '@/components/client/ClientCandidateSlideOver';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { ArrowLeft, MapPin, Users } from 'lucide-react';
import { recommendationMeta } from '@/lib/recommendation';


export default function ClientJobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { clientPortal } = useAuth();
  const [job, setJob] = useState<any>(null);
  const [shares, setShares] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [openShareId, setOpenShareId] = useState<string | null>(null);

  useEffect(() => {
    if (!id || !clientPortal) return;
    (async () => {
      const [{ data: jobData }, { data: shareData }] = await Promise.all([
        supabase.from('jobs').select('id, title, location, status, description').eq('id', id).maybeSingle(),
        supabase
          .from('candidate_client_shares' as any)
          .select(`
            id, shared_at, recruiter_summary, ai_insights_snapshot, branded_cv_url, job_candidate_id,
            job_candidates:job_candidate_id (
              id, status, job_id,
              candidate:candidate_id ( id, full_name, current_title, location )
            )
          `)
          .eq('client_org_id', clientPortal.client_org_id)
          .eq('status', 'shared')
          .order('shared_at', { ascending: false }),
      ]);
      setJob(jobData);
      setShares(((shareData || []) as any[]).filter((s) => s.job_candidates?.job_id === id));
      setLoading(false);
    })();
  }, [id, clientPortal]);

  if (loading) {
    return <ClientLayout><Skeleton className="h-64" /></ClientLayout>;
  }

  return (
    <ClientLayout>
      <Link to="/client/jobs" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="h-4 w-4" /> Back to Jobs
      </Link>

      <div className="mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight mb-1">{job?.title}</h1>
            {job?.location && (
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4" /> {job.location}
              </div>
            )}
          </div>
          <Badge variant={job?.status === 'open' ? 'default' : 'secondary'} className="capitalize">{job?.status}</Badge>
        </div>
      </div>

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold tracking-tight flex items-center gap-2">
          <Users className="h-5 w-5" /> Candidates ({shares.length})
        </h2>
      </div>

      {shares.length === 0 ? (
        <Card><CardContent className="p-10 text-center text-sm text-muted-foreground">No candidates have been shared for this role yet.</CardContent></Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {shares.map((s) => (
            <Card key={s.id} className="cursor-pointer hover:border-primary/40 transition-all" onClick={() => setOpenShareId(s.id)}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <div className="font-semibold">{s.job_candidates?.candidate?.full_name || 'Candidate'}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{s.job_candidates?.candidate?.current_title}</div>
                  </div>
                  {(() => {
                    const snap = s.ai_insights_snapshot || {};
                    if (!snap.recommendation && !snap.match_score) return null;
                    const meta = recommendationMeta(snap.recommendation, snap.match_score);
                    return <Badge variant="outline" className={meta.badgeClass}>{meta.label}</Badge>;
                  })()}

                </div>
                {s.recruiter_summary && (
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-2">{s.recruiter_summary}</p>
                )}
                <Button variant="ghost" size="sm" className="mt-3 px-0 text-primary">Review →</Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ClientCandidateSlideOver
        shareId={openShareId}
        open={!!openShareId}
        onOpenChange={(v) => !v && setOpenShareId(null)}
      />
    </ClientLayout>
  );
}
