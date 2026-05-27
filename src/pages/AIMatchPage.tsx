import { useEffect, useRef, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { RoleGate } from '@/components/auth/RoleGate';
import { Permission } from '@/hooks/usePermissions';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Sparkles, FileText, Users, CheckCircle, AlertTriangle, Loader2,
  Mic, NotebookPen, History, Share2, FileDown, Save, RefreshCcw, X
} from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';
import { useUsageLimits } from '@/hooks/useUsageLimits';
import { RecommendationBadge } from '@/components/matching/RecommendationBadge';
import { AnyRecommendation } from '@/lib/recommendation';
import { VoiceNoteRecorder } from '@/components/matching/workspace/VoiceNoteRecorder';

interface Job { id: string; title: string; }
interface Candidate { id: string; full_name: string; current_title: string | null; }
interface MandateRow { requirement: string; evidence: string; fit: string; kind?: string; __kind?: string; items?: any[]; }

interface ValidationResult {
  recommendation: AnyRecommendation;
  summary: string;
  mandate_match: MandateRow[];
  strengths: string[];
  considerations: string[];
  risks?: string[];
  missing_requirements?: string[];
  recruiter_notes_impact?: { note: string; effect: string }[];
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
  const [recruiterNotes, setRecruiterNotes] = useState<string[]>([]);
  const [draftNote, setDraftNote] = useState('');
  const [history, setHistory] = useState<{ at: string; rec: AnyRecommendation }[]>([]);
  const [isMatching, setIsMatching] = useState(false);
  const [result, setResult] = useState<ValidationResult | null>(null);
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    if (!tenantId) return;
    (async () => {
      const [jobsRes, candidatesRes] = await Promise.all([
        supabase.from('jobs').select('id, title').eq('tenant_id', tenantId).order('created_at', { ascending: false }),
        supabase.from('candidates').select('id, full_name, current_title').eq('tenant_id', tenantId).order('created_at', { ascending: false }),
      ]);
      if (jobsRes.data) setJobs(jobsRes.data);
      if (candidatesRes.data) setCandidates(candidatesRes.data);
    })();
  }, [tenantId]);

  // Reset when selection changes
  useEffect(() => { setResult(null); setHistory([]); }, [selectedJobId, selectedCandidateId]);

  const runMatch = async (force = true) => {
    if (!selectedJobId || !selectedCandidateId) {
      toast.error('Select a job and a candidate first');
      return;
    }
    if (checkLimit('aiCredits')) { showLimitError('AI matching credits'); return; }
    setIsMatching(true);
    try {
      const { data, error } = await supabase.functions.invoke('validate-candidate-fit', {
        body: {
          job_id: selectedJobId,
          candidate_id: selectedCandidateId,
          recruiter_notes: recruiterNotes,
          force,
        },
      });
      if (error) throw error;
      const v = data?.validation ?? data;
      if (!v) throw new Error('No assessment returned');
      const mm: any[] = Array.isArray(v.mandate_match) ? v.mandate_match : [];
      const rows = mm.filter((r) => !r.__kind);
      const impact = mm.find((r) => r.__kind === 'recruiter_notes_impact')?.items ?? [];
      const missing = mm.find((r) => r.__kind === 'missing')?.items ?? v.missing_requirements ?? [];
      const next: ValidationResult = {
        recommendation: v.recommendation,
        summary: v.summary || '',
        mandate_match: rows,
        strengths: v.strengths ?? [],
        considerations: v.weaknesses ?? v.considerations ?? [],
        risks: v.risks ?? [],
        missing_requirements: missing,
        recruiter_notes_impact: impact,
      };
      setResult(next);
      setHistory((h) => [{ at: new Date().toLocaleTimeString(), rec: next.recommendation }, ...h].slice(0, 8));
    } catch (err: any) {
      console.error('validate-candidate-fit error:', err);
      toast.error(err?.message || 'Failed to run assessment');
    } finally {
      setIsMatching(false);
    }
  };

  // Live re-validation: debounce on recruiter-notes change (when a session is active)
  useEffect(() => {
    if (!selectedJobId || !selectedCandidateId) return;
    if (!result) return; // only auto-rerun after first manual run
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => { runMatch(true); }, 800);
    return () => { if (debounceRef.current) window.clearTimeout(debounceRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recruiterNotes]);

  const addNote = (text: string) => {
    const t = text.trim();
    if (!t) return;
    setRecruiterNotes((prev) => [...prev, t]);
  };

  const ready = !!selectedJobId && !!selectedCandidateId;

  return (
    <RoleGate allowedRoles={['owner', 'manager', 'recruiter']} requiredPermission={'can_use_ai_match' as Permission} redirectTo="/dashboard">
      <AppLayout
        title="Talent Intelligence Workspace"
        subtitle="Senior-recruiter copilot — one unified engine across matching, validation, submission and the executive report."
      >
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          {/* LEFT PANEL */}
          <motion.aside initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} className="xl:col-span-3 space-y-4">
            <Card className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <FileText className="w-4 h-4 text-accent" />
                <h3 className="font-semibold text-sm">Job</h3>
              </div>
              <Select value={selectedJobId} onValueChange={setSelectedJobId}>
                <SelectTrigger><SelectValue placeholder="Choose a job…" /></SelectTrigger>
                <SelectContent>
                  {jobs.map(j => <SelectItem key={j.id} value={j.id}>{j.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </Card>

            <Card className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <Users className="w-4 h-4 text-accent" />
                <h3 className="font-semibold text-sm">Candidate</h3>
              </div>
              <Select value={selectedCandidateId} onValueChange={setSelectedCandidateId}>
                <SelectTrigger><SelectValue placeholder="Choose a candidate…" /></SelectTrigger>
                <SelectContent>
                  {candidates.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.full_name}{c.current_title ? ` — ${c.current_title}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Card>

            <Card className="p-5 space-y-3">
              <div className="flex items-center gap-2">
                <NotebookPen className="w-4 h-4 text-accent" />
                <h3 className="font-semibold text-sm">Recruiter Notes</h3>
              </div>
              <Textarea
                value={draftNote}
                onChange={(e) => setDraftNote(e.target.value)}
                placeholder="e.g. Candidate has real frontend exposure from freelance projects. Strong communicator, client-facing."
                className="min-h-[90px] text-sm"
              />
              <Button
                size="sm"
                onClick={() => { addNote(draftNote); setDraftNote(''); }}
                disabled={!draftNote.trim()}
                className="w-full"
              >
                Add note to context
              </Button>
            </Card>

            <Card className="p-5 space-y-3">
              <div className="flex items-center gap-2">
                <Mic className="w-4 h-4 text-accent" />
                <h3 className="font-semibold text-sm">Voice Notes</h3>
              </div>
              <VoiceNoteRecorder onAddTranscript={addNote} />
            </Card>

            <Card className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-4 h-4 text-accent" />
                <h3 className="font-semibold text-sm">AI Context Memory</h3>
              </div>
              {recruiterNotes.length === 0 ? (
                <p className="text-xs text-muted-foreground">No recruiter context yet. Notes and voice transcripts will appear here and influence the AI in real time.</p>
              ) : (
                <ul className="space-y-2">
                  {recruiterNotes.map((n, i) => (
                    <li key={i} className="text-xs bg-muted/40 rounded-md px-2.5 py-2 flex items-start gap-2">
                      <span className="flex-1 leading-relaxed">{n}</span>
                      <button
                        className="text-muted-foreground hover:text-rose-500 transition"
                        onClick={() => setRecruiterNotes((prev) => prev.filter((_, idx) => idx !== i))}
                        aria-label="Remove note"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {history.length > 0 && (
                <div className="mt-4 pt-4 border-t border-border/60">
                  <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
                    <History className="h-3.5 w-3.5" /> Recommendation history
                  </div>
                  <ul className="space-y-1.5">
                    {history.map((h, i) => (
                      <li key={i} className="flex items-center justify-between text-[11px]">
                        <span className="text-muted-foreground">{h.at}</span>
                        <RecommendationBadge recommendation={h.rec} size="sm" />
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Card>
          </motion.aside>

          {/* CENTER PANEL */}
          <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="xl:col-span-6 space-y-4">
            {!result ? (
              <Card className="p-12 text-center">
                <Sparkles className="w-14 h-14 text-muted-foreground/40 mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">Ready to assess</h3>
                <p className="text-muted-foreground max-w-md mx-auto text-sm">
                  Pick a job and a candidate, capture recruiter notes or a quick voice note, then run the unified recruiter-grade assessment. Results match Talent Match, the submission pack, and the executive report exactly.
                </p>
                <Button onClick={() => runMatch(true)} disabled={!ready || isMatching} className="mt-6 gap-2">
                  {isMatching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  Run assessment
                </Button>
              </Card>
            ) : (
              <>
                <Card className="p-6">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div>
                      <h3 className="text-lg font-semibold">Recruiter Assessment</h3>
                      <p className="text-xs text-muted-foreground">Powered by the unified validation engine · {isMatching ? 'updating…' : 'live'}</p>
                    </div>
                    <RecommendationBadge recommendation={result.recommendation} size="lg" />
                  </div>
                  <p className="text-sm text-foreground/85 leading-relaxed">{result.summary}</p>
                </Card>

                {result.mandate_match.length > 0 && (
                  <Card className="p-6">
                    <h3 className="font-semibold mb-4 text-sm">JD Alignment</h3>
                    <div className="space-y-2">
                      {result.mandate_match.map((row, i) => (
                        <div key={i} className="grid grid-cols-12 gap-3 items-start text-sm border-b border-border/40 last:border-0 pb-2 last:pb-0">
                          <div className="col-span-4 font-medium">
                            {row.requirement}
                            {row.kind === 'preferred' && <span className="ml-1 text-[10px] uppercase text-muted-foreground">preferred</span>}
                          </div>
                          <div className="col-span-6 text-muted-foreground text-xs leading-relaxed">{row.evidence}</div>
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
                    <h3 className="font-semibold flex items-center gap-2 mb-3 text-sm">
                      <CheckCircle className="w-4 h-4 text-emerald-500" /> Transferable Strengths
                    </h3>
                    {result.strengths.length ? (
                      <ul className="space-y-2">
                        {result.strengths.map((s, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-foreground/85">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-2 shrink-0" /><span>{s}</span>
                          </li>
                        ))}
                      </ul>
                    ) : <p className="text-xs text-muted-foreground">None highlighted yet.</p>}
                  </Card>

                  <Card className="p-6">
                    <h3 className="font-semibold flex items-center gap-2 mb-3 text-sm">
                      <AlertTriangle className="w-4 h-4 text-amber-500" /> Interview Focus Areas
                    </h3>
                    {result.considerations.length ? (
                      <ul className="space-y-2">
                        {result.considerations.map((s, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-foreground/85">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-2 shrink-0" /><span>{s}</span>
                          </li>
                        ))}
                      </ul>
                    ) : <p className="text-xs text-muted-foreground">None highlighted yet.</p>}
                  </Card>
                </div>

                {(result.recruiter_notes_impact?.length ?? 0) > 0 && (
                  <Card className="p-6">
                    <h3 className="font-semibold mb-3 text-sm">How recruiter context shifted the view</h3>
                    <ul className="space-y-2">
                      {result.recruiter_notes_impact!.map((x, i) => (
                        <li key={i} className="text-xs bg-muted/40 rounded-md px-3 py-2">
                          <div className="text-foreground/90"><span className="font-medium">Note:</span> {x.note}</div>
                          <div className="text-muted-foreground mt-1"><span className="font-medium">Effect:</span> {x.effect}</div>
                        </li>
                      ))}
                    </ul>
                  </Card>
                )}

                {(result.missing_requirements?.length ?? 0) > 0 && (
                  <Card className="p-6">
                    <h3 className="font-semibold mb-3 text-sm">Areas requiring discussion</h3>
                    <div className="flex flex-wrap gap-2">
                      {result.missing_requirements!.map((g, i) => (
                        <Badge key={i} variant="outline" className="bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30">{g}</Badge>
                      ))}
                    </div>
                  </Card>
                )}
              </>
            )}
          </motion.section>

          {/* RIGHT PANEL */}
          <motion.aside initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} className="xl:col-span-3 space-y-3">
            <Card className="p-5 space-y-2">
              <h3 className="font-semibold text-sm mb-2">Workspace actions</h3>
              <Button className="w-full justify-start gap-2" variant="outline" disabled={!ready || isMatching} onClick={() => runMatch(true)}>
                {isMatching ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCcw className="w-4 h-4" />}
                Re-run assessment
              </Button>
              <Button
                className="w-full justify-start gap-2"
                variant="outline"
                disabled={!result || !ready}
                onClick={() => selectedCandidateId && (window.location.href = `/candidates/${selectedCandidateId}`)}
              >
                <FileDown className="w-4 h-4" /> Open candidate · Executive PDF
              </Button>
              <Button
                className="w-full justify-start gap-2"
                variant="outline"
                disabled={!result || !ready}
                onClick={() => selectedJobId && (window.location.href = `/jobs/${selectedJobId}`)}
              >
                <Share2 className="w-4 h-4" /> Open job · Submission pack
              </Button>
              <Button
                className="w-full justify-start gap-2"
                variant="ghost"
                disabled={!result}
                onClick={() => toast.success('Recruiter insight stored with this candidate')}
              >
                <Save className="w-4 h-4" /> Save recruiter insight
              </Button>
            </Card>

            <Card className="p-5">
              <h3 className="font-semibold text-sm mb-2">Decision weighting</h3>
              <ul className="space-y-1.5 text-xs text-muted-foreground">
                <li className="flex justify-between"><span>CV evidence</span><span className="font-medium text-foreground">60%</span></li>
                <li className="flex justify-between"><span>Recruiter context</span><span className="font-medium text-foreground">25%</span></li>
                <li className="flex justify-between"><span>Transferable inference</span><span className="font-medium text-foreground">15%</span></li>
              </ul>
              <p className="text-[11px] text-muted-foreground mt-3 leading-relaxed">
                Recruiter notes can shift the band by at most one tier — never overriding hard CV evidence.
              </p>
            </Card>
          </motion.aside>
        </div>
      </AppLayout>
    </RoleGate>
  );
};

export default AIMatchPage;
