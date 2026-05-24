import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ClientLayout } from '@/components/client/ClientLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ClientCandidateSlideOver } from '@/components/client/ClientCandidateSlideOver';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Users } from 'lucide-react';

export default function ClientCandidatesPage() {
  const { clientPortal } = useAuth();
  const [shares, setShares] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [params] = useSearchParams();
  const [openShareId, setOpenShareId] = useState<string | null>(null);

  useEffect(() => {
    if (!clientPortal) return;
    (async () => {
      const { data } = await supabase
        .from('candidate_client_shares' as any)
        .select(`
          id, recruiter_summary, ai_insights_snapshot, shared_at, job_candidate_id,
          job_candidates:job_candidate_id (
            id, status,
            candidate:candidate_id ( id, full_name, current_title, location ),
            jobs:job_id ( id, title )
          )
        `)
        .eq('client_org_id', clientPortal.client_org_id)
        .eq('status', 'shared')
        .order('shared_at', { ascending: false });
      setShares((data || []) as any[]);
      setLoading(false);

      const openParam = params.get('open');
      if (openParam) {
        const match = (data || []).find((s: any) => s.job_candidate_id === openParam);
        if (match) setOpenShareId(match.id);
      }
    })();
  }, [clientPortal, params]);

  return (
    <ClientLayout title="Candidates" subtitle="Shared candidates across all your roles">
      {loading ? (
        <div className="grid gap-3">{[1,2,3].map(i => <Skeleton key={i} className="h-24" />)}</div>
      ) : shares.length === 0 ? (
        <Card><CardContent className="p-12 text-center">
          <Users className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">No candidates shared yet.</p>
        </CardContent></Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {shares.map((s: any) => {
            const c = s.job_candidates?.candidate;
            return (
              <Card key={s.id} className="cursor-pointer hover:border-primary/40 transition-all" onClick={() => setOpenShareId(s.id)}>
                <CardContent className="p-5 flex gap-4">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                      {c?.full_name?.split(' ').map((n: string) => n[0]).slice(0,2).join('') || '?'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-semibold truncate">{c?.full_name || 'Candidate'}</div>
                        <div className="text-xs text-muted-foreground truncate">{c?.current_title}</div>
                      </div>
                      {s.ai_insights_snapshot?.match_score && (
                        <Badge variant="outline" className="bg-primary/5 shrink-0">{s.ai_insights_snapshot.match_score}%</Badge>
                      )}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-2 truncate">
                      For: <span className="text-foreground/80 font-medium">{s.job_candidates?.jobs?.title}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <ClientCandidateSlideOver shareId={openShareId} open={!!openShareId} onOpenChange={(v) => !v && setOpenShareId(null)} />
    </ClientLayout>
  );
}
