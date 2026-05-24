import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ClientLayout } from '@/components/client/ClientLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Briefcase, MapPin, ArrowRight, Users } from 'lucide-react';

export default function ClientJobsPage() {
  const { clientPortal } = useAuth();
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!clientPortal) return;
    (async () => {
      const { data: shares } = await supabase
        .from('job_client_shares' as any)
        .select('job_id, shared_at, jobs:job_id(id, title, location, status, created_at)')
        .eq('client_org_id', clientPortal.client_org_id)
        .order('shared_at', { ascending: false });

      const rows = (shares || []).map((s: any) => s.jobs).filter(Boolean);

      // Fetch candidate counts per job
      const ids = rows.map((j: any) => j.id);
      let counts: Record<string, number> = {};
      if (ids.length) {
        const { data: ccs } = await supabase
          .from('candidate_client_shares' as any)
          .select('job_candidate_id, job_candidates:job_candidate_id(job_id)')
          .eq('client_org_id', clientPortal.client_org_id)
          .eq('status', 'shared');
        for (const r of (ccs || []) as any[]) {
          const jid = r.job_candidates?.job_id;
          if (jid) counts[jid] = (counts[jid] || 0) + 1;
        }
      }
      setJobs(rows.map((j: any) => ({ ...j, candidateCount: counts[j.id] || 0 })));
      setLoading(false);
    })();
  }, [clientPortal]);

  return (
    <ClientLayout title="Jobs" subtitle="Roles your recruiter is working on with you">
      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1,2,3].map(i => <Skeleton key={i} className="h-40" />)}
        </div>
      ) : jobs.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Briefcase className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <div className="text-sm text-muted-foreground">No jobs shared with you yet.</div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {jobs.map((job) => (
            <Link key={job.id} to={`/client/jobs/${job.id}`} className="group">
              <Card className="h-full hover:shadow-md hover:border-primary/40 transition-all">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <h3 className="font-semibold text-base leading-tight tracking-tight">{job.title}</h3>
                    <Badge variant={job.status === 'open' ? 'default' : 'secondary'} className="shrink-0 capitalize">{job.status}</Badge>
                  </div>
                  {job.location && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-4">
                      <MapPin className="h-3.5 w-3.5" /> {job.location}
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-3 border-t border-border">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Users className="h-3.5 w-3.5" /> {job.candidateCount} candidates
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </ClientLayout>
  );
}
