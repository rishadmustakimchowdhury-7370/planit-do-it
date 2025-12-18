import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { KanbanBoard } from '@/components/pipeline/KanbanBoard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { AddCandidateToJobDialog } from '@/components/jobs/AddCandidateToJobDialog';
import { SuggestedCandidates } from '@/components/jobs/SuggestedCandidates';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { MatchScoreCircle } from '@/components/matching/MatchScoreCircle';
import { 
  ArrowLeft, 
  MapPin, 
  DollarSign, 
  Calendar, 
  Users, 
  Sparkles, 
  Edit, 
  UserPlus,
  Building2,
  FileText,
  Loader2,
  UserSearch,
  LayoutGrid,
  List,
  Table,
  Kanban,
  MoreHorizontal,
  Trash2,
  Eye
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';
import { useRecruiterActivity } from '@/hooks/useRecruiterActivity';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table as UITable,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const statusColors: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground border-muted',
  open: 'bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-400',
  paused: 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/30 dark:text-amber-400',
  closed: 'bg-slate-100 text-slate-600 border-slate-300 dark:bg-slate-800 dark:text-slate-400',
  filled: 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-400',
};

const stageLabels: Record<string, string> = {
  applied: 'New',
  screening: 'Screening',
  interview: 'Interview',
  technical: 'Technical',
  offer: 'Offer',
  hired: 'Hired',
  rejected: 'Rejected',
};

const stageColors: Record<string, string> = {
  applied: 'bg-slate-100 text-slate-700 dark:bg-slate-800',
  screening: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40',
  interview: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40',
  technical: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40',
  offer: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40',
  hired: 'bg-green-100 text-green-700 dark:bg-green-900/40',
  rejected: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40',
};

interface Job {
  id: string;
  title: string;
  description: string | null;
  requirements: string | null;
  location: string | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string | null;
  status: string | null;
  created_at: string | null;
  client_id: string | null;
  clients?: { name: string } | null;
}

interface JobCandidate {
  id: string;
  candidate_id: string;
  stage: string | null;
  match_score: number | null;
  candidates: {
    id: string;
    full_name: string;
    current_title: string | null;
    avatar_url: string | null;
    email: string;
    location: string | null;
  };
}

type ViewMode = 'kanban' | 'grid' | 'table';

const JobDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { tenantId } = useAuth();
  const { logActivity } = useRecruiterActivity();
  const [job, setJob] = useState<Job | null>(null);
  const [candidates, setCandidates] = useState<JobCandidate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRunningMatch, setIsRunningMatch] = useState(false);
  const [showAddCandidateDialog, setShowAddCandidateDialog] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('kanban');
  const [deleteCandidate, setDeleteCandidate] = useState<JobCandidate | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (id && tenantId) {
      fetchJobDetails();
    }
  }, [id, tenantId]);

  const fetchJobDetails = async () => {
    setIsLoading(true);
    try {
      const { data: jobData, error: jobError } = await supabase
        .from('jobs')
        .select('*, clients(name)')
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (jobError) throw jobError;
      setJob(jobData);

      if (jobData) {
        const { data: candidatesData, error: candidatesError } = await supabase
          .from('job_candidates')
          .select('id, candidate_id, stage, match_score, candidates(id, full_name, current_title, avatar_url, email, location)')
          .eq('job_id', id)
          .eq('tenant_id', tenantId);

        if (candidatesError) throw candidatesError;
        setCandidates(candidatesData as unknown as JobCandidate[] || []);
      }
    } catch (error) {
      console.error('Error fetching job:', error);
      toast.error('Failed to load job details');
    } finally {
      setIsLoading(false);
    }
  };

  const runAIMatchForAll = async () => {
    if (!job) return;
    
    setIsRunningMatch(true);
    try {
      const { data: allCandidates, error } = await supabase
        .from('candidates')
        .select('id, full_name, skills, summary, current_title')
        .eq('tenant_id', tenantId);

      if (error) throw error;

      let matchedCount = 0;
      for (const candidate of allCandidates || []) {
        const existing = candidates.find(jc => jc.candidate_id === candidate.id);
        if (existing) continue;

        const { data: matchData, error: matchError } = await supabase.functions.invoke('ai-match', {
          body: {
            jobDescription: job.description || '',
            jobTitle: job.title,
            candidateResume: candidate.summary || '',
            candidateSkills: candidate.skills || []
          }
        });

        if (matchError) {
          console.error('Match error for candidate:', candidate.id, matchError);
          continue;
        }

        const { error: insertError } = await supabase
          .from('job_candidates')
          .insert({
            job_id: job.id,
            candidate_id: candidate.id,
            tenant_id: tenantId,
            match_score: matchData.score || 0,
            match_strengths: matchData.strengths || [],
            match_gaps: matchData.gaps || [],
            match_explanation: matchData.explanation || '',
            match_confidence: matchData.confidence || 0,
            matched_at: new Date().toISOString(),
            stage: 'applied'
          });

        if (!insertError) matchedCount++;
      }

      toast.success(`AI Match completed! ${matchedCount} new candidates matched.`);
      fetchJobDetails();
    } catch (error: any) {
      console.error('Error running AI match:', error);
      toast.error(error.message || 'Failed to run AI match');
    } finally {
      setIsRunningMatch(false);
    }
  };

  const handleRemoveCandidate = async () => {
    if (!deleteCandidate) return;
    
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('job_candidates')
        .delete()
        .eq('id', deleteCandidate.id);

      if (error) throw error;

      toast.success(`${deleteCandidate.candidates.full_name} removed from job`);
      setDeleteCandidate(null);
      fetchJobDetails();
    } catch (error: any) {
      console.error('Error removing candidate:', error);
      toast.error('Failed to remove candidate');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleStageChange = async (candidateId: string, newStage: string) => {
    try {
      const candidate = candidates.find(c => c.id === candidateId);
      if (!candidate) return;

      const { error } = await supabase
        .from('job_candidates')
        .update({ 
          stage: newStage as 'applied' | 'screening' | 'interview' | 'technical' | 'offer' | 'hired' | 'rejected',
          stage_updated_at: new Date().toISOString()
        })
        .eq('id', candidateId);

      if (error) throw error;

      // Sync status
      const pipelineToStatus: Record<string, string> = {
        applied: 'new',
        screening: 'screening',
        interview: 'interviewing',
        technical: 'interviewing',
        offer: 'offered',
        hired: 'hired',
        rejected: 'rejected',
      };

      await supabase
        .from('candidates')
        .update({ 
          status: pipelineToStatus[newStage] as any,
          updated_at: new Date().toISOString()
        })
        .eq('id', candidate.candidate_id);

      toast.success(`Status updated to ${stageLabels[newStage]}`);

      // Log KPI activity based on stage
      const stageActivityMap: Record<string, string | null> = {
        screening: 'screening_completed',
        interview: 'interview_scheduled',
        technical: 'interview_scheduled',
        offer: 'offer_sent',
        hired: 'candidate_hired',
        rejected: 'candidate_rejected',
      };
      
      const activityType = stageActivityMap[newStage];
      if (activityType) {
        await logActivity({
          action_type: activityType as any,
          candidate_id: candidate.candidate_id,
          job_id: id,
          metadata: { new_stage: newStage }
        });
      }

      fetchJobDetails();
    } catch (error) {
      console.error('Error updating stage:', error);
      toast.error('Failed to update status');
    }
  };

  const formatSalary = () => {
    if (!job?.salary_min && !job?.salary_max) return 'Not specified';
    const currency = job.salary_currency || 'USD';
    if (job.salary_min && job.salary_max) {
      return `${currency} ${job.salary_min.toLocaleString()} - ${job.salary_max.toLocaleString()}`;
    }
    return job.salary_min ? `${currency} ${job.salary_min.toLocaleString()}+` : `Up to ${currency} ${job.salary_max?.toLocaleString()}`;
  };

  if (isLoading) {
    return (
      <AppLayout title="Loading...">
        <div className="space-y-6">
          <Skeleton className="h-48 w-full rounded-xl" />
          <Skeleton className="h-96 w-full rounded-xl" />
        </div>
      </AppLayout>
    );
  }

  if (!job) {
    return (
      <AppLayout title="Job Not Found">
        <div className="text-center py-16">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
            <FileText className="w-8 h-8 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Job Not Found</h2>
          <p className="text-muted-foreground mb-4">This job doesn't exist or you don't have access to it.</p>
          <Button asChild variant="outline">
            <Link to="/jobs">Back to Jobs</Link>
          </Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title={job.title} subtitle={job.clients?.name || 'No client'}>
      {/* Header */}
      <div className="mb-8">
        <Link 
          to="/jobs" 
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6 group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          Back to Jobs
        </Link>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-card to-card/80 rounded-2xl border border-border/60 p-6 lg:p-8 shadow-lg"
        >
          <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
            <div className="flex-1 space-y-4">
              <div className="flex items-start gap-4 flex-wrap">
                <div className="flex-1">
                  <h1 className="text-2xl lg:text-3xl font-bold text-foreground tracking-tight">
                    {job.title}
                  </h1>
                  {job.clients?.name && (
                    <div className="flex items-center gap-2 mt-2">
                      <Building2 className="w-4 h-4 text-accent" />
                      <span className="text-accent font-medium">{job.clients.name}</span>
                    </div>
                  )}
                </div>
                <Badge 
                  variant="outline" 
                  className={cn('capitalize text-sm px-3 py-1 font-medium', statusColors[job.status || 'draft'])}
                >
                  {job.status || 'draft'}
                </Badge>
              </div>

              <div className="flex flex-wrap items-center gap-6 pt-4 border-t border-border/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
                    <MapPin className="w-5 h-5 text-accent" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground font-medium">Location</p>
                    <p className="text-sm font-semibold text-foreground">{job.location || 'Remote'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                    <DollarSign className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground font-medium">Salary</p>
                    <p className="text-sm font-semibold text-foreground">{formatSalary()}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                    <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground font-medium">Candidates</p>
                    <p className="text-sm font-semibold text-foreground">{candidates.length}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground font-medium">Posted</p>
                    <p className="text-sm font-semibold text-foreground">
                      {job.created_at ? formatDistanceToNow(new Date(job.created_at), { addSuffix: true }) : 'Not posted'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 lg:flex-nowrap">
              <Button 
                variant="outline" 
                size="sm" 
                className="gap-1.5 h-10"
                onClick={() => navigate(`/jobs/${id}/edit`)}
              >
                <Edit className="w-4 h-4" />
                Edit
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                className="gap-1.5 h-10"
                onClick={() => setShowAddCandidateDialog(true)}
              >
                <UserSearch className="w-4 h-4" />
                Add from DB
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                className="gap-1.5 h-10"
                onClick={() => navigate(`/candidates/add?jobId=${id}`)}
              >
                <UserPlus className="w-4 h-4" />
                Add New
              </Button>
              <Button 
                size="sm" 
                className="gap-1.5 h-10 shadow-md"
                onClick={runAIMatchForAll}
                disabled={isRunningMatch}
              >
                {isRunningMatch ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                AI Match
              </Button>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="pipeline" className="w-full">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <TabsList className="bg-muted/50 p-1 h-auto">
            <TabsTrigger value="pipeline" className="gap-2 px-4 py-2">
              <Users className="w-4 h-4" />
              Pipeline ({candidates.length})
            </TabsTrigger>
            <TabsTrigger value="description" className="gap-2 px-4 py-2">
              <FileText className="w-4 h-4" />
              Job Description
            </TabsTrigger>
          </TabsList>

          {/* View Mode Switcher */}
          <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-lg">
            <Button
              variant={viewMode === 'kanban' ? 'default' : 'ghost'}
              size="sm"
              className="h-8 px-3 gap-1.5"
              onClick={() => setViewMode('kanban')}
            >
              <Kanban className="w-4 h-4" />
              <span className="hidden sm:inline">Kanban</span>
            </Button>
            <Button
              variant={viewMode === 'grid' ? 'default' : 'ghost'}
              size="sm"
              className="h-8 px-3 gap-1.5"
              onClick={() => setViewMode('grid')}
            >
              <LayoutGrid className="w-4 h-4" />
              <span className="hidden sm:inline">Grid</span>
            </Button>
            <Button
              variant={viewMode === 'table' ? 'default' : 'ghost'}
              size="sm"
              className="h-8 px-3 gap-1.5"
              onClick={() => setViewMode('table')}
            >
              <Table className="w-4 h-4" />
              <span className="hidden sm:inline">Table</span>
            </Button>
          </div>
        </div>

        <TabsContent value="pipeline" className="mt-0">
          <AnimatePresence mode="wait">
            {candidates.length > 0 ? (
              <motion.div
                key={viewMode}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                {viewMode === 'kanban' && (
                  <KanbanBoard 
                    candidates={candidates.map(jc => ({
                      id: jc.id,
                      jobId: id!,
                      candidateId: jc.candidate_id,
                      candidate: {
                        id: jc.candidates.id,
                        name: jc.candidates.full_name,
                        currentTitle: jc.candidates.current_title || '',
                        avatar: jc.candidates.avatar_url || undefined,
                        matchScore: jc.match_score || undefined,
                      },
                      stage: (jc.stage as 'applied' | 'screening' | 'interview' | 'technical' | 'offer' | 'hired' | 'rejected') || 'applied',
                      matchScore: jc.match_score || undefined,
                      appliedAt: new Date()
                    }))}
                    onRefresh={fetchJobDetails}
                  />
                )}

                {viewMode === 'grid' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {candidates.map((jc, index) => (
                      <motion.div
                        key={jc.id}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: index * 0.05 }}
                        className="group relative bg-card rounded-xl border border-border p-5 hover:shadow-lg hover:border-accent/30 transition-all duration-200"
                      >
                        <button
                          onClick={() => setDeleteCandidate(jc)}
                          className="absolute top-3 right-3 w-7 h-7 bg-destructive/10 text-destructive rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive hover:text-white"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>

                        <div className="flex items-start gap-4">
                          <Avatar className="w-14 h-14 ring-2 ring-accent/20">
                            <AvatarImage src={jc.candidates.avatar_url || undefined} />
                            <AvatarFallback className="bg-gradient-to-br from-accent/20 to-accent/10 text-accent text-lg font-semibold">
                              {jc.candidates.full_name.split(' ').map(n => n[0]).join('')}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <Link 
                              to={`/candidates/${jc.candidate_id}`}
                              className="font-semibold text-foreground hover:text-accent transition-colors"
                            >
                              {jc.candidates.full_name}
                            </Link>
                            <p className="text-sm text-muted-foreground truncate">
                              {jc.candidates.current_title || 'No title'}
                            </p>
                            {jc.candidates.location && (
                              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                                <MapPin className="w-3 h-3" />
                                {jc.candidates.location}
                              </p>
                            )}
                          </div>
                          {jc.match_score && (
                            <MatchScoreCircle score={jc.match_score} size="md" />
                          )}
                        </div>

                        <div className="mt-4 pt-4 border-t border-border/50 flex items-center justify-between">
                          <Badge className={cn('text-xs', stageColors[jc.stage || 'applied'])}>
                            {stageLabels[jc.stage || 'applied']}
                          </Badge>
                          <div className="flex items-center gap-2">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-8 px-2"
                              asChild
                            >
                              <Link to={`/candidates/${jc.candidate_id}`}>
                                <Eye className="w-4 h-4" />
                              </Link>
                            </Button>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}

                {viewMode === 'table' && (
                  <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
                    <UITable>
                      <TableHeader>
                        <TableRow className="bg-muted/30">
                          <TableHead className="font-semibold">Candidate</TableHead>
                          <TableHead className="font-semibold">Title</TableHead>
                          <TableHead className="font-semibold">Location</TableHead>
                          <TableHead className="font-semibold">Stage</TableHead>
                          <TableHead className="font-semibold text-center">Match</TableHead>
                          <TableHead className="font-semibold text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {candidates.map((jc) => (
                          <TableRow key={jc.id} className="group">
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <Avatar className="w-9 h-9">
                                  <AvatarImage src={jc.candidates.avatar_url || undefined} />
                                  <AvatarFallback className="text-xs bg-accent/10 text-accent">
                                    {jc.candidates.full_name.split(' ').map(n => n[0]).join('')}
                                  </AvatarFallback>
                                </Avatar>
                                <Link 
                                  to={`/candidates/${jc.candidate_id}`}
                                  className="font-medium text-foreground hover:text-accent transition-colors"
                                >
                                  {jc.candidates.full_name}
                                </Link>
                              </div>
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {jc.candidates.current_title || '—'}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {jc.candidates.location || '—'}
                            </TableCell>
                            <TableCell>
                              <Select 
                                value={jc.stage || 'applied'} 
                                onValueChange={(value) => handleStageChange(jc.id, value)}
                              >
                                <SelectTrigger className="w-[130px] h-8">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {Object.entries(stageLabels).map(([value, label]) => (
                                    <SelectItem key={value} value={value}>{label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell className="text-center">
                              {jc.match_score ? (
                                <span className={cn(
                                  'font-semibold',
                                  jc.match_score >= 80 ? 'text-emerald-600' :
                                  jc.match_score >= 60 ? 'text-amber-600' : 'text-rose-600'
                                )}>
                                  {jc.match_score}%
                                </span>
                              ) : '—'}
                            </TableCell>
                            <TableCell className="text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                    <MoreHorizontal className="w-4 h-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem asChild>
                                    <Link to={`/candidates/${jc.candidate_id}`}>
                                      <Eye className="w-4 h-4 mr-2" />
                                      View Profile
                                    </Link>
                                  </DropdownMenuItem>
                                  <DropdownMenuItem 
                                    className="text-destructive"
                                    onClick={() => setDeleteCandidate(jc)}
                                  >
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    Remove
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </UITable>
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-16 bg-gradient-to-br from-card to-muted/30 rounded-2xl border border-border"
              >
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                  <Users className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-2">No Candidates Yet</h3>
                <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                  Add candidates manually or run AI Match to find suitable candidates from your database.
                </p>
                <div className="flex gap-3 justify-center">
                  <Button variant="outline" onClick={() => navigate(`/candidates/add?jobId=${id}`)}>
                    <UserPlus className="w-4 h-4 mr-2" />
                    Add Candidate
                  </Button>
                  <Button onClick={runAIMatchForAll} disabled={isRunningMatch}>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Run AI Match
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </TabsContent>

        <TabsContent value="description" className="mt-0">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-card rounded-2xl border border-border p-8 shadow-sm"
          >
            <h3 className="text-xl font-semibold mb-6 flex items-center gap-2">
              <FileText className="w-5 h-5 text-accent" />
              Job Description
            </h3>
            {job.description ? (
              <div 
                className="prose prose-sm max-w-none text-muted-foreground dark:prose-invert [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-3 [&_h1]:text-xl [&_h1]:font-bold [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:text-base [&_h3]:font-medium [&_a]:text-accent [&_a]:underline"
                dangerouslySetInnerHTML={{ __html: job.description }}
              />
            ) : (
              <p className="text-muted-foreground italic">No description provided.</p>
            )}
            
            {job.requirements && (
              <div className="mt-8 pt-8 border-t border-border">
                <h4 className="text-lg font-semibold mb-4">Requirements</h4>
                <div 
                  className="prose prose-sm max-w-none text-muted-foreground dark:prose-invert [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-3"
                  dangerouslySetInnerHTML={{ __html: job.requirements }}
                />
              </div>
            )}
          </motion.div>
        </TabsContent>
      </Tabs>

      {/* Suggested Candidates Section */}
      {job && (
        <div className="mt-8">
          <SuggestedCandidates
            jobId={job.id}
            jobTitle={job.title}
            jobDescription={job.description}
            jobSkills={Array.isArray((job as any).skills) ? (job as any).skills : []}
            onCandidateAdded={fetchJobDetails}
          />
        </div>
      )}

      {/* Add Candidate from Database Dialog */}
      {job && (
        <AddCandidateToJobDialog
          open={showAddCandidateDialog}
          onOpenChange={setShowAddCandidateDialog}
          jobId={job.id}
          jobTitle={job.title}
          existingCandidateIds={candidates.map(c => c.candidate_id)}
          onSuccess={fetchJobDetails}
        />
      )}

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteCandidate} onOpenChange={() => setDeleteCandidate(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-destructive" />
              Remove Candidate from Job
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove <strong>{deleteCandidate?.candidates.full_name}</strong> from this job? 
              This will only remove them from this job's pipeline, not delete the candidate.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleRemoveCandidate} 
              disabled={isDeleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isDeleting ? 'Removing...' : 'Remove'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
};

export default JobDetailPage;