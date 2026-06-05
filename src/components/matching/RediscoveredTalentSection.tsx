import { useState, useMemo, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { MatchScoreCircle } from '@/components/matching/MatchScoreCircle';
import { useRediscoveredMatches, type RediscoveredMatch } from '@/hooks/useRediscoveredMatches';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  Sparkles, RefreshCw, ChevronDown, ChevronUp, MapPin,
  CheckCircle2, AlertCircle, Mail, UserPlus, X, Search, Wand2, Loader2,
  Building2, Target, TrendingUp, Clock,
} from 'lucide-react';
import { SendCandidateEmailModal } from '@/components/email/SendCandidateEmailModal';
import { CandidateWorkflowPanel } from '@/components/matching/CandidateWorkflowPanel';
import { DISCOVERY_META, discoveryMeta } from '@/lib/discovery';
import type { DiscoveryClassification } from '@/hooks/useRediscoveredMatches';

interface RediscoveredTalentSectionProps {
  jobId: string;
  jobTitle: string;
  onCandidateAdded?: () => void;
}

import { scoreToRecommendation } from '@/lib/recommendation';


export function RediscoveredTalentSection({ jobId, jobTitle, onCandidateAdded }: RediscoveredTalentSectionProps) {
  const { tenantId } = useAuth();
  const { matches, lastRun, isLoading, isScanning, runScan, dismiss } = useRediscoveredMatches(jobId);
  const [expanded, setExpanded] = useState(true);
  // Discovery filter: minimum classification rank to display.
  const [minRec, setMinRec] = useState<string>('transferable_shortlist');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [addingId, setAddingId] = useState<string | null>(null);
  const [emailTarget, setEmailTarget] = useState<RediscoveredMatch | null>(null);
  const [panelTarget, setPanelTarget] = useState<RediscoveredMatch | null>(null);
  const autoRescanRef = useRef(false);

  useEffect(() => {
    if (autoRescanRef.current) return;
    if (isLoading || isScanning) return;
    if (!lastRun?.completed_at) return;
    const ageMs = Date.now() - new Date(lastRun.completed_at).getTime();
    if (ageMs > 10 * 60 * 1000) {
      autoRescanRef.current = true;
      runScan(true);
    }
  }, [lastRun?.completed_at, isLoading, isScanning, runScan]);

  const filtered = useMemo(() => {
    const floorRank = DISCOVERY_META[minRec as DiscoveryClassification]?.rank ?? 4;
    const q = search.trim().toLowerCase();
    return matches.filter(x => {
      const cls = (x.discovery_classification ?? 'needs_validation') as DiscoveryClassification;
      if ((DISCOVERY_META[cls]?.rank ?? 0) < floorRank) return false;
      if (q) {
        const haystack = [
          x.candidate?.full_name, x.candidate?.current_title, x.candidate?.location,
        ].filter(Boolean).join(' ').toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [matches, minRec, search]);

  // role_first_v1: Primary Matches = direct functional matches (strong / recommended).
  // Transferable Talent = adjacent function, adjacent industry, transferable skills.
  // Direct matches must always be displayed before transferable candidates.
  const { primaryMatches, transferableMatches } = useMemo(() => {
    const isPrimary = (m: RediscoveredMatch) => {
      const tier = (m as any).recommendation_tier as string | null | undefined;
      if (tier === 'strong_match' || tier === 'recommended') return true;
      const cls = m.discovery_classification;
      return cls === 'strong_shortlist' || cls === 'recommended_shortlist';
    };
    return {
      primaryMatches: filtered.filter(isPrimary),
      transferableMatches: filtered.filter(m => !isPrimary(m)),
    };
  }, [filtered]);




  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleAddToPipeline = async (match: RediscoveredMatch) => {
    setAddingId(match.id);
    try {
      const { error } = await supabase.from('job_candidates').insert({
        job_id: jobId, candidate_id: match.candidate_id, tenant_id: tenantId,
        stage: 'applied', match_score: match.match_score,
        match_explanation: match.ai_summary,
        match_strengths: match.strengths, match_gaps: match.gaps,
        match_confidence: match.ai_score,
      });
      if (error) throw error;
      await dismiss(match.id);
      toast.success(`${match.candidate.full_name} added to pipeline`);
      onCandidateAdded?.();
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to add candidate');
    } finally {
      setAddingId(null);
    }
  };

  const handleBulkAdd = async () => {
    const targets = filtered.filter(m => selected.has(m.id));
    for (const m of targets) await handleAddToPipeline(m);
    setSelected(new Set());
  };

  const lastRunText = lastRun?.completed_at
    ? `Last scan ${formatDistanceToNow(new Date(lastRun.completed_at), { addSuffix: true })}`
    : lastRun?.status === 'running' ? 'Scan in progress…' : 'Never scanned';

  return (
    <>
      <Card className="border-accent/20 overflow-hidden">
        <div
          className="flex items-center justify-between gap-4 p-5 bg-gradient-to-r from-accent/5 via-accent/[0.02] to-transparent cursor-pointer"
          onClick={() => setExpanded(v => !v)}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-5 h-5 text-accent" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-foreground">AI Talent Match</h3>
                <Badge variant="outline" className="text-[10px] uppercase tracking-wide gap-1 border-accent/30 text-accent">
                  AI
                </Badge>
                {matches.length > 0 && (
                  <Badge variant="secondary" className="text-xs">{matches.length}</Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Single ranked list of candidates from your database — deterministic hybrid scoring, AI-explained. {lastRunText}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button
              size="sm" variant="outline"
              onClick={(e) => { e.stopPropagation(); runScan(true); }}
              disabled={isScanning}
              className="gap-2"
            >
              {isScanning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              {matches.length > 0 ? 'Re-scan' : 'Scan now'}
            </Button>
            <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); setExpanded(v => !v); }}>
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
          </div>
        </div>

        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <div className="border-t border-border p-5 space-y-4">
                {/* Filters */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Search rediscovered candidates…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-9 h-9"
                    />
                  </div>
                  <Select value={minRec} onValueChange={setMinRec}>
                    <SelectTrigger className="w-[240px] h-9"><SelectValue placeholder="Min shortlist tier" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="strong_shortlist">Strong Shortlist only</SelectItem>
                      <SelectItem value="recommended_shortlist">Recommended & above</SelectItem>
                      <SelectItem value="transferable_shortlist">Transferable & above (default)</SelectItem>
                      <SelectItem value="adjacent_ecosystem">Include Adjacent Ecosystem</SelectItem>
                      <SelectItem value="needs_validation">Include Needs Validation</SelectItem>
                    </SelectContent>
                  </Select>

                </div>

                {/* Bulk bar */}
                {selected.size > 0 && (
                  <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-accent/5 border border-accent/20">
                    <span className="text-sm font-medium">{selected.size} selected</span>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Clear</Button>
                      <Button size="sm" onClick={handleBulkAdd} className="gap-1.5">
                        <UserPlus className="w-3.5 h-3.5" /> Add all to pipeline
                      </Button>
                    </div>
                  </div>
                )}

                {/* Content states */}
                {isLoading ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {[1, 2, 3].map(i => (
                      <Skeleton key={i} className="h-48 w-full" />
                    ))}
                  </div>
                ) : isScanning && matches.length === 0 ? (
                  <EmptyState
                    icon={<Loader2 className="w-10 h-10 text-accent animate-spin" />}
                    title="AI is scanning your database"
                    body="First scan can take 20–60 seconds depending on database size."
                  />
                ) : !lastRun ? (
                  <EmptyState
                    icon={<Wand2 className="w-10 h-10 text-accent" />}
                    title="Discover candidates already in your database"
                    body="Run an AI scan to surface past candidates who match this role."
                    cta={<Button onClick={() => runScan(true)} className="gap-2"><Sparkles className="w-4 h-4" />Start AI scan</Button>}
                  />
                ) : filtered.length === 0 && matches.length === 0 ? (
                  <EmptyState
                    icon={<Sparkles className="w-10 h-10 text-muted-foreground" />}
                    title="No strong matches yet"
                    body="Upload more candidates or run a fresh scan to rebuild matches for this job."
                    cta={<Button onClick={() => runScan(true)} className="gap-2"><RefreshCw className="w-4 h-4" />Run fresh scan</Button>}
                  />
                ) : filtered.length === 0 ? (
                  <EmptyState
                    icon={<Search className="w-10 h-10 text-muted-foreground" />}
                    title="No candidates match the current filters"
                    body="Lower the minimum score or clear filters to see more results."
                  />
                ) : (
                  <div className="space-y-6">
                    {/* PRIMARY MATCHES — direct functional matches, always shown first */}
                    <section>
                      <div className="flex items-center gap-2 mb-3">
                        <Target className="w-4 h-4 text-accent" />
                        <h4 className="text-sm font-semibold text-foreground">Primary Matches</h4>
                        <Badge variant="secondary" className="text-[10px]">{primaryMatches.length}</Badge>
                        <span className="text-xs text-muted-foreground">Direct functional matches</span>
                      </div>
                      {primaryMatches.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic px-1">No direct functional matches yet — see Transferable Talent below.</p>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                          {primaryMatches.map((m, idx) => (
                            <RediscoveredCandidateCard
                              key={m.id} match={m} index={idx}
                              selected={selected.has(m.id)}
                              onToggleSelect={() => toggleSelect(m.id)}
                              onDismiss={() => dismiss(m.id)}
                              onAdd={() => handleAddToPipeline(m)}
                              onEmail={() => setEmailTarget(m)}
                              onOpen={() => setPanelTarget(m)}
                              isAdding={addingId === m.id}
                            />
                          ))}
                        </div>
                      )}
                    </section>

                    {/* TRANSFERABLE TALENT — adjacent function / industry / skills */}
                    {transferableMatches.length > 0 && (
                      <section>
                        <div className="flex items-center gap-2 mb-3">
                          <TrendingUp className="w-4 h-4 text-muted-foreground" />
                          <h4 className="text-sm font-semibold text-foreground">Transferable Talent</h4>
                          <Badge variant="outline" className="text-[10px]">{transferableMatches.length}</Badge>
                          <span className="text-xs text-muted-foreground">Adjacent functions, adjacent industries, transferable skills</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                          {transferableMatches.map((m, idx) => (
                            <RediscoveredCandidateCard
                              key={m.id} match={m} index={idx}
                              selected={selected.has(m.id)}
                              onToggleSelect={() => toggleSelect(m.id)}
                              onDismiss={() => dismiss(m.id)}
                              onAdd={() => handleAddToPipeline(m)}
                              onEmail={() => setEmailTarget(m)}
                              onOpen={() => setPanelTarget(m)}
                              isAdding={addingId === m.id}
                            />
                          ))}
                        </div>
                      </section>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>

      {emailTarget && emailTarget.candidate.email && (
        <SendCandidateEmailModal
          open={!!emailTarget}
          onOpenChange={(o) => !o && setEmailTarget(null)}
          candidate={{
            id: emailTarget.candidate.id,
            full_name: emailTarget.candidate.full_name,
            email: emailTarget.candidate.email,
          } as any}
          preSelectedJobId={jobId}
        />
      )}

      <CandidateWorkflowPanel
        open={!!panelTarget}
        onOpenChange={(o) => !o && setPanelTarget(null)}
        match={panelTarget}
        jobId={jobId}
        jobTitle={jobTitle}
        onAddedToPipeline={() => { onCandidateAdded?.(); setPanelTarget(null); }}
        onDismiss={() => panelTarget && dismiss(panelTarget.id)}
      />
    </>
  );
}

function EmptyState({ icon, title, body, cta }: { icon: React.ReactNode; title: string; body: string; cta?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 px-6">
      <div className="mb-3">{icon}</div>
      <h4 className="font-semibold text-foreground">{title}</h4>
      <p className="text-sm text-muted-foreground mt-1 max-w-md">{body}</p>
      {cta && <div className="mt-4">{cta}</div>}
    </div>
  );
}

interface CardProps {
  match: RediscoveredMatch;
  index: number;
  selected: boolean;
  onToggleSelect: () => void;
  onDismiss: () => void;
  onAdd: () => void;
  onEmail: () => void;
  onOpen: () => void;
  isAdding: boolean;
}

function RediscoveredCandidateCard({ match, index, selected, onToggleSelect, onDismiss, onAdd, onEmail, onOpen, isAdding }: CardProps) {
  const c = match.candidate;
  const dMeta = discoveryMeta(match.discovery_classification);
  const isTop = index < 3 && (match.discovery_classification === 'strong_shortlist' || match.discovery_classification === 'recommended_shortlist');
  const fullName = c?.full_name || 'Unknown candidate';
  const initials = fullName.split(' ').filter(Boolean).map(n => n[0]).join('').slice(0, 2) || '?';
  const strengths = Array.isArray(match.strengths) ? match.strengths : [];
  const gaps = Array.isArray(match.gaps) ? match.gaps : [];
  const insights = Array.isArray(match.insights) ? match.insights : [];
  const whyRanked = Array.isArray(match.why_ranked) ? match.why_ranked : [];
  const ecosystem = Array.isArray(match.ecosystem_signals) ? match.ecosystem_signals : [];
  const ownership = Array.isArray(match.functional_ownership) ? match.functional_ownership : [];
  const interviewProb = match.interview_probability;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.03, 0.3) }}
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(); } }}
      className={cn(
        'group relative bg-card rounded-xl border p-4 transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
        selected ? 'border-accent ring-1 ring-accent/30' : 'border-border hover:border-accent/40 hover:shadow-md',
        isTop && 'shadow-[0_0_0_1px_hsl(var(--accent)/0.15),0_8px_24px_-12px_hsl(var(--accent)/0.25)]',
      )}
    >
      <div className="absolute top-3 left-3 z-10" onClick={(e) => e.stopPropagation()}>
        <Checkbox checked={selected} onCheckedChange={onToggleSelect} aria-label="Select candidate" />
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); onDismiss(); }}
        className="absolute top-2 right-2 w-7 h-7 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-10"
        aria-label="Dismiss"
      >
        <X className="w-3.5 h-3.5" />
      </button>

      <div className="flex items-start gap-3 pl-8">
        <Avatar className="w-12 h-12">
          <AvatarImage src={c.avatar_url || undefined} />
          <AvatarFallback className="bg-accent/10 text-accent">{initials}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-foreground truncate">{fullName}</div>
          <div className="text-xs text-muted-foreground truncate">{c.current_title || 'No title'}</div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-[11px] text-muted-foreground">
            {c.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{c.location}</span>}
            {c.experience_years != null && <span>{c.experience_years}y exp</span>}
            {interviewProb != null && (
              <span className="flex items-center gap-1 text-foreground/70">
                <TrendingUp className="w-3 h-3" />{interviewProb}% interview
              </span>
            )}
          </div>
        </div>
        <span
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full border font-medium leading-none text-[11px] px-2.5 py-1 whitespace-nowrap',
            dMeta.badgeClass,
          )}
        >
          <span className={cn('h-1.5 w-1.5 rounded-full', dMeta.dotClass)} />
          {dMeta.label}
        </span>
      </div>

      {match.ai_summary && (
        <p className="mt-3 text-xs text-muted-foreground line-clamp-2 leading-relaxed">
          {match.ai_summary}
        </p>
      )}

      {whyRanked.length > 0 && (
        <div className="mt-3 rounded-lg bg-accent/[0.04] border border-accent/15 p-2.5">
          <div className="text-[10px] uppercase tracking-wide text-accent font-semibold mb-1.5 flex items-center gap-1">
            <Sparkles className="w-3 h-3" /> Why this candidate ranked
          </div>
          <ul className="space-y-0.5">
            {whyRanked.slice(0, 3).map((w, i) => (
              <li key={i} className="text-[11px] text-foreground/80 flex gap-1.5 leading-snug">
                <span className="text-accent mt-1 flex-shrink-0">•</span>
                <span>{w}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {ecosystem.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {ecosystem.slice(0, 3).map((e, i) => (
            <Badge
              key={`eco-${i}`}
              variant="outline"
              className={cn(
                'text-[10px] gap-1 capitalize',
                e.tier === 'tier1'
                  ? 'bg-violet-500/10 text-violet-700 border-violet-500/30'
                  : 'bg-violet-500/5 text-violet-600 border-violet-500/20',
              )}
            >
              <Building2 className="w-2.5 h-2.5" />
              {e.company} · {e.industry}
            </Badge>
          ))}
        </div>
      )}

      {ownership.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {ownership.slice(0, 4).map((o, i) => (
            <Badge key={`o-${i}`} variant="outline" className="text-[10px] gap-1 bg-sky-500/5 text-sky-700 border-sky-500/20">
              <Target className="w-2.5 h-2.5" />{o}
            </Badge>
          ))}
        </div>
      )}

      {(strengths.length > 0 || gaps.length > 0) && (
        <div className="mt-2 flex flex-wrap gap-1">
          {strengths.slice(0, 2).map((s, i) => (
            <Badge key={`s-${i}`} variant="outline" className="text-[10px] gap-1 bg-emerald-500/5 text-emerald-700 border-emerald-500/20">
              <CheckCircle2 className="w-2.5 h-2.5" />{s}
            </Badge>
          ))}
          {gaps.slice(0, 2).map((g, i) => (
            <Badge key={`g-${i}`} variant="outline" className="text-[10px] gap-1 bg-amber-500/5 text-amber-700 border-amber-500/20">
              <AlertCircle className="w-2.5 h-2.5" />{g}
            </Badge>
          ))}
        </div>
      )}

      {insights.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {insights.map((ins, i) => (
            <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-accent/8 text-accent">{ins}</span>
          ))}
        </div>
      )}

      <div className="mt-4 pt-3 border-t border-border/60 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
        <Button size="sm" variant="outline" className="flex-1 h-8 gap-1.5" onClick={onEmail} disabled={!c.email}>
          <Mail className="w-3.5 h-3.5" /> AI outreach
        </Button>
        <Button size="sm" className="flex-1 h-8 gap-1.5" onClick={onAdd} disabled={isAdding}>
          {isAdding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
          Pipeline
        </Button>
      </div>
    </motion.div>
  );

}

const FACTOR_LABELS: Record<string, string> = {
  role: 'Role',
  skills: 'Skills',
  seniority: 'Seniority',
  experience: 'Experience',
  industry: 'Industry',
  location: 'Location',
};

function ScoreBreakdown({ sub }: { sub: NonNullable<RediscoveredMatch['sub_scores']> }) {
  const factors = ['role', 'skills', 'seniority', 'experience', 'location'] as const;
  return (
    <div className="mt-3 pt-3 border-t border-border/40">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5">Why this score</div>
      <div className="grid grid-cols-5 gap-1.5">
        {factors.map((k) => {
          const v = Math.round(((sub[k] as number | undefined) ?? 0) * 100);
          const tone = v >= 70 ? 'bg-emerald-500' : v >= 40 ? 'bg-amber-500' : 'bg-rose-500';
          return (
            <div key={k} className="flex flex-col gap-0.5">
              <div className="h-1 rounded-full bg-muted overflow-hidden">
                <div className={cn('h-full', tone)} style={{ width: `${v}%` }} />
              </div>
              <div className="text-[9px] text-muted-foreground flex justify-between">
                <span>{FACTOR_LABELS[k]}</span>
                <span className="tabular-nums">{v}</span>
              </div>
            </div>
          );
        })}
      </div>
      {(sub.penalty ?? 0) > 0 && (
        <div className="text-[10px] text-rose-600 mt-1.5">
          −{Math.round((sub.penalty ?? 0) * 100)} penalty applied (role/skill/seniority mismatch)
        </div>
      )}
    </div>
  );
}
