// Recruiter Workflow Optimization — Phase 6 (AI Fatigue Prevention)
// Single, calm AI signal per row. Replaces stacked badges/percentages with
// one subtle chip — a left-edge accent + short label. Detail (reasoning,
// signals, calibration) is revealed on hover/click, never up-front.
// Honors `useCalmMode`: when calm mode is on, numeric confidence is hidden.

import { memo } from "react";
import { Sparkles } from "lucide-react";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { cn } from "@/lib/utils";
import { useCalmMode } from "@/hooks/useCalmMode";

type Tier = "strong" | "fit" | "watch" | "weak" | "unknown";

function tierFromScore(score?: number | null): Tier {
  if (score == null || Number.isNaN(score)) return "unknown";
  if (score >= 80) return "strong";
  if (score >= 65) return "fit";
  if (score >= 45) return "watch";
  return "weak";
}

const TIER_STYLES: Record<Tier, { accent: string; label: string }> = {
  strong:  { accent: "bg-emerald-500",  label: "Strong fit" },
  fit:     { accent: "bg-primary",       label: "Likely fit" },
  watch:   { accent: "bg-amber-500",     label: "Worth a look" },
  weak:    { accent: "bg-muted-foreground", label: "Long shot" },
  unknown: { accent: "bg-muted",         label: "Not assessed" },
};

export interface AIInsightChipProps {
  /** 0–100 calibrated placement probability or fit score. */
  score?: number | null;
  /** Optional short headline shown inline (e.g. "Strong fit"). Overrides tier label. */
  label?: string;
  /** Rich detail rendered inside the hover card. */
  detail?: React.ReactNode;
  /** Optional list of short signal lines for the hover card. */
  signals?: string[];
  className?: string;
}

export const AIInsightChip = memo(function AIInsightChip({
  score,
  label,
  detail,
  signals,
  className,
}: AIInsightChipProps) {
  const { calm } = useCalmMode();
  const tier = tierFromScore(score);
  const style = TIER_STYLES[tier];
  const showScore = !calm && tier !== "unknown" && typeof score === "number";

  return (
    <HoverCard openDelay={200} closeDelay={100}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          className={cn(
            "group inline-flex items-center gap-2 rounded-md border bg-card px-2 py-1 text-xs font-medium text-foreground/80 transition-colors hover:bg-muted",
            className,
          )}
          aria-label="AI insight"
        >
          <span className={cn("h-3.5 w-1 rounded-full", style.accent)} aria-hidden />
          <span className="truncate">{label ?? style.label}</span>
          {showScore && (
            <span className="tabular-nums text-muted-foreground">{Math.round(score!)}</span>
          )}
          <Sparkles className="h-3 w-3 text-muted-foreground/60 transition-opacity group-hover:opacity-100 opacity-40" />
        </button>
      </HoverCardTrigger>
      <HoverCardContent className="w-80 text-sm" align="start">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5" />
            Recruiter Copilot
          </div>
          <div className="font-medium">{label ?? style.label}</div>
          {showScore && (
            <div className="text-xs text-muted-foreground">
              Calibrated placement probability:{" "}
              <span className="font-medium text-foreground">{Math.round(score!)}%</span>
            </div>
          )}
          {signals && signals.length > 0 && (
            <ul className="space-y-1 pt-1 text-xs text-muted-foreground">
              {signals.slice(0, 5).map((s, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-muted-foreground/50">•</span>
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          )}
          {detail && <div className="pt-1 text-xs text-muted-foreground">{detail}</div>}
          <div className="pt-2 text-[10px] uppercase tracking-wide text-muted-foreground/70">
            Recruiter remains the decision-maker.
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
});
