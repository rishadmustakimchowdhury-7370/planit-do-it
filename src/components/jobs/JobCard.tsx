import { Job } from '@/types/recruitment';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MapPin, Users, Calendar, DollarSign, MoreHorizontal, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface JobCardProps {
  job: Job;
  index?: number;
}

const statusColors = {
  open: 'bg-success/10 text-success border-success/30',
  closed: 'bg-muted text-muted-foreground border-muted',
  'on-hold': 'bg-warning/10 text-warning border-warning/30',
};

export function JobCard({ job, index = 0 }: JobCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.1 }}
      whileHover={{ y: -2 }}
    >
      <Link
        to={`/jobs/${job.id}`}
        className="block bg-card rounded-xl border border-border p-5 hover:shadow-lg hover:border-accent/30 transition-all"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-lg text-foreground">{job.title}</h3>
              <Badge 
                variant="outline" 
                className={cn('capitalize text-xs', statusColors[job.status])}
              >
                {job.status}
              </Badge>
            </div>
            <p className="text-sm text-accent mt-1">{job.clientName}</p>
            
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <MapPin className="w-4 h-4 text-accent" />
                <span className="truncate">{job.location}</span>
              </div>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <DollarSign className="w-4 h-4 text-success" />
                <span className="truncate">{job.salaryRange}</span>
              </div>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Users className="w-4 h-4 text-info" />
                <span>{job.candidateCount} candidates</span>
              </div>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Calendar className="w-4 h-4" />
                <span>{formatDistanceToNow(job.createdAt, { addSuffix: true })}</span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" className="text-accent hover:bg-accent/10">
              <Sparkles className="w-4 h-4 mr-1" />
              AI Match
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => e.preventDefault()}>
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem>Edit Job</DropdownMenuItem>
                <DropdownMenuItem>View Pipeline</DropdownMenuItem>
                <DropdownMenuItem>Add Candidates</DropdownMenuItem>
                <DropdownMenuItem className="text-destructive">Close Job</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
