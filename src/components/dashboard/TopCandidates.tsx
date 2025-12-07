import { Link } from 'react-router-dom';
import { Candidate } from '@/types/recruitment';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface TopCandidatesProps {
  candidates: Candidate[];
}

const statusLabels: Record<string, string> = {
  new: 'New',
  screening: 'Screening',
  shortlisted: 'Shortlisted',
  interview: 'Interview',
  offer: 'Offer',
  placed: 'Placed',
  rejected: 'Rejected',
};

const statusColors: Record<string, string> = {
  new: 'bg-muted text-muted-foreground',
  screening: 'bg-info/10 text-info',
  shortlisted: 'bg-warning/10 text-warning',
  interview: 'bg-accent/10 text-accent',
  offer: 'bg-success/10 text-success',
  placed: 'bg-success/20 text-success',
  rejected: 'bg-destructive/10 text-destructive',
};

export function TopCandidates({ candidates }: TopCandidatesProps) {
  const sortedCandidates = [...candidates]
    .filter(c => c.matchScore)
    .sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0))
    .slice(0, 5);

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
        {sortedCandidates.map((candidate, index) => (
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
                <AvatarImage src={candidate.avatar} alt={candidate.name} />
                <AvatarFallback className="bg-accent/10 text-accent text-sm font-medium">
                  {candidate.name.split(' ').map(n => n[0]).join('')}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground truncate">{candidate.name}</p>
                <p className="text-sm text-muted-foreground truncate">{candidate.currentTitle}</p>
              </div>
              <div className="text-right">
                <div className={cn(
                  'text-lg font-bold',
                  (candidate.matchScore || 0) >= 90 ? 'text-success' :
                  (candidate.matchScore || 0) >= 70 ? 'text-accent' :
                  (candidate.matchScore || 0) >= 50 ? 'text-warning' : 'text-destructive'
                )}>
                  {candidate.matchScore}%
                </div>
                <Badge variant="secondary" className={cn('text-xs mt-1', statusColors[candidate.status])}>
                  {statusLabels[candidate.status]}
                </Badge>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
