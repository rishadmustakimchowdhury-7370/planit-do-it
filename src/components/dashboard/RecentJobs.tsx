import { Link } from 'react-router-dom';
import { Job } from '@/types/recruitment';
import { Badge } from '@/components/ui/badge';
import { MapPin, Users, Calendar, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

interface RecentJobsProps {
  jobs: Job[];
}

const statusColors = {
  open: 'bg-success/10 text-success border-success/20',
  closed: 'bg-muted text-muted-foreground border-muted',
  'on-hold': 'bg-warning/10 text-warning border-warning/20',
};

export function RecentJobs({ jobs }: RecentJobsProps) {
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
        {jobs.slice(0, 4).map((job, index) => (
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
                      className={cn('capitalize text-xs', statusColors[job.status])}
                    >
                      {job.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-accent mt-1">{job.clientName}</p>
                  <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5" />
                      {job.location}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="w-3.5 h-3.5" />
                      {job.candidateCount} candidates
                    </span>
                  </div>
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  <Calendar className="w-3.5 h-3.5 inline mr-1" />
                  {formatDistanceToNow(job.createdAt, { addSuffix: true })}
                </div>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
