import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MatchScoreCircle } from './MatchScoreCircle';
import { Sparkles, CheckCircle, XCircle, Loader2, RefreshCw, Briefcase } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

interface Job {
  id: string;
  title: string;
  client_name?: string;
  description?: string;
}

interface MatchResult {
  match_score: number | null;
  match_strengths: string[] | null;
  match_gaps: string[] | null;
  match_explanation: string | null;
  match_confidence: number | null;
}

interface JobAIMatchSectionProps {
  candidateId: string;
  candidateName: string;
  candidateSkills: string[] | null;
  candidateResume?: string | null;
}

interface CandidateData {
  full_name: string;
  current_title: string | null;
  current_company: string | null;
  location: string | null;
  experience_years: number | null;
  summary: string | null;
  skills: any;
  work_history: any;
  education: any;
  cv_parsed_data: any;
  cv_file_url: string | null;
}

export function JobAIMatchSection({ 
  candidateId, 
  candidateName, 
  candidateSkills,
  candidateResume 
}: JobAIMatchSectionProps) {
  const { tenantId } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [matchResult, setMatchResult] = useState<MatchResult | null>(null);
  const [isLoadingJobs, setIsLoadingJobs] = useState(true);
  const [isLoadingMatch, setIsLoadingMatch] = useState(false);
  const [isRunningMatch, setIsRunningMatch] = useState(false);
  const [candidateData, setCandidateData] = useState<CandidateData | null>(null);
  const [cvContent, setCvContent] = useState<string>('');

  useEffect(() => {
    if (tenantId) {
      fetchJobs();
    }
  }, [tenantId]);

  useEffect(() => {
    if (candidateId) {
      fetchCandidateData();
    }
  }, [candidateId]);

  useEffect(() => {
    if (selectedJobId && candidateId) {
      fetchMatchForJob(selectedJobId);
    } else {
      setMatchResult(null);
    }
  }, [selectedJobId, candidateId]);

  const fetchCandidateData = async () => {
    try {
      const { data, error } = await supabase
        .from('candidates')
        .select('full_name, current_title, current_company, location, experience_years, summary, skills, work_history, education, cv_parsed_data, cv_file_url')
        .eq('id', candidateId)
        .single();

      if (error) throw error;
      setCandidateData(data);

      // If CV file exists but no parsed data, try to download content
      if (data?.cv_file_url && !data?.cv_parsed_data) {
        try {
          const { data: fileData, error: fileError } = await supabase.storage
            .from('documents')
            .download(data.cv_file_url);
          
          if (!fileError && fileData) {
            const text = await fileData.text().catch(() => '');
            if (text && text.length > 100) {
              setCvContent(text.substring(0, 10000));
            }
          }
        } catch (e) {
          console.log('Could not fetch CV file content:', e);
        }
      }
    } catch (error) {
      console.error('Error fetching candidate data:', error);
    }
  };

  const fetchJobs = async () => {
    setIsLoadingJobs(true);
    try {
      const { data, error } = await supabase
        .from('jobs')
        .select(`
          id,
          title,
          description,
          clients (name)
        `)
        .eq('tenant_id', tenantId)
        .in('status', ['open', 'draft'])
        .order('created_at', { ascending: false });

      if (error) throw error;

      setJobs(data?.map(job => ({
        id: job.id,
        title: job.title,
        client_name: (job.clients as any)?.name,
        description: job.description
      })) || []);
    } catch (error) {
      console.error('Error fetching jobs:', error);
      toast.error('Failed to load jobs');
    } finally {
      setIsLoadingJobs(false);
    }
  };

  const fetchMatchForJob = async (jobId: string) => {
    setIsLoadingMatch(true);
    try {
      const { data, error } = await supabase
        .from('job_candidates')
        .select('match_score, match_strengths, match_gaps, match_explanation, match_confidence')
        .eq('candidate_id', candidateId)
        .eq('job_id', jobId)
        .maybeSingle();

      if (error) throw error;

      if (data && data.match_score !== null) {
        setMatchResult({
          match_score: data.match_score,
          match_strengths: Array.isArray(data.match_strengths) ? data.match_strengths as string[] : null,
          match_gaps: Array.isArray(data.match_gaps) ? data.match_gaps as string[] : null,
          match_explanation: data.match_explanation,
          match_confidence: data.match_confidence
        });
      } else {
        setMatchResult(null);
      }
    } catch (error) {
      console.error('Error fetching match:', error);
      setMatchResult(null);
    } finally {
      setIsLoadingMatch(false);
    }
  };

  const runAIMatch = async () => {
    if (!selectedJobId || !tenantId) {
      toast.error('Please select a job first');
      return;
    }

    setIsRunningMatch(true);
    try {
      // Get job details
      const selectedJob = jobs.find(j => j.id === selectedJobId);
      if (!selectedJob) throw new Error('Job not found');

      // Build comprehensive resume from candidate data
      const resumeParts: string[] = [];
      if (candidateData?.full_name) resumeParts.push(`Name: ${candidateData.full_name}`);
      if (candidateData?.current_title) resumeParts.push(`Current Title: ${candidateData.current_title}`);
      if (candidateData?.current_company) resumeParts.push(`Current Company: ${candidateData.current_company}`);
      if (candidateData?.location) resumeParts.push(`Location: ${candidateData.location}`);
      if (candidateData?.experience_years) resumeParts.push(`Years of Experience: ${candidateData.experience_years}`);
      if (candidateData?.summary) resumeParts.push(`Summary: ${candidateData.summary}`);
      
      const skills = Array.isArray(candidateData?.skills) ? candidateData.skills : candidateSkills;
      if (skills?.length) resumeParts.push(`Skills: ${skills.join(', ')}`);
      
      if (candidateData?.work_history && Array.isArray(candidateData.work_history) && candidateData.work_history.length > 0) {
        resumeParts.push(`Work History: ${JSON.stringify(candidateData.work_history)}`);
      }
      if (candidateData?.education && Array.isArray(candidateData.education) && candidateData.education.length > 0) {
        resumeParts.push(`Education: ${JSON.stringify(candidateData.education)}`);
      }
      if (candidateData?.cv_parsed_data) {
        resumeParts.push(`CV Data: ${JSON.stringify(candidateData.cv_parsed_data)}`);
      }
      if (cvContent) {
        resumeParts.push(`CV Content: ${cvContent}`);
      }

      const fullResume = resumeParts.join('\n');

      // Call AI match function
      const { data, error } = await supabase.functions.invoke('ai-match', {
        body: {
          jobDescription: selectedJob.description || selectedJob.title,
          jobTitle: selectedJob.title,
          candidateResume: fullResume,
          candidateSkills: skills || []
        }
      });

      if (error) throw error;

      if (data.error) {
        if (data.error.includes('Rate limit')) {
          toast.error('AI rate limit exceeded. Please try again later.');
        } else if (data.error.includes('credits')) {
          toast.error('AI credits exhausted. Please add more credits.');
        } else {
          toast.error(data.error);
        }
        return;
      }

      // Check if job_candidate record exists
      const { data: existingRecord } = await supabase
        .from('job_candidates')
        .select('id')
        .eq('candidate_id', candidateId)
        .eq('job_id', selectedJobId)
        .maybeSingle();

      const matchData = {
        match_score: data.score || 0,
        match_confidence: data.confidence || null,
        match_strengths: data.strengths || [],
        match_gaps: data.gaps || [],
        match_explanation: data.explanation || null,
        matched_at: new Date().toISOString()
      };

      if (existingRecord) {
        // Update existing record
        const { error: updateError } = await supabase
          .from('job_candidates')
          .update(matchData)
          .eq('id', existingRecord.id);

        if (updateError) throw updateError;
      } else {
        // Create new record
        const { error: insertError } = await supabase
          .from('job_candidates')
          .insert({
            candidate_id: candidateId,
            job_id: selectedJobId,
            tenant_id: tenantId,
            stage: 'applied',
            ...matchData
          });

        if (insertError) throw insertError;
      }

      // Update local state
      setMatchResult({
        match_score: matchData.match_score,
        match_strengths: matchData.match_strengths,
        match_gaps: matchData.match_gaps,
        match_explanation: matchData.match_explanation,
        match_confidence: matchData.match_confidence
      });

      toast.success('AI match analysis completed!');
    } catch (error: any) {
      console.error('Error running AI match:', error);
      toast.error(error.message || 'Failed to run AI match');
    } finally {
      setIsRunningMatch(false);
    }
  };

  const selectedJob = jobs.find(j => j.id === selectedJobId);

  return (
    <div className="space-y-6">
      {/* Job Selection */}
      <div className="bg-card rounded-xl border border-border p-6">
        <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
          <Briefcase className="w-5 h-5 text-accent" />
          Select Job for AI Analysis
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          AI matching is job-specific. Select a job to analyze how well {candidateName} matches.
        </p>
        
        <div className="flex flex-col sm:flex-row gap-3">
          <Select
            value={selectedJobId || ''}
            onValueChange={(value) => setSelectedJobId(value || null)}
            disabled={isLoadingJobs}
          >
            <SelectTrigger className="flex-1">
              <SelectValue placeholder={isLoadingJobs ? "Loading jobs..." : "Select a job..."} />
            </SelectTrigger>
            <SelectContent>
              {jobs.map(job => (
                <SelectItem key={job.id} value={job.id}>
                  <div className="flex flex-col">
                    <span>{job.title}</span>
                    {job.client_name && (
                      <span className="text-xs text-muted-foreground">{job.client_name}</span>
                    )}
                  </div>
                </SelectItem>
              ))}
              {jobs.length === 0 && !isLoadingJobs && (
                <div className="px-2 py-4 text-sm text-muted-foreground text-center">
                  No open jobs available
                </div>
              )}
            </SelectContent>
          </Select>

          <Button 
            onClick={runAIMatch} 
            disabled={!selectedJobId || isRunningMatch}
            className="gap-2"
          >
            {isRunningMatch ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Analyzing...
              </>
            ) : matchResult ? (
              <>
                <RefreshCw className="w-4 h-4" />
                Re-run Match
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Run AI Match
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Match Results */}
      <AnimatePresence mode="wait">
        {isLoadingMatch ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="bg-card rounded-xl border border-border p-12 text-center"
          >
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Loading match data...</p>
          </motion.div>
        ) : selectedJobId && matchResult && matchResult.match_score !== null ? (
          <motion.div
            key="results"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-6"
          >
            {/* Score Summary */}
            <div className="lg:col-span-1 bg-card rounded-xl border border-border p-6 text-center">
              <h3 className="text-lg font-semibold mb-2">Match Score</h3>
              {selectedJob && (
                <p className="text-sm text-muted-foreground mb-4">
                  for <span className="font-medium text-foreground">{selectedJob.title}</span>
                </p>
              )}
              <div className="flex justify-center mb-4">
                <MatchScoreCircle score={matchResult.match_score} size="lg" />
              </div>
              {matchResult.match_confidence && (
                <p className="text-xs text-muted-foreground">
                  Confidence: {matchResult.match_confidence}%
                </p>
              )}
            </div>

            {/* Details */}
            <div className="lg:col-span-2 space-y-4">
              {/* AI Summary */}
              {matchResult.match_explanation && (
                <div className="bg-card rounded-xl border border-border p-6">
                  <h3 className="text-lg font-semibold flex items-center gap-2 mb-3">
                    <Sparkles className="w-5 h-5 text-accent" />
                    AI Analysis Summary
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {matchResult.match_explanation}
                  </p>
                </div>
              )}

              {/* Strengths */}
              <div className="bg-card rounded-xl border border-border p-6">
                <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
                  <CheckCircle className="w-5 h-5 text-success" />
                  Strengths
                </h3>
                {matchResult.match_strengths && matchResult.match_strengths.length > 0 ? (
                  <ul className="space-y-2">
                    {matchResult.match_strengths.map((strength, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <span className="w-1.5 h-1.5 rounded-full bg-success mt-2 flex-shrink-0" />
                        {strength}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">No strengths identified.</p>
                )}
              </div>

              {/* Skill Gaps */}
              <div className="bg-card rounded-xl border border-border p-6">
                <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
                  <XCircle className="w-5 h-5 text-destructive" />
                  Skill Gaps
                </h3>
                {matchResult.match_gaps && matchResult.match_gaps.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {matchResult.match_gaps.map((gap, i) => (
                      <Badge key={i} variant="outline" className="bg-destructive/10 text-destructive border-destructive/30">
                        {gap}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No significant skill gaps identified.</p>
                )}
              </div>
            </div>
          </motion.div>
        ) : selectedJobId ? (
          <motion.div
            key="no-match"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-card rounded-xl border border-border p-12 text-center"
          >
            <Sparkles className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Match Analysis Yet</h3>
            <p className="text-muted-foreground mb-4">
              Click "Run AI Match" to analyze how {candidateName} matches this job.
            </p>
          </motion.div>
        ) : (
          <motion.div
            key="no-selection"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-muted/30 rounded-xl border border-dashed border-border p-12 text-center"
          >
            <Briefcase className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Select a Job</h3>
            <p className="text-muted-foreground">
              Choose a job from the dropdown above to see or run an AI match analysis.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
