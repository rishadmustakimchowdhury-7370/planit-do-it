import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { MatchScoreCircle } from '@/components/matching/MatchScoreCircle';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Sparkles, Upload, FileText, Users, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';

interface Job {
  id: string;
  title: string;
  description: string | null;
  requirements: string | null;
  client_id: string | null;
}

interface Candidate {
  id: string;
  full_name: string;
  current_title: string | null;
  current_company: string | null;
  skills: string[] | null;
  summary: string | null;
  cv_parsed_data: any;
  work_history: any[];
  education: any[];
  experience_years: number | null;
  location: string | null;
}

interface MatchResult {
  score: number;
  summary: string;
  strengths: string[];
  skillGaps: string[];
}

const AIMatchPage = () => {
  const { tenantId } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string>('');
  const [selectedCandidateId, setSelectedCandidateId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isMatching, setIsMatching] = useState(false);
  const [matchResult, setMatchResult] = useState<MatchResult | null>(null);

  useEffect(() => {
    if (tenantId) {
      fetchData();
    }
  }, [tenantId]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [jobsRes, candidatesRes] = await Promise.all([
        supabase.from('jobs').select('id, title, description, client_id, requirements').eq('tenant_id', tenantId),
        supabase.from('candidates').select('id, full_name, current_title, current_company, skills, summary, cv_parsed_data, work_history, education, experience_years, location').eq('tenant_id', tenantId)
      ]);

      if (jobsRes.data) setJobs(jobsRes.data);
      if (candidatesRes.data) {
        setCandidates(candidatesRes.data.map(c => ({
          ...c,
          skills: Array.isArray(c.skills) ? c.skills as string[] : null,
          work_history: Array.isArray(c.work_history) ? c.work_history : [],
          education: Array.isArray(c.education) ? c.education : []
        })));
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const runAIMatch = async () => {
    if (!selectedJobId || !selectedCandidateId) {
      toast.error('Please select both a job and a candidate');
      return;
    }

    setIsMatching(true);
    setMatchResult(null);
    
    try {
      const job = jobs.find(j => j.id === selectedJobId);
      const candidate = candidates.find(c => c.id === selectedCandidateId);

      if (!job || !candidate) {
        throw new Error('Selected job or candidate not found');
      }

      // Build candidate resume from available profile data
      const resumeParts: string[] = [];
      if (candidate.full_name) resumeParts.push(`Name: ${candidate.full_name}`);
      if (candidate.current_title) resumeParts.push(`Current Title: ${candidate.current_title}`);
      if (candidate.current_company) resumeParts.push(`Current Company: ${candidate.current_company}`);
      if (candidate.location) resumeParts.push(`Location: ${candidate.location}`);
      if (candidate.experience_years) resumeParts.push(`Years of Experience: ${candidate.experience_years}`);
      if (candidate.summary) resumeParts.push(`Summary: ${candidate.summary}`);
      if (candidate.skills?.length) resumeParts.push(`Skills: ${candidate.skills.join(', ')}`);
      if (candidate.work_history?.length) {
        resumeParts.push(`Work History: ${JSON.stringify(candidate.work_history)}`);
      }
      if (candidate.education?.length) {
        resumeParts.push(`Education: ${JSON.stringify(candidate.education)}`);
      }
      if (candidate.cv_parsed_data) {
        resumeParts.push(`CV Data: ${JSON.stringify(candidate.cv_parsed_data)}`);
      }

      const candidateResume = resumeParts.join('\n');

      // Build job description from available data
      const jobDescParts: string[] = [];
      if (job.title) jobDescParts.push(`Job Title: ${job.title}`);
      if (job.description) jobDescParts.push(`Description: ${job.description}`);
      if (job.requirements) jobDescParts.push(`Requirements: ${job.requirements}`);
      
      const fullJobDescription = jobDescParts.join('\n');

      const { data, error } = await supabase.functions.invoke('ai-match', {
        body: {
          jobDescription: fullJobDescription,
          jobTitle: job.title,
          candidateResume: candidateResume,
          candidateSkills: candidate.skills || []
        }
      });

      if (error) {
        console.error('AI Match function error:', error);
        if (error.message?.includes('429') || error.message?.includes('Rate limit')) {
          throw new Error('AI service is rate limited. Please try again in a moment.');
        }
        if (error.message?.includes('402') || error.message?.includes('credits')) {
          throw new Error('AI credits exhausted. Please add more credits in billing.');
        }
        throw error;
      }

      if (!data || data.error) {
        throw new Error(data?.error || 'No response from AI service');
      }

      setMatchResult({
        score: data.score || 0,
        summary: data.explanation || 'Match analysis complete.',
        strengths: data.strengths || [],
        skillGaps: data.gaps || data.skill_gaps || data.skillGaps || []
      });

      // Save match result to database
      await supabase.from('job_candidates').upsert({
        job_id: selectedJobId,
        candidate_id: selectedCandidateId,
        tenant_id: tenantId,
        match_score: data.score || 0,
        match_strengths: data.strengths || [],
        match_gaps: data.gaps || [],
        match_explanation: data.explanation || '',
        match_confidence: data.confidence || 0,
        matched_at: new Date().toISOString(),
        stage: 'applied'
      }, {
        onConflict: 'job_id,candidate_id'
      });

      toast.success('AI Match completed!');
    } catch (error: any) {
      console.error('Error running AI match:', error);
      toast.error(error.message || 'Failed to run AI match. Try manual matching.');
    } finally {
      setIsMatching(false);
    }
  };

  return (
    <AppLayout title="AI Matching" subtitle="Match candidates to jobs using AI-powered analysis.">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Selection Panel */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="space-y-6"
        >
          <Card className="p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-accent" />
              Select Job
            </h3>
            <Select value={selectedJobId} onValueChange={setSelectedJobId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a job..." />
              </SelectTrigger>
              <SelectContent>
                {jobs.map(job => (
                  <SelectItem key={job.id} value={job.id}>
                    {job.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {jobs.length === 0 && !isLoading && (
              <p className="text-sm text-muted-foreground mt-2">No jobs found. Create a job first.</p>
            )}
          </Card>

          <Card className="p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-accent" />
              Select Candidate
            </h3>
            <Select value={selectedCandidateId} onValueChange={setSelectedCandidateId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a candidate..." />
              </SelectTrigger>
              <SelectContent>
                {candidates.map(candidate => (
                  <SelectItem key={candidate.id} value={candidate.id}>
                    {candidate.full_name} {candidate.current_title && `- ${candidate.current_title}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {candidates.length === 0 && !isLoading && (
              <p className="text-sm text-muted-foreground mt-2">No candidates found. Add a candidate first.</p>
            )}
          </Card>

          <Button 
            className="w-full gap-2 h-12 text-lg"
            onClick={runAIMatch}
            disabled={isMatching || !selectedJobId || !selectedCandidateId}
          >
            {isMatching ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Running AI Match...
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                Run AI Match
              </>
            )}
          </Button>
          
          {/* Manual fallback option */}
          <p className="text-xs text-center text-muted-foreground mt-2">
            If AI fails, you can manually score candidates in the job pipeline.
          </p>
        </motion.div>

        {/* Right: Results Panel */}
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="lg:col-span-2 space-y-6"
        >
          {matchResult ? (
            <>
              <Card className="p-8 text-center">
                <h3 className="text-xl font-semibold mb-4">Match Score</h3>
                <div className="flex justify-center mb-6">
                  <MatchScoreCircle score={matchResult.score} size="lg" />
                </div>
                <p className="text-muted-foreground max-w-lg mx-auto">{matchResult.summary}</p>
              </Card>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="p-6">
                  <h3 className="font-semibold flex items-center gap-2 mb-4">
                    <CheckCircle className="w-5 h-5 text-success" />
                    Strengths
                  </h3>
                  {matchResult.strengths.length > 0 ? (
                    <ul className="space-y-2">
                      {matchResult.strengths.map((s, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                          <span className="w-1.5 h-1.5 rounded-full bg-success mt-2" />
                          {s}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">No strengths identified.</p>
                  )}
                </Card>

                <Card className="p-6">
                  <h3 className="font-semibold flex items-center gap-2 mb-4">
                    <XCircle className="w-5 h-5 text-destructive" />
                    Skill Gaps
                  </h3>
                  {matchResult.skillGaps.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {matchResult.skillGaps.map((gap, i) => (
                        <Badge key={i} variant="outline" className="bg-destructive/10 text-destructive">
                          {gap}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No skill gaps identified.</p>
                  )}
                </Card>
              </div>
            </>
          ) : (
            <Card className="p-12 text-center">
              <Sparkles className="w-16 h-16 text-muted-foreground/50 mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Ready to Match</h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                Select a job and a candidate, then click "Run AI Match" to see how well they fit together.
              </p>
            </Card>
          )}
        </motion.div>
      </div>
    </AppLayout>
  );
};

export default AIMatchPage;