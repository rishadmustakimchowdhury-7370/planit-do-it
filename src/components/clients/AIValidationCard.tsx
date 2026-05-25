import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles, RefreshCw, CheckCircle2, AlertTriangle, ShieldAlert } from "lucide-react";
import { useLatestValidation, useValidateCandidateFit } from "@/hooks/useCandidateValidation";
import { formatDistanceToNow } from "date-fns";

interface Props {
  jobId: string;
  candidateId: string;
  compact?: boolean;
  canRegenerate?: boolean;
}

const RECO_META: Record<string, { label: string; variant: "default" | "secondary" | "destructive"; icon: any }> = {
  strongly_recommended: { label: "Strongly Recommended", variant: "default", icon: CheckCircle2 },
  needs_review: { label: "Needs Review", variant: "secondary", icon: AlertTriangle },
  not_recommended: { label: "Not Recommended", variant: "destructive", icon: ShieldAlert },
};

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
            <p className="text-sm text-muted-foreground">Run a fit assessment before submitting this candidate.</p>
          </div>
          <Button onClick={() => generate(false)} disabled={loading}>
            <Sparkles className="h-4 w-4 mr-2" />
            {loading ? "Analyzing..." : "Run AI Validation"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const meta = RECO_META[validation.recommendation ?? "needs_review"];
  const Icon = meta.icon;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
        <div className="space-y-1">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" /> AI Fit Validation
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Generated {formatDistanceToNow(new Date(validation.created_at), { addSuffix: true })}
            {validation.model ? ` · ${validation.model}` : ""}
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
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium">Fit Score</span>
              <span className="text-sm font-semibold">{validation.fit_score ?? 0}%</span>
            </div>
            <Progress value={validation.fit_score ?? 0} />
          </div>
          <Badge variant={meta.variant} className="gap-1">
            <Icon className="h-3 w-3" /> {meta.label}
          </Badge>
        </div>

        {validation.summary && (
          <p className="text-sm text-muted-foreground">{validation.summary}</p>
        )}

        {!compact && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <ValidationList title="Strengths" items={validation.strengths} tone="positive" />
            <ValidationList title="Considerations" items={validation.weaknesses} tone="warning" />
            <ValidationList title="Risks" items={validation.risks} tone="danger" />
          </div>
        )}
      </CardContent>
    </Card>
  );
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
