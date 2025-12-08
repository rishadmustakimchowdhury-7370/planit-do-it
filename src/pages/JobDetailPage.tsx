import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { KanbanBoard } from '@/components/pipeline/KanbanBoard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { AddCandidateToJobDialog } from '@/components/jobs/AddCandidateToJobDialog';
import { 
  ArrowLeft, 
  MapPin, 
  DollarSign, 
  Calendar, 
  Users, 
  Sparkles, 
  Edit, 
  Upload, 
  UserPlus,
  Building2,
  FileText,
  Loader2,
  UserSearch
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';

const statusColors: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground border-muted',
  open: 'bg-success/10 text-success border-success/30',
  paused: 'bg-warning/10 text-warning border-warning/30',
  closed: 'bg-muted text-muted-foreground border-muted',
  filled: 'bg-info/10 text-info border-info/30',
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
  };
}

const JobDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { tenantId } = useAuth();
  const [job, setJob] = useState<Job | null>(null);
  const [candidates, setCandidates] = useState<JobCandidate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRunningMatch, setIsRunningMatch] = useState(false);
  const [showAddCandidateDialog, setShowAddCandidateDialog] = useState(false);

  useEffect(() => {
    if (id && tenantId) {
      fetchJobDetails();
    }
  }, [id, tenantId]);

  const fetchJobDetails = async () => {
    setIsLoading(true);
    try {
      // Fetch job with client info
      const { data: jobData, error: jobError } = await supabase
        .from('jobs')
        .select('*, clients(name)')
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (jobError) throw jobError;
      setJob(jobData);

      // Fetch candidates for this job
      if (jobData) {
        const { data: candidatesData, error: candidatesError } = await supabase
          .from('job_candidates')
          .select('id, candidate_id, stage, match_score, candidates(id, full_name, current_title, avatar_url)')
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
      // Get all candidates for this tenant who aren't already matched to this job
      const { data: allCandidates, error } = await supabase
        .from('candidates')
        .select('id, full_name, skills, summary, current_title')
        .eq('tenant_id', tenantId);

      if (error) throw error;

      let matchedCount = 0;
      for (const candidate of allCandidates || []) {
        // Check if already in job_candidates
        const existing = candidates.find(jc => jc.candidate_id === candidate.id);
        if (existing) continue;

        // Run AI match
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

        // Add to job_candidates with match score
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
      fetchJobDetails(); // Refresh the candidates list
    } catch (error: any) {
      console.error('Error running AI match:', error);
      toast.error(error.message || 'Failed to run AI match');
    } finally {
      setIsRunningMatch(false);
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
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </AppLayout>
    );
  }

  if (!job) {
    return (
      <AppLayout title="Job Not Found">
        <div className="text-center py-12">
          <p className="text-muted-foreground">This job doesn't exist or you don't have access to it.</p>
          <Link to="/jobs" className="text-accent hover:underline mt-2 inline-block">
            Back to Jobs
          </Link>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title={job.title} subtitle={job.clients?.name || 'No client'}>
      {/* Header */}
      <div className="mb-6">
        <Link 
          to="/jobs" 
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Jobs
        </Link>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card rounded-xl border border-border p-6 shadow-sm"
        >
          <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-bold text-foreground">{job.title}</h1>
                <Badge 
                  variant="outline" 
                  className={cn('capitalize', statusColors[job.status || 'draft'])}
                >
                  {job.status || 'draft'}
                </Badge>
              </div>

              {job.clients?.name && (
                <div className="flex items-center gap-2 mt-2">
                  <Building2 className="w-4 h-4 text-accent" />
                  <span className="text-accent font-medium">{job.clients.name}</span>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-6 mt-6 pt-4 border-t border-border">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
                    <MapPin className="w-4 h-4 text-accent" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Location</p>
                    <p className="text-sm font-medium text-foreground">{job.location || 'Not specified'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-success/10 flex items-center justify-center">
                    <DollarSign className="w-4 h-4 text-success" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Salary</p>
                    <p className="text-sm font-medium text-foreground">{formatSalary()}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-info/10 flex items-center justify-center">
                    <Users className="w-4 h-4 text-info" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Candidates</p>
                    <p className="text-sm font-medium text-foreground">{candidates.length}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Posted</p>
                    <p className="text-sm font-medium text-foreground">
                      {job.created_at ? formatDistanceToNow(new Date(job.created_at), { addSuffix: true }) : 'Not posted'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                className="gap-1.5"
                onClick={() => navigate(`/jobs/${id}/edit`)}
              >
                <Edit className="w-4 h-4" />
                Edit Job
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                className="gap-1.5"
                onClick={() => setShowAddCandidateDialog(true)}
              >
                <UserSearch className="w-4 h-4" />
                Add from Database
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                className="gap-1.5"
                onClick={() => navigate(`/candidates/add?jobId=${id}`)}
              >
                <UserPlus className="w-4 h-4" />
                Add New
              </Button>
              <Button 
                size="sm" 
                className="gap-1.5"
                onClick={runAIMatchForAll}
                disabled={isRunningMatch}
              >
                {isRunningMatch ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                Run AI Match
              </Button>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="pipeline" className="w-full">
        <TabsList className="bg-muted/50 p-1">
          <TabsTrigger value="pipeline" className="gap-2">
            <Users className="w-4 h-4" />
            Pipeline ({candidates.length})
          </TabsTrigger>
          <TabsTrigger value="description" className="gap-2">
            <FileText className="w-4 h-4" />
            Job Description
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pipeline" className="mt-6">
          {candidates.length > 0 ? (
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
          ) : (
            <div className="text-center py-12 bg-card rounded-xl border border-border">
              <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-semibold mb-2">No Candidates Yet</h3>
              <p className="text-muted-foreground mb-4">Add candidates or run AI Match to find suitable candidates.</p>
              <div className="flex gap-2 justify-center">
                <Button variant="outline" onClick={() => navigate(`/candidates/add?jobId=${id}`)}>
                  <UserPlus className="w-4 h-4 mr-2" />
                  Add Candidate
                </Button>
                <Button onClick={runAIMatchForAll} disabled={isRunningMatch}>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Run AI Match
                </Button>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="description" className="mt-6">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-card rounded-xl border border-border p-6 shadow-sm"
          >
            <h3 className="text-lg font-semibold mb-4">Job Description</h3>
            {job.description ? (
              <div 
                className="prose prose-sm max-w-none text-muted-foreground [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-2 [&_h1]:text-xl [&_h1]:font-bold [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:text-base [&_h3]:font-medium [&_a]:text-accent [&_a]:underline"
                dangerouslySetInnerHTML={{ __html: job.description }}
              />
            ) : (
              <p className="text-muted-foreground">No description provided.</p>
            )}
            
            {job.requirements && (
              <div className="mt-6 pt-6 border-t border-border">
                <h4 className="font-medium mb-3">Requirements</h4>
                <div 
                  className="prose prose-sm max-w-none text-muted-foreground [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-2"
                  dangerouslySetInnerHTML={{ __html: job.requirements }}
                />
              </div>
            )}
          </motion.div>
        </TabsContent>
      </Tabs>

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
    </AppLayout>
  );
};

export default JobDetailPage;