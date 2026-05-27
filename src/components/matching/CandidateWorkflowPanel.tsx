import { useState, useEffect } from 'react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { MatchScoreCircle } from '@/components/matching/MatchScoreCircle';

import { SendCandidateEmailModal } from '@/components/email/SendCandidateEmailModal';
import { OutcomeCaptureBar } from '@/components/clients/OutcomeCaptureBar';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { useRecruiterActivity } from '@/hooks/useRecruiterActivity';
import { useBrandedDownload } from '@/hooks/useBrandedDownload';
import { getWhatsAppUrl, formatWhatsAppNumber } from '@/lib/whatsapp';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';
import {
  MapPin, Mail, MessageCircle, FileText, Download, Eye, Sparkles,
  UserPlus, Share2, Calendar, StickyNote, ChevronDown, CheckCircle2,
  AlertCircle, Linkedin, ExternalLink, Loader2, Activity, Clock,
  Briefcase, History,
} from 'lucide-react';
import type { RediscoveredMatch } from '@/hooks/useRediscoveredMatches';

interface CandidateWorkflowPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  match: RediscoveredMatch | null;
  jobId: string;
  jobTitle: string;
  onAddedToPipeline?: () => void;
  onDismiss?: () => void;
}

const CONFIDENCE_COLOR = {
  high: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20',
  medium: 'bg-amber-500/10 text-amber-700 border-amber-500/20',
  low: 'bg-muted text-muted-foreground border-border',
} as const;

const FACTOR_LABELS: Record<string, string> = {
  role: 'Role similarity',
  skills: 'Skills overlap',
  seniority: 'Seniority alignment',
  experience: 'Experience match',
  industry: 'Industry relevance',
  location: 'Location compatibility',
};

const FACTOR_WEIGHTS: Record<string, number> = {
  role: 40, skills: 25, industry: 10, seniority: 10, experience: 10, location: 5,
};

const FACTOR_KEYS = ['role', 'skills', 'industry', 'seniority', 'experience', 'location'] as const;

export function CandidateWorkflowPanel({
  open, onOpenChange, match, jobId, jobTitle, onAddedToPipeline, onDismiss,
}: CandidateWorkflowPanelProps) {
  const { user, tenantId } = useAuth();
  const { logActivity } = useRecruiterActivity();
  const { downloadBranded, isDownloading: isBranding } = useBrandedDownload();

  const [aiEmailOpen, setAiEmailOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewType, setPreviewType] = useState<'original' | 'branded' | null>(null);
  const [note, setNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [addingPipeline, setAddingPipeline] = useState(false);
  const [whyOpen, setWhyOpen] = useState(true);
  const [recruiterName, setRecruiterName] = useState<string>('');
  const [cvFileUrl, setCvFileUrl] = useState<string | null>(null);
  const [linkedinUrl, setLinkedinUrl] = useState<string | null>(null);
  const [activities, setActivities] = useState<any[]>([]);
  const [actLoading, setActLoading] = useState(false);

  const c = match?.candidate;
  const candidateId = match?.candidate_id;

  // Fetch full candidate record (for cv_file_url + notes)
  useEffect(() => {
    if (!candidateId || !open) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('candidates')
        .select('cv_file_url, linkedin_url, phone, email')
        .eq('id', candidateId)
        .maybeSingle();
      if (!cancelled && data) {
        setCvFileUrl(data.cv_file_url ?? null);
        setLinkedinUrl(data.linkedin_url ?? null);
      }
    })();
    return () => { cancelled = true; };
  }, [candidateId, open]);

  // Fetch recruiter display name
  useEffect(() => {
    if (!user?.id) return;
    supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle()
      .then(({ data }) => setRecruiterName(data?.full_name ?? ''));
  }, [user?.id]);

  // Fetch activity timeline
  useEffect(() => {
    if (!candidateId || !open) return;
    setActLoading(true);
    supabase
      .from('recruiter_activities')
      .select('id, action_type, created_at, metadata, job_id')
      .eq('candidate_id', candidateId)
      .order('created_at', { ascending: false })
      .limit(30)
      .then(({ data }) => {
        setActivities(data ?? []);
        setActLoading(false);
      });
  }, [candidateId, open, addingPipeline, previewType]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setPreviewUrl(null);
      setPreviewType(null);
      setNote('');
    }
  }, [open]);

  if (!match || !c) return null;

  const fullName = c.full_name || 'Unknown candidate';
  const initials = fullName.split(' ').filter(Boolean).map(n => n[0]).join('').slice(0, 2) || '?';
  const waNumber = formatWhatsAppNumber(c.phone);
  const strengths = Array.isArray(match.strengths) ? match.strengths : [];
  const gaps = Array.isArray(match.gaps) ? match.gaps : [];
  const confidence = match.confidence === 'high' || match.confidence === 'medium' || match.confidence === 'low'
    ? match.confidence
    : 'low';

  const handlePreviewOriginal = async () => {
    if (!cvFileUrl) {
      toast.error('No CV uploaded for this candidate');
      return;
    }
    setPreviewLoading(true);
    setPreviewType('original');
    try {
      // Extract path after /documents/
      const match = cvFileUrl.match(/documents\/(.+)$/);
      const path = match ? match[1] : cvFileUrl;
      const { data, error } = await supabase.storage
        .from('documents').createSignedUrl(path, 600);
      if (error) throw error;
      setPreviewUrl(data.signedUrl);
      logActivity({
        action_type: 'cv_preview', candidate_id: candidateId, job_id: jobId,
        metadata: { variant: 'original' },
      });
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to load CV preview');
      setPreviewType(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleDownloadOriginal = async () => {
    if (!cvFileUrl) return toast.error('No CV uploaded');
    const m = cvFileUrl.match(/documents\/(.+)$/);
    const path = m ? m[1] : cvFileUrl;
    const { data, error } = await supabase.storage.from('documents').createSignedUrl(path, 60);
    if (error) return toast.error('Download failed');
    window.open(data.signedUrl, '_blank');
    logActivity({
      action_type: 'cv_download', candidate_id: candidateId, job_id: jobId,
      metadata: { variant: 'original' },
    });
  };

  const handleDownloadBranded = async () => {
    if (!cvFileUrl) return toast.error('No CV uploaded');
    await downloadBranded({ fileUrl: cvFileUrl, documentType: 'cv', entityName: fullName });
    logActivity({
      action_type: 'cv_download', candidate_id: candidateId, job_id: jobId,
      metadata: { variant: 'branded' },
    });
  };

  const handleWhatsApp = () => {
    if (!waNumber) {
      toast.error('No WhatsApp number on file');
      return;
    }
    const firstName = fullName.split(' ')[0];
    const signature = recruiterName ? `\n\n— ${recruiterName}` : '';
    const message = `Hi ${firstName}, we reviewed your profile for our ${jobTitle} role and would like to discuss this opportunity with you.${signature}`;
    const url = getWhatsAppUrl(c.phone, message);
    if (url) {
      window.open(url, '_blank');
      logActivity({
        action_type: 'whatsapp_initiated', candidate_id: candidateId, job_id: jobId,
        metadata: { message_preview: message.slice(0, 200) },
      });
      toast.success('Opening WhatsApp…');
    }
  };

  const handleAddToPipeline = async () => {
    if (!tenantId) return;
    setAddingPipeline(true);
    try {
      // Check if already in pipeline
      const { data: existing } = await supabase
        .from('job_candidates')
        .select('id')
        .eq('job_id', jobId)
        .eq('candidate_id', candidateId)
        .maybeSingle();
      if (existing) {
        toast.info(`${fullName} is already in the pipeline`);
        return;
      }
      const { error } = await supabase.from('job_candidates').insert({
        job_id: jobId, candidate_id: candidateId, tenant_id: tenantId,
        stage: 'applied', match_score: match.match_score,
        match_explanation: match.ai_summary,
        match_strengths: strengths, match_gaps: gaps,
        match_confidence: match.ai_score,
      });
      if (error) throw error;
      toast.success(`${fullName} added to pipeline`);
      onAddedToPipeline?.();
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to add to pipeline');
    } finally {
      setAddingPipeline(false);
    }
  };

  const handleSaveNote = async () => {
    if (!note.trim() || !candidateId) return;
    setSavingNote(true);
    try {
      const res = await logActivity({
        action_type: 'note_added',
        candidate_id: candidateId,
        job_id: jobId,
        metadata: { note: note.trim() },
      });
      if (!res) throw new Error('Failed to save note');
      setNote('');
      toast.success('Note added to timeline');
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to save note');
    } finally {
      setSavingNote(false);
    }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-[720px] p-0 flex flex-col gap-0 overflow-hidden"
        >
          {/* Header */}
          <div className="px-6 pt-6 pb-5 border-b border-border bg-gradient-to-b from-accent/5 to-transparent">
            <div className="flex items-start gap-4">
              <Avatar className="w-16 h-16 ring-2 ring-background shadow-md">
                <AvatarImage src={c.avatar_url || undefined} />
                <AvatarFallback className="bg-accent/10 text-accent text-lg font-medium">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <h2 className="text-xl font-semibold text-foreground truncate">{fullName}</h2>
                <p className="text-sm text-accent truncate">{c.current_title || 'No title'}</p>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs text-muted-foreground">
                  {c.location && (
                    <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{c.location}</span>
                  )}
                  {c.experience_years != null && (
                    <span className="flex items-center gap-1"><Briefcase className="w-3 h-3" />{c.experience_years}y exp</span>
                  )}
                  {c.updated_at && (
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" />
                      Updated {formatDistanceToNow(new Date(c.updated_at), { addSuffix: true })}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <Link
                    to={`/candidates/${candidateId}`}
                    className="text-xs text-accent hover:underline inline-flex items-center gap-1"
                  >
                    Full profile <ExternalLink className="w-3 h-3" />
                  </Link>
                  {linkedinUrl && (
                    <a href={linkedinUrl} target="_blank" rel="noreferrer"
                      className="text-xs text-[#0077B5] hover:underline inline-flex items-center gap-1">
                      <Linkedin className="w-3 h-3" /> LinkedIn
                    </a>
                  )}
                </div>
              </div>
              <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
                <MatchScoreCircle score={match.match_score} size="md" />
                <Badge
                  variant="outline"
                  className={cn('text-[10px] uppercase tracking-wide', CONFIDENCE_COLOR[confidence])}
                >
                  {confidence}
                </Badge>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto">
            <Tabs defaultValue="overview" className="w-full">
              <div className="sticky top-0 z-10 bg-background border-b border-border px-6">
                <TabsList className="bg-transparent h-11 p-0 gap-1">
                  <TabsTrigger value="overview" className="data-[state=active]:bg-accent/10 data-[state=active]:text-accent">
                    Overview
                  </TabsTrigger>
                  <TabsTrigger value="cv" className="data-[state=active]:bg-accent/10 data-[state=active]:text-accent">
                    CV
                  </TabsTrigger>
                  <TabsTrigger value="activity" className="data-[state=active]:bg-accent/10 data-[state=active]:text-accent">
                    Activity
                  </TabsTrigger>
                  <TabsTrigger value="notes" className="data-[state=active]:bg-accent/10 data-[state=active]:text-accent">
                    Notes
                  </TabsTrigger>
                </TabsList>
              </div>

              {/* Overview */}
              <TabsContent value="overview" className="px-6 py-5 space-y-5 mt-0">
                {/* AI Summary */}
                {match.ai_summary && (
                  <div className="rounded-xl border border-accent/20 bg-accent/[0.03] p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkles className="w-4 h-4 text-accent" />
                      <span className="text-xs uppercase tracking-wide font-medium text-accent">
                        AI Match Summary
                      </span>
                    </div>
                    <p className="text-sm text-foreground leading-relaxed">{match.ai_summary}</p>
                  </div>
                )}

                {/* Why this match? */}
                {match.sub_scores && (
                  <Collapsible open={whyOpen} onOpenChange={setWhyOpen}>
                    <CollapsibleTrigger asChild>
                      <button className="w-full flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/40 transition-colors">
                        <span className="text-sm font-medium text-foreground">Why this match?</span>
                        <ChevronDown className={cn('w-4 h-4 text-muted-foreground transition-transform', whyOpen && 'rotate-180')} />
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pt-3">
                      <div className="space-y-2.5">
                        {FACTOR_KEYS.map((k) => {
                          const v = Math.round(((match.sub_scores?.[k] as number | undefined) ?? 0) * 100);
                          const tone = v >= 70 ? 'bg-emerald-500' : v >= 40 ? 'bg-amber-500' : 'bg-rose-500';
                          return (
                            <div key={k}>
                              <div className="flex items-center justify-between text-xs mb-1">
                                <span className="text-foreground">{FACTOR_LABELS[k]}</span>
                                <span className="text-muted-foreground tabular-nums">
                                  {v}% <span className="opacity-60">· {FACTOR_WEIGHTS[k]}% weight</span>
                                </span>
                              </div>
                              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                                <div className={cn('h-full transition-all', tone)} style={{ width: `${v}%` }} />
                              </div>
                            </div>
                          );
                        })}
                        {(match.sub_scores.penalty ?? 0) > 0 && (
                          <div className="text-xs text-rose-600 mt-2 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            −{Math.round((match.sub_scores.penalty ?? 0) * 100)} penalty applied (role/skill/seniority mismatch)
                          </div>
                        )}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                )}

                {/* Strengths / Gaps */}
                {(strengths.length > 0 || gaps.length > 0) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {strengths.length > 0 && (
                      <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.04] p-3">
                        <div className="text-xs font-medium text-emerald-700 mb-2 uppercase tracking-wide">Strengths</div>
                        <ul className="space-y-1.5">
                          {strengths.map((s, i) => (
                            <li key={i} className="text-xs text-foreground flex items-start gap-1.5">
                              <CheckCircle2 className="w-3 h-3 mt-0.5 text-emerald-600 flex-shrink-0" />
                              <span>{s}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {gaps.length > 0 && (
                      <div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.04] p-3">
                        <div className="text-xs font-medium text-amber-700 mb-2 uppercase tracking-wide">Gaps</div>
                        <ul className="space-y-1.5">
                          {gaps.map((g, i) => (
                            <li key={i} className="text-xs text-foreground flex items-start gap-1.5">
                              <AlertCircle className="w-3 h-3 mt-0.5 text-amber-600 flex-shrink-0" />
                              <span>{g}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {/* Quick Actions */}
                <div>
                  <h3 className="text-xs uppercase tracking-wide font-medium text-muted-foreground mb-2.5">
                    Quick actions
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <ActionBtn icon={Sparkles} label="AI outreach" onClick={() => setAiEmailOpen(true)} disabled={!c.email} />
                    <ActionBtn icon={Mail} label="Send email" onClick={() => setAiEmailOpen(true)} disabled={!c.email} />
                    <ActionBtn
                      icon={MessageCircle} label="WhatsApp"
                      onClick={handleWhatsApp} disabled={!waNumber}
                      iconClass="text-green-600"
                    />
                    <ActionBtn
                      icon={UserPlus} label="Add to pipeline"
                      onClick={handleAddToPipeline}
                      loading={addingPipeline}
                    />
                    <ActionBtn
                      icon={Calendar} label="Schedule interview"
                      onClick={() => toast.info('Open the Events module to schedule')}
                    />
                    <ActionBtn
                      icon={Share2} label="Share with client"
                      onClick={() => toast.info('Client sharing coming next')}
                    />
                  </div>
                </div>

                {candidateId && (
                  <div className="border rounded-lg p-3 space-y-2">
                    <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" /> Outcome capture
                    </div>
                    <OutcomeCaptureBar jobId={jobId} candidateId={candidateId} compact />
                  </div>
                )}
              </TabsContent>

              {/* CV */}
              <TabsContent value="cv" className="px-6 py-5 space-y-4 mt-0">
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={handlePreviewOriginal} disabled={!cvFileUrl || previewLoading}>
                    {previewLoading && previewType === 'original'
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : <Eye className="w-3.5 h-3.5" />}
                    Preview Original
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleDownloadOriginal} disabled={!cvFileUrl}>
                    <Download className="w-3.5 h-3.5" /> Download Original
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleDownloadBranded} disabled={!cvFileUrl || isBranding}>
                    {isBranding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                    Download Branded
                  </Button>
                </div>

                {!cvFileUrl && (
                  <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                    <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    No CV uploaded for this candidate yet.
                  </div>
                )}

                {previewUrl && (
                  <div className="rounded-lg border border-border overflow-hidden bg-muted/20">
                    <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-card">
                      <span className="text-xs font-medium text-muted-foreground">
                        {previewType === 'original' ? 'Original CV' : 'Branded CV'} preview
                      </span>
                      <a href={previewUrl} target="_blank" rel="noreferrer"
                        className="text-xs text-accent hover:underline inline-flex items-center gap-1">
                        Open in new tab <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                    <iframe
                      src={previewUrl}
                      title="CV Preview"
                      className="w-full h-[600px] bg-background"
                    />
                  </div>
                )}
              </TabsContent>

              {/* Activity */}
              <TabsContent value="activity" className="px-6 py-5 mt-0">
                {actLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
                  </div>
                ) : activities.length === 0 ? (
                  <div className="text-center py-10 text-sm text-muted-foreground">
                    <History className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    No activity recorded yet.
                  </div>
                ) : (
                  <ol className="relative border-l border-border ml-2 space-y-4">
                    {activities.map((a) => (
                      <li key={a.id} className="ml-4">
                        <div className="absolute -left-1.5 w-3 h-3 rounded-full bg-accent ring-4 ring-background" />
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="text-sm font-medium text-foreground capitalize">
                            {a.action_type.replace(/_/g, ' ')}
                          </span>
                          <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                            {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
                          </span>
                        </div>
                        {a.metadata && Object.keys(a.metadata).length > 0 && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                            {Object.entries(a.metadata).slice(0, 2).map(([k, v]) => `${k}: ${String(v).slice(0, 80)}`).join(' · ')}
                          </p>
                        )}
                      </li>
                    ))}
                  </ol>
                )}
              </TabsContent>

              {/* Notes */}
              <TabsContent value="notes" className="px-6 py-5 space-y-3 mt-0">
                <Textarea
                  placeholder="Add a private note about this candidate…"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={5}
                />
                <div className="flex justify-end">
                  <Button size="sm" onClick={handleSaveNote} disabled={!note.trim() || savingNote}>
                    {savingNote ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <StickyNote className="w-3.5 h-3.5" />}
                    Save note
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Notes are private to your team. For a full history, open the{' '}
                  <Link to={`/candidates/${candidateId}`} className="text-accent hover:underline">candidate profile</Link>.
                </p>
              </TabsContent>
            </Tabs>
          </div>

          {/* Sticky footer */}
          <div className="border-t border-border px-6 py-3 bg-card flex items-center justify-between gap-3">
            <Button variant="ghost" size="sm" onClick={() => { onDismiss?.(); onOpenChange(false); }}>
              Dismiss
            </Button>
            <Button size="sm" onClick={handleAddToPipeline} disabled={addingPipeline} className="gap-1.5">
              {addingPipeline ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
              Add to pipeline
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Email dialogs */}
      {c.email && (
        <SendCandidateEmailModal
          open={aiEmailOpen}
          onOpenChange={setAiEmailOpen}
          candidate={{
            id: c.id,
            full_name: fullName,
            email: c.email,
          } as any}
          preSelectedJobId={jobId}
        />
      )}
    </>
  );
}

function ActionBtn({
  icon: Icon, label, onClick, disabled, loading, iconClass,
}: {
  icon: any; label: string; onClick: () => void;
  disabled?: boolean; loading?: boolean; iconClass?: string;
}) {
  return (
    <Button
      variant="outline" size="sm"
      onClick={onClick} disabled={disabled || loading}
      className="h-auto py-2.5 px-3 flex-col gap-1.5 items-center justify-center text-xs font-medium hover:border-accent/40 hover:bg-accent/5"
    >
      {loading
        ? <Loader2 className="w-4 h-4 animate-spin" />
        : <Icon className={cn('w-4 h-4', iconClass)} />}
      <span>{label}</span>
    </Button>
  );
}
