import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles, RefreshCw } from "lucide-react";
import { useLatestValidation, useValidateCandidateFit } from "@/hooks/useCandidateValidation";
import { RecommendationBadge } from "@/components/matching/RecommendationBadge";
import { formatDistanceToNow } from "date-fns";

interface Props {
  jobId: string;
  candidateId: string;
  compact?: boolean;
  canRegenerate?: boolean;
}

export function AIValidationCard({ jobId, candidateId, compact, canRegenerate = true }: Props) {
  const { data: validation, isLoading } = useLatestValidation(jobId, candidateId);
  const { run, loading } = useValidateCandidateFit();

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

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
        <div className="space-y-1">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" /> Recruiter Assessment
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Evidence-based AI validation · Generated {formatDistanceToNow(new Date(validation.created_at), { addSuffix: true })}
            {confidence ? ` · ${confidence} confidence` : ""}
          </p>
        </div>
        {canRegenerate && (
          <Button size="sm" variant="ghost" onClick={() => generate(true)} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
            Re-run
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <RecommendationBadge
            recommendation={validation.recommendation}
            score={validation.fit_score}
            size="lg"
          />
        </div>


        {validation.summary && (
          <p className="text-sm text-foreground/90 leading-relaxed">{validation.summary}</p>
        )}

        {!compact && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ValidationList title="Strengths" items={validation.strengths} tone="positive" />
            <ValidationList title="Considerations" items={validation.weaknesses} tone="warning" />
          </div>
        )}

        {!compact && visibleMandate.length > 0 && (
          <div className="rounded-lg border bg-muted/30 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              Fit Assessment vs Job Requirements
            </p>
            <ul className="space-y-2">
              {visibleMandate.slice(0, 8).map((m: any, i: number) => (
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

        {!compact && missing.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Missing Requirements</p>
            <ul className="flex flex-wrap gap-1.5">
              {missing.map((m: string, i: number) => (
                <li key={i} className="text-[11px] rounded-full border border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300 px-2 py-0.5">
                  {m}
                </li>
              ))}
            </ul>
          </div>
        )}

        {!compact && (validation as any).recruiter_review && (
          <div className="rounded-lg border-l-2 border-primary pl-3 py-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Recruiter Review</p>
            <p className="text-sm text-foreground/90 italic">{(validation as any).recruiter_review}</p>
          </div>
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
