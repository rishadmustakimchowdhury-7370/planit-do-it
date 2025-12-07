import { AppLayout } from '@/components/layout/AppLayout';
import { JobCard } from '@/components/jobs/JobCard';
import { jobs } from '@/data/mockData';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Search, Filter, LayoutGrid, List } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const JobsPage = () => {
  const [view, setView] = useState<'grid' | 'list'>('list');
  const [filter, setFilter] = useState<'all' | 'open' | 'on-hold' | 'closed'>('all');

  const filteredJobs = filter === 'all' 
    ? jobs 
    : jobs.filter(job => job.status === filter);

  return (
    <AppLayout title="Jobs" subtitle="Manage your job openings and track candidates.">
      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search jobs..."
              className="w-64 pl-9 bg-card"
            />
          </div>
          <div className="flex items-center gap-1 p-1 bg-muted rounded-lg">
            {(['all', 'open', 'on-hold', 'closed'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setFilter(status)}
                className={cn(
                  'px-3 py-1.5 text-sm font-medium rounded-md transition-colors capitalize',
                  filter === status 
                    ? 'bg-background text-foreground shadow-sm' 
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {status}
                <Badge variant="secondary" className="ml-1.5 text-xs">
                  {status === 'all' ? jobs.length : jobs.filter(j => j.status === status).length}
                </Badge>
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center p-1 bg-muted rounded-lg">
            <button
              onClick={() => setView('list')}
              className={cn(
                'p-2 rounded-md transition-colors',
                view === 'list' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setView('grid')}
              className={cn(
                'p-2 rounded-md transition-colors',
                view === 'grid' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
          <Button className="gap-2">
            <Plus className="w-4 h-4" />
            Add Job
          </Button>
        </div>
      </div>

      {/* Jobs List */}
      <div className={cn(
        view === 'grid' 
          ? 'grid grid-cols-1 md:grid-cols-2 gap-4' 
          : 'space-y-4'
      )}>
        {filteredJobs.map((job, index) => (
          <JobCard key={job.id} job={job} index={index} />
        ))}
      </div>

      {filteredJobs.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          No jobs found matching your criteria.
        </div>
      )}
    </AppLayout>
  );
};

export default JobsPage;
