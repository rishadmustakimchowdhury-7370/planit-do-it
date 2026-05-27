import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { RoleGate } from '@/components/auth/RoleGate';
import { Permission } from '@/hooks/usePermissions';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Sparkles, FileText, Users, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';
import { useUsageLimits } from '@/hooks/useUsageLimits';
import { RecommendationBadge } from '@/components/matching/RecommendationBadge';
import { AnyRecommendation } from '@/lib/recommendation';

interface Job {
  id: string;
  title: string;
}

interface Candidate {
  id: string;
  full_name: string;
  current_title: string | null;
}

interface MandateRow { requirement: string; evidence: string; fit: string }

interface ValidationResult {
  recommendation: AnyRecommendation;
  summary: string;
  mandate_match: MandateRow[];
  strengths: string[];
  considerations: string[];
  risks?: string[];
  missing_requirements?: string[];
}

const fitToneClass = (fit: string) => {
  const f = (fit || '').toUpperCase();
  if (f === 'EXCEEDS' || f === 'STRONG') return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30';
  if (f === 'GOOD') return 'bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/30';
  if (f === 'PARTIAL') return 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30';
  if (f === 'WEAK') return 'bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30';
  return 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30';
};

const AIMatchPage = () => {
  const { tenantId } = useAuth();
  const { checkLimit, showLimitError } = useUsageLimits();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string>('');
  const [selectedCandidateId, setSelectedCandidateId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isMatching, setIsMatching] = useState(false);
  const [result, setResult] = useState<ValidationResult | null>(null);

  useEffect(() => {
    if (tenantId) fetchData();
  }, [tenantId]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [jobsRes, candidatesRes] = await Promise.all([
        supabase.from('jobs').select('id, title').eq('tenant_id', tenantId),
        supabase.from('candidates').select('id, full_name, current_title').eq('tenant_id', tenantId),
      ]);
      if (jobsRes.data) setJobs(jobsRes.data);
      if (candidatesRes.data) setCandidates(candidatesRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const runMatch = async () => {
    if (!selectedJobId || !selectedCandidateId) {
      toast.error('Please select both a job and a candidate');
      return;
    }
    if (checkLimit('aiCredits')) {
      showLimitError('AI matching credits');
      return;
    }

    setIsMatching(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('validate-candidate-fit', {
        body: { job_id: selectedJobId, candidate_id: selectedCandidateId, force: true },
      });
      if (error) throw error;
      const v = data?.validation ?? data;
      if (!v) throw new Error('No assessment returned');

      setResult({
        recommendation: v.recommendation,
        summary: v.summary || '',
        mandate_match: Array.isArray(v.mandate_match) ? v.mandate_match : [],
        strengths: Array.isArray(v.strengths) ? v.strengths : [],
        considerations: Array.isArray(v.considerations) ? v.considerations : [],
        risks: Array.isArray(v.risks) ? v.risks : [],
        missing_requirements: Array.isArray(v.missing_requirements) ? v.missing_requirements : [],
      });
      toast.success('Assessment complete');
    } catch (err: any) {
      console.error('validate-candidate-fit error:', err);
      toast.error(err.message || 'Failed to run assessment');
    } finally {
      setIsMatching(false);
    }
  };

  return (
    <RoleGate allowedRoles={['owner', 'manager', 'recruiter']} requiredPermission={'can_use_ai_match' as Permission} redirectTo="/dashboard">
      <AppLayout title="AI Matching" subtitle="Evidence-based recruiter assessment — unified with the validation engine.">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Selection */}
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
            <Card className="p-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-accent" />
                Select Job
              </h3>
              <Select value={selectedJobId} onValueChange={setSelectedJobId}>
                <SelectTrigger><SelectValue placeholder="Choose a job..." /></SelectTrigger>
                <SelectContent>
                  {jobs.map(job => (<SelectItem key={job.id} value={job.id}>{job.title}</SelectItem>))}
                </SelectContent>
              </Select>
              {jobs.length === 0 && !isLoading && (<p className="text-sm text-muted-foreground mt-2">No jobs found.</p>)}
            </Card>

            <Card className="p-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Users className="w-5 h-5 text-accent" />
                Select Candidate
              </h3>
              <Select value={selectedCandidateId} onValueChange={setSelectedCandidateId}>
                <SelectTrigger><SelectValue placeholder="Choose a candidate..." /></SelectTrigger>
                <SelectContent>
                  {candidates.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.full_name}{c.current_title ? ` — ${c.current_title}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {candidates.length === 0 && !isLoading && (<p className="text-sm text-muted-foreground mt-2">No candidates found.</p>)}
            </Card>

            <Button className="w-full gap-2 h-12 text-lg" onClick={runMatch} disabled={isMatching || !selectedJobId || !selectedCandidateId}>
              {isMatching ? (<><Loader2 className="w-5 h-5 animate-spin" /> Running assessment...</>) : (<><Sparkles className="w-5 h-5" /> Run Assessment</>)}
            </Button>
            <p className="text-xs text-center text-muted-foreground">
              Uses the same recruiter-grade engine as Talent Match, Validation, and the executive PDF.
            </p>
          </motion.div>

          {/* Results */}
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="lg:col-span-2 space-y-6">
            {result ? (
              <>
                <Card className="p-6">
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <h3 className="text-xl font-semibold">Recruiter Assessment</h3>
                    <RecommendationBadge recommendation={result.recommendation} size="lg" />
                  </div>
                  <p className="text-sm text-foreground/80 leading-relaxed">{result.summary}</p>
                </Card>

                {result.mandate_match.length > 0 && (
                  <Card className="p-6">
                    <h3 className="font-semibold mb-4">Fit Assessment</h3>
                    <div className="space-y-2">
                      {result.mandate_match.map((row, i) => (
                        <div key={i} className="grid grid-cols-12 gap-3 items-start text-sm border-b border-border/50 last:border-0 pb-2 last:pb-0">
                          <div className="col-span-4 font-medium">{row.requirement}</div>
                          <div className="col-span-6 text-muted-foreground">{row.evidence}</div>
                          <div className="col-span-2 flex justify-end">
                            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${fitToneClass(row.fit)}`}>{row.fit}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card className="p-6">
                    <h3 className="font-semibold flex items-center gap-2 mb-4">
                      <CheckCircle className="w-5 h-5 text-emerald-500" /> Strengths
                    </h3>
                    {result.strengths.length > 0 ? (
                      <ul className="space-y-2">
                        {result.strengths.map((s, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-foreground/80">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-2 shrink-0" /><span>{s}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (<p className="text-sm text-muted-foreground">None highlighted.</p>)}
                  </Card>

                  <Card className="p-6">
                    <h3 className="font-semibold flex items-center gap-2 mb-4">
                      <AlertTriangle className="w-5 h-5 text-amber-500" /> Considerations
                    </h3>
                    {result.considerations.length > 0 ? (
                      <ul className="space-y-2">
                        {result.considerations.map((s, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-foreground/80">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-2 shrink-0" /><span>{s}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (<p className="text-sm text-muted-foreground">None highlighted.</p>)}
                  </Card>
                </div>

                {(result.missing_requirements?.length ?? 0) > 0 && (
                  <Card className="p-6">
                    <h3 className="font-semibold mb-3">Missing Requirements</h3>
                    <div className="flex flex-wrap gap-2">
                      {result.missing_requirements!.map((g, i) => (
                        <Badge key={i} variant="outline" className="bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30">{g}</Badge>
                      ))}
                    </div>
                  </Card>
                )}
              </>
            ) : (
              <Card className="p-12 text-center">
                <Sparkles className="w-16 h-16 text-muted-foreground/50 mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">Ready to Assess</h3>
                <p className="text-muted-foreground max-w-md mx-auto">
                  Select a job and a candidate, then run the unified recruiter-grade assessment. Results match Talent Match and the executive PDF exactly.
                </p>
              </Card>
            )}
          </motion.div>
        </div>
      </AppLayout>
    </RoleGate>
  );
};

export default AIMatchPage;
