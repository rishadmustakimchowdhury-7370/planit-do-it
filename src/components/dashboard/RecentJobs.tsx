import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { MapPin, Users, Calendar, ArrowRight, Briefcase } from 'lucide-react';
import { motion } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Skeleton } from '@/components/ui/skeleton';

interface Job {
  id: string;
  title: string;
  location: string | null;
  status: string;
  created_at: string;
  client?: { name: string } | null;
}

const statusColors: Record<string, string> = {
  open: 'bg-success/10 text-success border-success/20',
  closed: 'bg-muted text-muted-foreground border-muted',
  paused: 'bg-warning/10 text-warning border-warning/20',
  draft: 'bg-muted text-muted-foreground border-muted',
  filled: 'bg-info/10 text-info border-info/20',
};

export function RecentJobs() {
  const { tenantId } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchJobs() {
      if (!tenantId) {
        setIsLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('jobs')
          .select('id, title, location, status, created_at, clients(name)')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false })
          .limit(4);

        if (error) throw error;
        
        // Transform the data to match our interface
        const transformedJobs = (data || []).map(job => ({
          ...job,
          client: job.clients as { name: string } | null
        }));
        
        setJobs(transformedJobs);
      } catch (error) {
        console.error('Error fetching jobs:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchJobs();
  }, [tenantId]);

  if (isLoading) {
    return (
      <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-20" />
        </div>
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-foreground">Active Jobs</h3>
          <Link 
            to="/jobs" 
            className="text-sm font-medium text-accent hover:text-accent/80 flex items-center gap-1 transition-colors"
          >
            View all <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        <div className="text-center py-8 text-muted-foreground">
          <Briefcase className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p>No jobs yet</p>
          <Link to="/jobs" className="text-accent hover:underline text-sm">
            Create your first job
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-foreground">Active Jobs</h3>
        <Link 
          to="/jobs" 
          className="text-sm font-medium text-accent hover:text-accent/80 flex items-center gap-1 transition-colors"
        >
          View all <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
      <div className="space-y-4">
        {jobs.map((job, index) => (
          <motion.div
            key={job.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.1 }}
          >
            <Link
              to={`/jobs/${job.id}`}
              className="block p-4 rounded-lg border border-border hover:border-accent/50 hover:shadow-md transition-all bg-background"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-semibold text-foreground truncate">{job.title}</h4>
                    <Badge 
                      variant="outline" 
                      className={cn('capitalize text-xs', statusColors[job.status] || statusColors.draft)}
                    >
                      {job.status}
                    </Badge>
                  </div>
                  {job.client?.name && (
                    <p className="text-sm text-accent mt-1">{job.client.name}</p>
                  )}
                  {job.location && (
                    <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5" />
                        {job.location}
                      </span>
                    </div>
                  )}
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  <Calendar className="w-3.5 h-3.5 inline mr-1" />
                  {formatDistanceToNow(new Date(job.created_at), { addSuffix: true })}
                </div>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  );
}