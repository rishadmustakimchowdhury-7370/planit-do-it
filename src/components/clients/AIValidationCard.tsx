import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Sparkles, RefreshCw, AlertTriangle, Loader2, Target, Building2 } from "lucide-react";
import { useLatestValidation, useValidateCandidateFit, useAutoRevalidate } from "@/hooks/useCandidateValidation";
import { RecommendationBadge } from "@/components/matching/RecommendationBadge";
import { clientSafeMeta, clientSafeSummary, recommendationMeta } from "@/lib/recommendation";
import { formatDistanceToNow } from "date-fns";
import { CopilotIntelligenceSection } from "./CopilotIntelligenceSection";
import { useAuth } from "@/lib/auth";

interface Props {
  jobId: string;
  candidateId: string;
  compact?: boolean;
  canRegenerate?: boolean;
  /** When true, hide recruiter-only fields (reject band, blunt evidence, internal scores). */
  clientSafe?: boolean;
  /** Surface label for contextual copilot ordering. */
  copilotContext?: "validation" | "matching" | "submission";
}

export function AIValidationCard({ jobId, candidateId, compact, canRegenerate = true, clientSafe = false, copilotContext = "validation" }: Props) {
  const { tenantId } = useAuth();
  const { data: validation, isLoading } = useLatestValidation(jobId, candidateId);
  const { run, loading } = useValidateCandidateFit();
  const { staleInProgress } = useAutoRevalidate(validation);

  const generate = (force = false) => run(jobId, candidateId, { force });

  if (isLoading) {
    return (
      <Card>
        <CardHeader><Skeleton className="h-5 w-40" /></CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </CardContent>
      </Card>
    );
  }

  if (!validation) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center gap-3 py-8 text-center">
          <Sparkles className="h-8 w-8 text-primary" />
          <div>
            <p className="font-medium">No AI validation yet</p>
            <p className="text-sm text-muted-foreground">Run an evidence-based recruiter assessment before submitting this candidate.</p>
          </div>
          <Button onClick={() => generate(false)} disabled={loading}>
            <Sparkles className="h-4 w-4 mr-2" />
            {loading ? "Analyzing..." : "Run AI Validation"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const confidence = validation.confidence;
  const mandate = Array.isArray((validation as any).mandate_match) ? (validation as any).mandate_match : [];
  const visibleMandate = mandate.filter((m: any) => m && !m.__kind && typeof m.requirement === "string");
  const missingSidecar = mandate.find((m: any) => m?.__kind === "missing");
  const missing = Array.isArray(missingSidecar?.items) ? missingSidecar.items : [];
  const ownershipSidecar = mandate.find((m: any) => m?.__kind === "functional_ownership");
  const ownership: string[] = Array.isArray(ownershipSidecar?.items) ? ownershipSidecar.items : [];
  const ecosystem = (validation.ecosystem_signals ?? []) as Array<{ company: string; ecosystem: string; relevance: string }>;
  const ip = validation.interview_probability;
  const rec = (validation as any).match_classification ?? validation.recommendation;
  const meta = clientSafe ? clientSafeMeta(rec, validation.fit_score) : recommendationMeta(rec, validation.fit_score);
  const summaryText = clientSafe ? (clientSafeSummary(rec, validation.summary) || validation.summary) : validation.summary;

  // Filter out raw "reject" / missing requirements from client view
  const safeVisibleMandate = clientSafe
    ? visibleMandate.filter((m: any) => m.fit !== "NOT MATCHED")
    : visibleMandate;
  const safeMissing = clientSafe ? [] : missing;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
        <div className="space-y-1">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" /> {clientSafe ? "Candidate Assessment" : "Recruiter Assessment"}
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            {clientSafe ? "AI-validated against role requirements" : "Evidence-based AI validation"} · Generated {formatDistanceToNow(new Date(validation.created_at), { addSuffix: true })}
            {confidence && !clientSafe ? ` · ${confidence} confidence` : ""}
          </p>
        </div>
        {canRegenerate && !clientSafe && (
          <Button size="sm" variant="ghost" onClick={() => generate(true)} disabled={loading || staleInProgress}>
            <RefreshCw className={`h-4 w-4 mr-1 ${(loading || staleInProgress) ? "animate-spin" : ""}`} />
            Re-run
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {(validation.validation_stale || staleInProgress) && (
          <div className="flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
            {staleInProgress ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <AlertTriangle className="h-3.5 w-3.5" />}
            JD updated — re-validation in progress. Current assessment may be outdated.
          </div>
        )}

        <div className="flex items-center justify-between gap-3 flex-wrap">
          <span className={`inline-flex items-center rounded-full border font-medium leading-none text-sm px-3 py-1.5 gap-2 ${meta.badgeClass}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${meta.dotClass}`} />
            {meta.label}
          </span>
          {ip != null && (
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <Target className="h-3.5 w-3.5 text-primary" />
              Interview probability <strong className="text-foreground">{ip}%</strong>
            </span>
          )}
        </div>

        {summaryText && (
          <p className="text-sm text-foreground/90 leading-relaxed">{summaryText}</p>
        )}

        {!clientSafe && ownership.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Functional Ownership Detected</p>
            <div className="flex flex-wrap gap-1.5">
              {ownership.map((o, i) => (
                <Badge key={i} variant="secondary" className="text-[11px]">{o}</Badge>
              ))}
            </div>
          </div>
        )}

        {ecosystem.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5 flex items-center gap-1.5">
              <Building2 className="h-3 w-3" /> Ecosystem Signals
            </p>
            <ul className="flex flex-wrap gap-1.5">
              {ecosystem.slice(0, 6).map((s, i) => (
                <li key={i} className={`text-[11px] rounded-full border px-2 py-0.5 ${
                  s.relevance === "tier1" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" :
                  s.relevance === "tier2" ? "border-teal-500/30 bg-teal-500/10 text-teal-700 dark:text-teal-300" :
                  "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300"
                }`}>
                  {s.company} · {s.ecosystem}
                </li>
              ))}
            </ul>
          </div>
        )}

        {!compact && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ValidationList title="Strengths" items={validation.strengths} tone="positive" />
            <ValidationList title={clientSafe ? "Interview Focus Areas" : "Considerations"} items={validation.weaknesses} tone="warning" />
          </div>
        )}

        {!compact && safeVisibleMandate.length > 0 && (
          <div className="rounded-lg border bg-muted/30 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              Fit Assessment vs Job Requirements
            </p>
            <ul className="space-y-2">
              {safeVisibleMandate.slice(0, 8).map((m: any, i: number) => (
                <li key={i} className="text-xs grid grid-cols-[1fr_auto] gap-2 items-start">
                  <div>
                    <div className="font-medium text-foreground">{m.requirement}</div>
                    <div className="text-muted-foreground mt-0.5">{m.evidence}</div>
                  </div>
                  <FitChip fit={String(m.fit).toUpperCase()} />
                </li>
              ))}
            </ul>
          </div>
        )}

        {!compact && safeMissing.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Missing Requirements</p>
            <ul className="flex flex-wrap gap-1.5">
              {safeMissing.map((m: string, i: number) => (
                <li key={i} className="text-[11px] rounded-full border border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300 px-2 py-0.5">
                  {m}
                </li>
              ))}
            </ul>
          </div>
        )}

        {!compact && !clientSafe && (validation as any).recruiter_review && (
          <div className="rounded-lg border-l-2 border-primary pl-3 py-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Recruiter Review</p>
            <p className="text-sm text-foreground/90 italic">{(validation as any).recruiter_review}</p>
          </div>
        )}

        {!clientSafe && tenantId && (
          <CopilotIntelligenceSection
            copilot={(validation as any).recruiter_copilot ?? null}
            context={copilotContext}
            tenantId={tenantId}
            jobId={jobId}
            candidateId={candidateId}
            aiClassification={String(rec ?? "")}
            recruiterOverride={(validation as any).recruiter_override ?? null}
            overrideDivergence={!!(validation as any).override_divergence}
          />
        )}
      </CardContent>
    </Card>
  );
}

const FIT_STYLES: Record<string, string> = {
  "EXCEEDS": "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  "STRONG": "bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/30",
  "GOOD": "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
  "PARTIAL": "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  "WEAK": "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30",
  "NOT MATCHED": "bg-destructive/15 text-destructive border-destructive/30",
};

function FitChip({ fit }: { fit: string }) {
  const cls = FIT_STYLES[fit] ?? FIT_STYLES["PARTIAL"];
  return <span className={`text-[10px] font-semibold uppercase tracking-wide border rounded px-1.5 py-0.5 ${cls}`}>{fit}</span>;
}

function ValidationList({ title, items, tone }: { title: string; items: string[]; tone: "positive" | "warning" | "danger" }) {
  const dot = tone === "positive" ? "bg-emerald-500" : tone === "warning" ? "bg-amber-500" : "bg-destructive";
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">{title}</p>
      {items?.length ? (
        <ul className="space-y-1.5">
          {items.map((it, i) => (
            <li key={i} className="flex gap-2 text-sm">
              <span className={`mt-1.5 h-1.5 w-1.5 rounded-full shrink-0 ${dot}`} />
              <span>{it}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground italic">None noted.</p>
      )}
    </div>
  );
}
