import { useEffect, useState } from 'react';
import { ClientLayout } from '@/components/client/ClientLayout';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Briefcase, Users, CalendarClock, Sparkles, Clock } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';

interface Stats { jobs: number; awaitingFeedback: number; upcomingInterviews: number; updates: number; }

export default function ClientDashboardPage() {
  const { clientPortal, profile } = useAuth();
  const [stats, setStats] = useState<Stats>({ jobs: 0, awaitingFeedback: 0, upcomingInterviews: 0, updates: 0 });
  const [recentCandidates, setRecentCandidates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!clientPortal) return;
    (async () => {
      try {
        const [{ count: jobsCount }, { data: shares }] = await Promise.all([
          supabase.from('job_client_shares' as any).select('id', { count: 'exact', head: true }).eq('client_org_id', clientPortal.client_org_id),
          supabase.from('candidate_client_shares' as any)
            .select('id, recruiter_summary, ai_insights_snapshot, shared_at, branded_cv_url, job_candidate_id')
            .eq('client_org_id', clientPortal.client_org_id)
            .eq('status', 'shared')
            .order('shared_at', { ascending: false })
            .limit(8),
        ]);
        setStats({
          jobs: jobsCount || 0,
          awaitingFeedback: shares?.length || 0,
          upcomingInterviews: 0,
          updates: shares?.length || 0,
        });
        setRecentCandidates(shares || []);
      } finally { setLoading(false); }
    })();
  }, [clientPortal]);

  const cards = [
    { label: 'Active Jobs', value: stats.jobs, icon: Briefcase, color: 'from-primary/15 to-primary/5' },
    { label: 'Candidates to Review', value: stats.awaitingFeedback, icon: Users, color: 'from-accent/15 to-accent/5' },
    { label: 'Upcoming Interviews', value: stats.upcomingInterviews, icon: CalendarClock, color: 'from-emerald-500/15 to-emerald-500/5' },
    { label: 'Recent Updates', value: stats.updates, icon: Sparkles, color: 'from-amber-500/15 to-amber-500/5' },
  ];

  return (
    <ClientLayout title={`Welcome${profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}`} subtitle="Your collaborative hiring workspace">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {cards.map((c) => (
          <Card key={c.label} className="overflow-hidden border-border/60">
            <CardContent className={`p-5 bg-gradient-to-br ${c.color}`}>
              <div className="flex items-start justify-between mb-3">
                <c.icon className="h-5 w-5 text-foreground/70" />
              </div>
              <div className="text-3xl font-semibold tracking-tight">{loading ? <Skeleton className="h-9 w-12" /> : c.value}</div>
              <div className="text-xs text-muted-foreground mt-1">{c.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold tracking-tight">Recent candidate updates</h2>
            <Link to="/client/candidates" className="text-xs font-medium text-primary hover:underline">View all</Link>
          </div>
          <Card>
            <CardContent className="p-0 divide-y divide-border">
              {loading ? (
                <div className="p-6 space-y-3">
                  {[1,2,3].map(i => <Skeleton key={i} className="h-14 w-full" />)}
                </div>
              ) : recentCandidates.length === 0 ? (
                <div className="p-10 text-center text-sm text-muted-foreground">
                  Nothing shared with you yet. Your recruiter will surface candidates here.
                </div>
              ) : recentCandidates.map((s) => (
                <Link
                  key={s.id}
                  to={`/client/candidates?open=${s.job_candidate_id}`}
                  className="flex items-center justify-between p-4 hover:bg-muted/40 transition-colors"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">
                      {s.ai_insights_snapshot?.name || 'New candidate'}
                    </div>
                    <div className="text-xs text-muted-foreground truncate mt-0.5">
                      {s.recruiter_summary?.slice(0, 80) || 'Recruiter shared a candidate for your review'}
                    </div>
                  </div>
                  <Badge variant="outline" className="ml-3 shrink-0">Review</Badge>
                </Link>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <ClientActivityFeed limit={6} />
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-lg font-semibold tracking-tight">Upcoming interviews</h2>
            </div>
            <Card>
              <CardContent className="p-6 text-center text-sm text-muted-foreground">
                No interviews scheduled.
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </ClientLayout>
  );
}
