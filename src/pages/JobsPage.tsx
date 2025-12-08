import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Search, LayoutGrid, List, MapPin, Users, Calendar, DollarSign, MoreHorizontal, Sparkles, Loader2, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { motion } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';

interface Job {
  id: string;
  title: string;
  status: 'draft' | 'open' | 'paused' | 'closed' | 'filled';
  location: string | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string | null;
  created_at: string;
  client_id: string | null;
  clients?: { name: string } | null;
}

interface JobWithCandidateCount extends Job {
  candidateCount: number;
}

const statusColors: Record<string, string> = {
  open: 'bg-success/10 text-success border-success/30',
  closed: 'bg-muted text-muted-foreground border-muted',
  paused: 'bg-warning/10 text-warning border-warning/30',
  draft: 'bg-info/10 text-info border-info/30',
  filled: 'bg-accent/10 text-accent border-accent/30',
};

const JobsPage = () => {
  const navigate = useNavigate();
  const { tenantId } = useAuth();
  const [view, setView] = useState<'grid' | 'list'>('list');
  const [filter, setFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [jobs, setJobs] = useState<JobWithCandidateCount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteJobId, setDeleteJobId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (tenantId) {
      fetchJobs();
    }
  }, [tenantId]);

  const fetchJobs = async () => {
    setIsLoading(true);
    try {
      const { data: jobsData, error: jobsError } = await supabase
        .from('jobs')
        .select('*, clients(name)')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (jobsError) throw jobsError;

      // Get candidate counts for each job
      const jobIds = jobsData?.map(j => j.id) || [];
      const { data: candidateCounts } = await supabase
        .from('job_candidates')
        .select('job_id')
        .in('job_id', jobIds);

      const countMap: Record<string, number> = {};
      candidateCounts?.forEach(jc => {
        countMap[jc.job_id] = (countMap[jc.job_id] || 0) + 1;
      });

      const jobsWithCounts = (jobsData || []).map(job => ({
        ...job,
        candidateCount: countMap[job.id] || 0,
      }));

      setJobs(jobsWithCounts);
    } catch (error) {
      console.error('Error fetching jobs:', error);
      toast.error('Failed to load jobs');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStatusChange = async (jobId: string, newStatus: 'draft' | 'open' | 'paused' | 'closed' | 'filled') => {
    try {
      const { error } = await supabase
        .from('jobs')
        .update({ status: newStatus })
        .eq('id', jobId);

      if (error) throw error;
      toast.success(`Job status updated to ${newStatus}`);
      fetchJobs();
    } catch (error) {
      console.error('Error updating job:', error);
      toast.error('Failed to update job status');
    }
  };

  const handleDeleteJob = async () => {
    if (!deleteJobId) return;
    
    setIsDeleting(true);
    try {
      // First delete related job_candidates
      await supabase
        .from('job_candidates')
        .delete()
        .eq('job_id', deleteJobId);

      // Then delete the job
      const { error } = await supabase
        .from('jobs')
        .delete()
        .eq('id', deleteJobId);

      if (error) throw error;
      toast.success('Job deleted successfully');
      fetchJobs();
      setDeleteJobId(null);
    } catch (error) {
      console.error('Error deleting job:', error);
      toast.error('Failed to delete job');
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredJobs = jobs.filter(job => {
    const matchesFilter = filter === 'all' || job.status === filter;
    const matchesSearch = job.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.clients?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.location?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const statusCounts = {
    all: jobs.length,
    open: jobs.filter(j => j.status === 'open').length,
    draft: jobs.filter(j => j.status === 'draft').length,
    paused: jobs.filter(j => j.status === 'paused').length,
    closed: jobs.filter(j => j.status === 'closed').length,
  };

  const formatSalary = (job: Job) => {
    if (!job.salary_min && !job.salary_max) return 'Salary TBD';
    const currency = job.salary_currency || 'USD';
    const symbol = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : currency === 'BDT' ? '৳' : currency;
    if (job.salary_min && job.salary_max) {
      return `${symbol}${(job.salary_min / 1000).toFixed(0)}k - ${symbol}${(job.salary_max / 1000).toFixed(0)}k`;
    }
    return job.salary_min ? `${symbol}${(job.salary_min / 1000).toFixed(0)}k+` : `Up to ${symbol}${(job.salary_max! / 1000).toFixed(0)}k`;
  };

  return (
    <AppLayout title="Jobs" subtitle="Manage your job openings and track candidates.">
      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search jobs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-64 pl-9 bg-card"
            />
          </div>
          <div className="flex items-center gap-1 p-1 bg-muted rounded-lg">
            {(['all', 'open', 'draft', 'paused', 'closed'] as const).map((status) => (
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
                  {statusCounts[status]}
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
          <Button className="gap-2" onClick={() => navigate('/jobs/new')}>
            <Plus className="w-4 h-4" />
            Add Job
          </Button>
        </div>
      </div>

      {/* Jobs List */}
      {isLoading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className={cn(
          view === 'grid' 
            ? 'grid grid-cols-1 md:grid-cols-2 gap-4' 
            : 'space-y-4'
        )}>
          {filteredJobs.map((job, index) => (
            <motion.div
              key={job.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
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
                        className={cn('capitalize text-xs', statusColors[job.status] || statusColors.draft)}
                      >
                        {job.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-accent mt-1">{job.clients?.name || 'No client'}</p>
                    
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <MapPin className="w-4 h-4 text-accent" />
                        <span className="truncate">{job.location || 'Remote'}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <DollarSign className="w-4 h-4 text-success" />
                        <span className="truncate">{formatSalary(job)}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Users className="w-4 h-4 text-info" />
                        <span>{job.candidateCount} candidates</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Calendar className="w-4 h-4" />
                        <span>{formatDistanceToNow(new Date(job.created_at), { addSuffix: true })}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      className="text-accent hover:bg-accent/10"
                      onClick={(e) => {
                        e.preventDefault();
                        navigate(`/ai-match?jobId=${job.id}`);
                      }}
                    >
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
                        <DropdownMenuItem onClick={(e) => { e.preventDefault(); navigate(`/jobs/${job.id}`); }}>
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => { e.preventDefault(); navigate(`/jobs/${job.id}/edit`); }}>
                          Edit Job
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {job.status !== 'open' && (
                          <DropdownMenuItem onClick={(e) => { e.preventDefault(); handleStatusChange(job.id, 'open'); }}>
                            Set to Open
                          </DropdownMenuItem>
                        )}
                        {job.status !== 'paused' && (
                          <DropdownMenuItem onClick={(e) => { e.preventDefault(); handleStatusChange(job.id, 'paused'); }}>
                            Pause Job
                          </DropdownMenuItem>
                        )}
                        {job.status !== 'closed' && (
                          <DropdownMenuItem 
                            onClick={(e) => { e.preventDefault(); handleStatusChange(job.id, 'closed'); }}
                          >
                            Close Job
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          onClick={(e) => { e.preventDefault(); setDeleteJobId(job.id); }}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete Job
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      )}

      {!isLoading && filteredJobs.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">No jobs found matching your criteria.</p>
          <Button onClick={() => navigate('/jobs/new')}>
            <Plus className="w-4 h-4 mr-2" />
            Create Your First Job
          </Button>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteJobId} onOpenChange={() => setDeleteJobId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this job?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the job and remove all associated candidate applications.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteJob}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
};

export default JobsPage;
