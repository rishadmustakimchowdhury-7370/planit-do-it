import { cn } from "@/lib/utils";
import { Sparkles } from "lucide-react";
import { recommendationMeta, AnyRecommendation } from "@/lib/recommendation";

interface Props {
  recommendation?: AnyRecommendation;
  score?: number | null;
  size?: "sm" | "md" | "lg";
  showInternalScore?: boolean; // small, secondary; default false
  className?: string;
}

const sizeMap = {
  sm: "text-[11px] px-2 py-0.5 gap-1",
  md: "text-xs px-2.5 py-1 gap-1.5",
  lg: "text-sm px-3 py-1.5 gap-2",
};

export function RecommendationBadge({ recommendation, score, size = "md", showInternalScore = false, className }: Props) {
  const meta = recommendationMeta(recommendation, score);
  return (
    <span className={cn("inline-flex items-center rounded-full border font-medium leading-none", meta.badgeClass, sizeMap[size], className)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", meta.dotClass)} />
      {meta.label}
      {showInternalScore && score != null && (
        <span className="opacity-60 font-normal">· {score}</span>
      )}
    </span>
  );
}

// Optional micro variant for tight rows
export function RecommendationDot({ recommendation, score, label = true }: { recommendation?: AnyRecommendation; score?: number | null; label?: boolean }) {
  const meta = recommendationMeta(recommendation, score);
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-foreground/80">
      <Sparkles className="h-3 w-3 text-primary" />
      <span className={cn("h-2 w-2 rounded-full", meta.dotClass)} />
      {label && <span>{meta.label}</span>}
    </span>
  );
}
