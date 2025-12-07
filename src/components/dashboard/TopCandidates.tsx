import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, Users } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Skeleton } from '@/components/ui/skeleton';

interface Candidate {
  id: string;
  full_name: string;
  current_title: string | null;
  avatar_url: string | null;
  status: string;
}

interface JobCandidate {
  match_score: number | null;
  candidate: Candidate;
}

const statusLabels: Record<string, string> = {
  new: 'New',
  screening: 'Screening',
  interviewing: 'Interview',
  offered: 'Offer',
  hired: 'Hired',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
};

const statusColors: Record<string, string> = {
  new: 'bg-muted text-muted-foreground',
  screening: 'bg-info/10 text-info',
  interviewing: 'bg-accent/10 text-accent',
  offered: 'bg-success/10 text-success',
  hired: 'bg-success/20 text-success',
  rejected: 'bg-destructive/10 text-destructive',
  withdrawn: 'bg-muted text-muted-foreground',
};

export function TopCandidates() {
  const { tenantId } = useAuth();
  const [candidates, setCandidates] = useState<{ candidate: Candidate; matchScore: number }[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchCandidates() {
      if (!tenantId) {
        setIsLoading(false);
        return;
      }

      try {
        // Get candidates with match scores from job_candidates
        const { data: jobCandidates, error: jcError } = await supabase
          .from('job_candidates')
          .select('match_score, candidates(id, full_name, current_title, avatar_url, status)')
          .eq('tenant_id', tenantId)
          .not('match_score', 'is', null)
          .order('match_score', { ascending: false })
          .limit(5);

        if (jcError) throw jcError;

        const transformedCandidates = (jobCandidates || [])
          .filter(jc => jc.candidates && jc.match_score)
          .map(jc => ({
            candidate: jc.candidates as unknown as Candidate,
            matchScore: jc.match_score as number,
          }));

        setCandidates(transformedCandidates);
      } catch (error) {
        console.error('Error fetching candidates:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchCandidates();
  }, [tenantId]);

  if (isLoading) {
    return (
      <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-20" />
        </div>
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-3">
              <Skeleton className="w-10 h-10 rounded-full" />
              <div className="flex-1">
                <Skeleton className="h-4 w-32 mb-1" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-8 w-12" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (candidates.length === 0) {
    return (
      <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-foreground">Top Matches</h3>
          <Link 
            to="/candidates" 
            className="text-sm font-medium text-accent hover:text-accent/80 flex items-center gap-1 transition-colors"
          >
            View all <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        <div className="text-center py-8 text-muted-foreground">
          <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p>No matched candidates yet</p>
          <Link to="/ai-match" className="text-accent hover:underline text-sm">
            Run AI matching
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-foreground">Top Matches</h3>
        <Link 
          to="/candidates" 
          className="text-sm font-medium text-accent hover:text-accent/80 flex items-center gap-1 transition-colors"
        >
          View all <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
      <div className="space-y-3">
        {candidates.map(({ candidate, matchScore }, index) => (
          <motion.div
            key={candidate.id}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: index * 0.1 }}
          >
            <Link
              to={`/candidates/${candidate.id}`}
              className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors"
            >
              <Avatar className="w-10 h-10">
                <AvatarImage src={candidate.avatar_url || ''} alt={candidate.full_name} />
                <AvatarFallback className="bg-accent/10 text-accent text-sm font-medium">
                  {candidate.full_name.split(' ').map(n => n[0]).join('')}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground truncate">{candidate.full_name}</p>
                <p className="text-sm text-muted-foreground truncate">{candidate.current_title || 'No title'}</p>
              </div>
              <div className="text-right">
                <div className={cn(
                  'text-lg font-bold',
                  matchScore >= 90 ? 'text-success' :
                  matchScore >= 70 ? 'text-accent' :
                  matchScore >= 50 ? 'text-warning' : 'text-destructive'
                )}>
                  {matchScore}%
                </div>
                <Badge variant="secondary" className={cn('text-xs mt-1', statusColors[candidate.status] || statusColors.new)}>
                  {statusLabels[candidate.status] || 'New'}
                </Badge>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  );
}