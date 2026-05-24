import { useState, useMemo } from 'react';
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
  Sparkles, RefreshCw, ChevronDown, ChevronUp, MapPin, Clock,
  CheckCircle2, AlertCircle, Mail, UserPlus, X, Search, Wand2, Loader2,
} from 'lucide-react';
import { SendCandidateEmailModal } from '@/components/email/SendCandidateEmailModal';

interface RediscoveredTalentSectionProps {
  jobId: string;
  jobTitle: string;
  onCandidateAdded?: () => void;
}

const CONFIDENCE_COLOR = {
  high: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  medium: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  low: 'bg-muted text-muted-foreground border-border',
} as const;

export function RediscoveredTalentSection({ jobId, jobTitle, onCandidateAdded }: RediscoveredTalentSectionProps) {
  const { tenantId } = useAuth();
  const { matches, lastRun, isLoading, isScanning, runScan, dismiss } = useRediscoveredMatches(jobId);
  const [expanded, setExpanded] = useState(true);
  const [minScore, setMinScore] = useState<string>('60');
  const [search, setSearch] = useState('');
  const [confidenceFilter, setConfidenceFilter] = useState<string>('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [addingId, setAddingId] = useState<string | null>(null);
  const [emailTarget, setEmailTarget] = useState<RediscoveredMatch | null>(null);

  const filtered = useMemo(() => {
    const m = Number(minScore) || 0;
    const q = search.trim().toLowerCase();
    return matches.filter(x => {
      if ((x.match_score ?? 0) < m) return false;
      if (confidenceFilter !== 'all' && x.confidence !== confidenceFilter) return false;
      if (q) {
        const haystack = [
          x.candidate?.full_name, x.candidate?.current_title, x.candidate?.location,
        ].filter(Boolean).join(' ').toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [matches, minScore, confidenceFilter, search]);

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
                <h3 className="font-semibold text-foreground">Rediscovered Talent</h3>
                <Badge variant="outline" className="text-[10px] uppercase tracking-wide gap-1 border-accent/30 text-accent">
                  AI
                </Badge>
                {matches.length > 0 && (
                  <Badge variant="secondary" className="text-xs">{matches.length}</Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Past candidates from your database matched to this role — {lastRunText}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button
              size="sm" variant="outline"
              onClick={(e) => { e.stopPropagation(); runScan(matches.length > 0); }}
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
                  <Select value={minScore} onValueChange={setMinScore}>
                    <SelectTrigger className="w-[140px] h-9"><SelectValue placeholder="Min score" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">All scores</SelectItem>
                      <SelectItem value="60">≥ 60%</SelectItem>
                      <SelectItem value="75">≥ 75%</SelectItem>
                      <SelectItem value="85">≥ 85%</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={confidenceFilter} onValueChange={setConfidenceFilter}>
                    <SelectTrigger className="w-[150px] h-9"><SelectValue placeholder="Confidence" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All confidence</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
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
                    cta={<Button onClick={() => runScan(false)} className="gap-2"><Sparkles className="w-4 h-4" />Start AI scan</Button>}
                  />
                ) : filtered.length === 0 && matches.length === 0 ? (
                  <EmptyState
                    icon={<Sparkles className="w-10 h-10 text-muted-foreground" />}
                    title="No strong matches yet"
                    body="Upload more candidates or broaden the job description, then re-scan."
                  />
                ) : filtered.length === 0 ? (
                  <EmptyState
                    icon={<Search className="w-10 h-10 text-muted-foreground" />}
                    title="No candidates match the current filters"
                    body="Lower the minimum score or clear filters to see more results."
                  />
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {filtered.map((m, idx) => (
                      <RediscoveredCandidateCard
                        key={m.id}
                        match={m}
                        index={idx}
                        selected={selected.has(m.id)}
                        onToggleSelect={() => toggleSelect(m.id)}
                        onDismiss={() => dismiss(m.id)}
                        onAdd={() => handleAddToPipeline(m)}
                        onEmail={() => setEmailTarget(m)}
                        isAdding={addingId === m.id}
                      />
                    ))}
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
          }}
          context={{
            jobTitle,
            aiContext: emailTarget.ai_summary ?? undefined,
            strengths: emailTarget.strengths,
          }}
        />
      )}
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
  isAdding: boolean;
}

function RediscoveredCandidateCard({ match, index, selected, onToggleSelect, onDismiss, onAdd, onEmail, isAdding }: CardProps) {
  const c = match.candidate;
  const isTop = index < 3 && match.match_score >= 80;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.03, 0.3) }}
      className={cn(
        'group relative bg-card rounded-xl border p-4 transition-all',
        selected ? 'border-accent ring-1 ring-accent/30' : 'border-border hover:border-accent/40',
        isTop && 'shadow-[0_0_0_1px_hsl(var(--accent)/0.15),0_8px_24px_-12px_hsl(var(--accent)/0.25)]',
      )}
    >
      <div className="absolute top-3 left-3 z-10">
        <Checkbox checked={selected} onCheckedChange={onToggleSelect} aria-label="Select candidate" />
      </div>
      <button
        onClick={onDismiss}
        className="absolute top-2 right-2 w-7 h-7 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
        aria-label="Dismiss"
      >
        <X className="w-3.5 h-3.5" />
      </button>

      <div className="flex items-start gap-3 pl-8">
        <Avatar className="w-12 h-12">
          <AvatarImage src={c.avatar_url || undefined} />
          <AvatarFallback className="bg-accent/10 text-accent">
            {c.full_name.split(' ').map(n => n[0]).join('').slice(0, 2)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-foreground truncate">{c.full_name}</div>
          <div className="text-xs text-muted-foreground truncate">{c.current_title || 'No title'}</div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-[11px] text-muted-foreground">
            {c.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{c.location}</span>}
            {c.notice_period && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{c.notice_period}</span>}
            {c.experience_years != null && <span>{c.experience_years}y exp</span>}
          </div>
        </div>
        <div className="flex flex-col items-center gap-1">
          <MatchScoreCircle score={match.match_score} size="sm" />
          <Badge variant="outline" className={cn('text-[9px] uppercase px-1.5 py-0 h-4', CONFIDENCE_COLOR[match.confidence])}>
            {match.confidence}
          </Badge>
        </div>
      </div>

      {match.ai_summary && (
        <p className="mt-3 text-xs text-muted-foreground line-clamp-2 leading-relaxed">
          {match.ai_summary}
        </p>
      )}

      {(match.strengths.length > 0 || match.gaps.length > 0) && (
        <div className="mt-3 flex flex-wrap gap-1">
          {match.strengths.slice(0, 3).map((s, i) => (
            <Badge key={`s-${i}`} variant="outline" className="text-[10px] gap-1 bg-emerald-500/5 text-emerald-700 border-emerald-500/20">
              <CheckCircle2 className="w-2.5 h-2.5" />{s}
            </Badge>
          ))}
          {match.gaps.slice(0, 2).map((g, i) => (
            <Badge key={`g-${i}`} variant="outline" className="text-[10px] gap-1 bg-amber-500/5 text-amber-700 border-amber-500/20">
              <AlertCircle className="w-2.5 h-2.5" />{g}
            </Badge>
          ))}
        </div>
      )}

      {match.insights.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {match.insights.map((ins, i) => (
            <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-accent/8 text-accent">{ins}</span>
          ))}
        </div>
      )}

      <div className="mt-4 pt-3 border-t border-border/60 flex items-center gap-2">
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
