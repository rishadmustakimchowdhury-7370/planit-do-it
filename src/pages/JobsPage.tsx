import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Plus, Search, LayoutGrid, List, MapPin, Users, Calendar, 
  DollarSign, MoreHorizontal, Sparkles, Loader2, Trash2, 
  Building2, Clock, Briefcase, Eye, Edit3, Pause, Play, XCircle, UserCog
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDistanceToNow, format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
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
import { AssignJobDialog } from '@/components/jobs/AssignJobDialog';
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
  employment_type: string | null;
  experience_level: string | null;
  is_remote: boolean | null;
  assigned_to: string | null;
  clients?: { name: string; logo_url: string | null } | null;
}

interface JobWithCandidateCount extends Job {
  candidateCount: number;
}

const statusConfig: Record<string, { color: string; icon: React.ComponentType<{ className?: string }> }> = {
  open: { color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20', icon: Play },
  closed: { color: 'bg-slate-500/10 text-slate-500 border-slate-500/20', icon: XCircle },
  paused: { color: 'bg-amber-500/10 text-amber-600 border-amber-500/20', icon: Pause },
  draft: { color: 'bg-blue-500/10 text-blue-600 border-blue-500/20', icon: Edit3 },
  filled: { color: 'bg-purple-500/10 text-purple-600 border-purple-500/20', icon: Users },
};

const JobsPage = () => {
  const navigate = useNavigate();
  const { tenantId, user, isOwner, isManager } = useAuth();
  const [view, setView] = useState<'grid' | 'list'>('list');
  const [filter, setFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [jobs, setJobs] = useState<JobWithCandidateCount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteJobId, setDeleteJobId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [assignJob, setAssignJob] = useState<Job | null>(null);

  const canAssign = isOwner || isManager;

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
        .select('*, clients(name, logo_url)')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (jobsError) throw jobsError;

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
      await supabase
        .from('job_candidates')
        .delete()
        .eq('job_id', deleteJobId);

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
    filled: jobs.filter(j => j.status === 'filled').length,
  };

  const formatSalary = (job: Job) => {
    if (!job.salary_min && !job.salary_max) return 'Negotiable';
    const currency = job.salary_currency || 'USD';
    const symbol = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : currency === 'BDT' ? '৳' : currency;
    if (job.salary_min && job.salary_max) {
      return `${symbol}${(job.salary_min / 1000).toFixed(0)}k - ${symbol}${(job.salary_max / 1000).toFixed(0)}k`;
    }
    return job.salary_min ? `${symbol}${(job.salary_min / 1000).toFixed(0)}k+` : `Up to ${symbol}${(job.salary_max! / 1000).toFixed(0)}k`;
  };

  const JobCardGridView = ({ job, index }: { job: JobWithCandidateCount; index: number }) => {
    const StatusIcon = statusConfig[job.status]?.icon || Edit3;
    
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: index * 0.05 }}
        className="h-full"
      >
        <Card className="h-full group hover:shadow-xl hover:border-primary/30 transition-all duration-300 overflow-hidden">
          <CardContent className="p-0 h-full flex flex-col">
            {/* Header with gradient */}
            <div className="bg-gradient-to-br from-primary/5 via-accent/5 to-transparent p-5 border-b border-border/50">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <Link to={`/jobs/${job.id}`} className="block group/title">
                    <h3 className="font-semibold text-lg text-foreground group-hover/title:text-primary transition-colors line-clamp-2">
                      {job.title}
                    </h3>
                  </Link>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge 
                      variant="outline" 
                      className={cn('capitalize text-xs font-medium gap-1', statusConfig[job.status]?.color)}
                    >
                      <StatusIcon className="w-3 h-3" />
                      {job.status}
                    </Badge>
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem onClick={() => navigate(`/jobs/${job.id}`)}>
                      <Eye className="w-4 h-4 mr-2" />
                      View Details
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate(`/jobs/${job.id}/edit`)}>
                      <Edit3 className="w-4 h-4 mr-2" />
                      Edit Job
                    </DropdownMenuItem>
                    {canAssign && (
                      <DropdownMenuItem onClick={() => setAssignJob(job)}>
                        <UserCog className="w-4 h-4 mr-2" />
                        Assign Job
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    {job.status !== 'open' && (
                      <DropdownMenuItem onClick={() => handleStatusChange(job.id, 'open')}>
                        <Play className="w-4 h-4 mr-2" />
                        Set to Open
                      </DropdownMenuItem>
                    )}
                    {job.status !== 'paused' && (
                      <DropdownMenuItem onClick={() => handleStatusChange(job.id, 'paused')}>
                        <Pause className="w-4 h-4 mr-2" />
                        Pause Job
                      </DropdownMenuItem>
                    )}
                    {job.status !== 'closed' && (
                      <DropdownMenuItem onClick={() => handleStatusChange(job.id, 'closed')}>
                        <XCircle className="w-4 h-4 mr-2" />
                        Close Job
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      onClick={() => setDeleteJobId(job.id)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete Job
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* Content */}
            <div className="p-5 flex-1 flex flex-col">
              {/* Client */}
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                  <Building2 className="w-4 h-4 text-muted-foreground" />
                </div>
                <span className="text-sm font-medium text-foreground truncate">
                  {job.clients?.name || 'No client assigned'}
                </span>
              </div>

              {/* Info Grid */}
              <div className="space-y-3 flex-1">
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <span className="text-muted-foreground truncate">
                    {job.location || 'Location TBD'}
                    {job.is_remote && ' • Remote'}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <DollarSign className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <span className="text-muted-foreground">{formatSalary(job)}</span>
                </div>
                {job.employment_type && (
                  <div className="flex items-center gap-2 text-sm">
                    <Briefcase className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <span className="text-muted-foreground capitalize">{job.employment_type.replace('_', ' ')}</span>
                  </div>
                )}
              </div>

              {/* Footer Stats */}
              <div className="mt-4 pt-4 border-t border-border/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5">
                      <Users className="w-4 h-4 text-primary" />
                      <span className="text-sm font-medium">{job.candidateCount}</span>
                      <span className="text-xs text-muted-foreground">candidates</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    {formatDistanceToNow(new Date(job.created_at), { addSuffix: true })}
                  </div>
                </div>
              </div>
            </div>

            {/* Action Footer */}
            <div className="px-5 pb-5">
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full gap-2 group/btn hover:bg-primary hover:text-primary-foreground hover:border-primary"
                onClick={(e) => {
                  e.preventDefault();
                  navigate(`/ai-match?jobId=${job.id}`);
                }}
              >
                <Sparkles className="w-4 h-4 group-hover/btn:animate-pulse" />
                AI Match Candidates
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    );
  };

  const JobCardListView = ({ job, index }: { job: JobWithCandidateCount; index: number }) => {
    const StatusIcon = statusConfig[job.status]?.icon || Edit3;
    
    return (
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3, delay: index * 0.03 }}
      >
        <Card className="group hover:shadow-lg hover:border-primary/30 transition-all duration-300">
          <CardContent className="p-0">
            <div className="flex flex-col lg:flex-row lg:items-center gap-4 p-5">
              {/* Main Info */}
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-3 mb-2">
                  <Link to={`/jobs/${job.id}`} className="group/title">
                    <h3 className="font-semibold text-lg text-foreground group-hover/title:text-primary transition-colors">
                      {job.title}
                    </h3>
                  </Link>
                  <Badge 
                    variant="outline" 
                    className={cn('capitalize text-xs font-medium gap-1', statusConfig[job.status]?.color)}
                  >
                    <StatusIcon className="w-3 h-3" />
                    {job.status}
                  </Badge>
                </div>
                
                <div className="flex items-center gap-2 mb-3">
                  <Building2 className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground font-medium">
                    {job.clients?.name || 'No client assigned'}
                  </span>
                </div>

                {/* Meta Info */}
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <MapPin className="w-4 h-4 text-accent" />
                    <span>{job.location || 'Location TBD'}</span>
                    {job.is_remote && (
                      <Badge variant="secondary" className="ml-1 text-xs">Remote</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <DollarSign className="w-4 h-4 text-emerald-500" />
                    <span className="font-medium text-foreground">{formatSalary(job)}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Users className="w-4 h-4 text-primary" />
                    <span className="font-medium text-foreground">{job.candidateCount}</span>
                    <span>candidates</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Calendar className="w-4 h-4" />
                    <span>{format(new Date(job.created_at), 'MMM d, yyyy')}</span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 lg:pl-4 lg:border-l border-border/50">
                <Button 
                  size="sm" 
                  variant="outline"
                  className="gap-2 hover:bg-primary hover:text-primary-foreground hover:border-primary"
                  onClick={(e) => {
                    e.preventDefault();
                    navigate(`/ai-match?jobId=${job.id}`);
                  }}
                >
                  <Sparkles className="w-4 h-4" />
                  AI Match
                </Button>
                <Button 
                  size="sm" 
                  variant="ghost"
                  onClick={() => navigate(`/jobs/${job.id}`)}
                >
                  <Eye className="w-4 h-4" />
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem onClick={() => navigate(`/jobs/${job.id}`)}>
                      <Eye className="w-4 h-4 mr-2" />
                      View Details
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate(`/jobs/${job.id}/edit`)}>
                      <Edit3 className="w-4 h-4 mr-2" />
                      Edit Job
                    </DropdownMenuItem>
                    {canAssign && (
                      <DropdownMenuItem onClick={() => setAssignJob(job)}>
                        <UserCog className="w-4 h-4 mr-2" />
                        Assign Job
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    {job.status !== 'open' && (
                      <DropdownMenuItem onClick={() => handleStatusChange(job.id, 'open')}>
                        <Play className="w-4 h-4 mr-2" />
                        Set to Open
                      </DropdownMenuItem>
                    )}
                    {job.status !== 'paused' && (
                      <DropdownMenuItem onClick={() => handleStatusChange(job.id, 'paused')}>
                        <Pause className="w-4 h-4 mr-2" />
                        Pause Job
                      </DropdownMenuItem>
                    )}
                    {job.status !== 'closed' && (
                      <DropdownMenuItem onClick={() => handleStatusChange(job.id, 'closed')}>
                        <XCircle className="w-4 h-4 mr-2" />
                        Close Job
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      onClick={() => setDeleteJobId(job.id)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete Job
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    );
  };

  return (
    <AppLayout title="Jobs" subtitle="Manage your job openings and track candidates.">
      {/* Stats Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
        {(['open', 'draft', 'paused', 'closed', 'filled'] as const).map((status) => {
          const config = statusConfig[status];
          const Icon = config?.icon || Edit3;
          return (
            <motion.button
              key={status}
              onClick={() => setFilter(filter === status ? 'all' : status)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={cn(
                'relative p-4 rounded-xl border transition-all duration-200',
                filter === status 
                  ? 'border-primary bg-primary/5 shadow-sm' 
                  : 'border-border bg-card hover:border-primary/30 hover:shadow-sm'
              )}
            >
              <div className="flex items-center justify-between mb-2">
                <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', config?.color)}>
                  <Icon className="w-4 h-4" />
                </div>
                <span className="text-2xl font-bold text-foreground">{statusCounts[status]}</span>
              </div>
              <p className="text-xs text-muted-foreground capitalize text-left">{status} Jobs</p>
              {filter === status && (
                <motion.div 
                  layoutId="activeFilter"
                  className="absolute inset-0 border-2 border-primary rounded-xl"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                />
              )}
            </motion.button>
          );
        })}
      </div>

      {/* Search and Actions Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-initial">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search jobs by title, client, location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full sm:w-80 pl-9 bg-card"
            />
          </div>
          {filter !== 'all' && (
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setFilter('all')}
              className="text-muted-foreground"
            >
              Clear filter
            </Button>
          )}
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          <div className="flex items-center p-1 bg-muted rounded-lg">
            <button
              onClick={() => setView('list')}
              className={cn(
                'p-2 rounded-md transition-all duration-200',
                view === 'list' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setView('grid')}
              className={cn(
                'p-2 rounded-md transition-all duration-200',
                view === 'grid' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
          <Button className="gap-2 shadow-sm" onClick={() => navigate('/jobs/new')}>
            <Plus className="w-4 h-4" />
            Add Job
          </Button>
        </div>
      </div>

      {/* Results count */}
      {!isLoading && (
        <p className="text-sm text-muted-foreground mb-4">
          Showing {filteredJobs.length} of {jobs.length} jobs
          {filter !== 'all' && ` • Filtered by: ${filter}`}
          {searchQuery && ` • Search: "${searchQuery}"`}
        </p>
      )}

      {/* Jobs List */}
      {isLoading ? (
        <div className={cn(
          view === 'grid' 
            ? 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6' 
            : 'space-y-4'
        )}>
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className={view === 'grid' ? 'h-72 rounded-xl' : 'h-32 rounded-xl'} />
          ))}
        </div>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div
            key={view}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className={cn(
              view === 'grid' 
                ? 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6' 
                : 'space-y-4'
            )}
          >
            {filteredJobs.map((job, index) => (
              view === 'grid' 
                ? <JobCardGridView key={job.id} job={job} index={index} />
                : <JobCardListView key={job.id} job={job} index={index} />
            ))}
          </motion.div>
        </AnimatePresence>
      )}

      {!isLoading && filteredJobs.length === 0 && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-16 px-4"
        >
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
            <Briefcase className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">No jobs found</h3>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            {searchQuery || filter !== 'all' 
              ? "Try adjusting your search or filter to find what you're looking for."
              : "Get started by creating your first job posting."}
          </p>
          {!searchQuery && filter === 'all' && (
            <Button onClick={() => navigate('/jobs/new')} className="gap-2">
              <Plus className="w-4 h-4" />
              Create Your First Job
            </Button>
          )}
        </motion.div>
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

      {/* Assign Job Dialog */}
      {assignJob && (
        <AssignJobDialog
          open={!!assignJob}
          onOpenChange={(open) => !open && setAssignJob(null)}
          jobId={assignJob.id}
          jobTitle={assignJob.title}
          currentAssigneeId={assignJob.assigned_to}
          onAssignmentComplete={() => {
            setAssignJob(null);
            fetchJobs();
          }}
        />
      )}
    </AppLayout>
  );
};

export default JobsPage;
