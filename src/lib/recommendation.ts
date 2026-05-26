// Centralized recommendation taxonomy — single source of truth for all UI.
// Score remains internal-only; the visible UI surfaces recruiter-style labels.

export type RecommendationKey =
  | "strong_match"
  | "recommended"
  | "moderate_fit"
  | "needs_review"
  | "limited_alignment"
  | "not_suitable";

// Legacy keys still emitted by older rows / sub-systems
export type LegacyKey =
  | "strongly_recommended"
  | "needs_review"
  | "not_recommended";

export type AnyRecommendation = RecommendationKey | LegacyKey | string | null | undefined;

export interface RecommendationMeta {
  key: RecommendationKey;
  label: string;
  tone: "positive" | "good" | "neutral" | "caution" | "warning" | "negative";
  badgeClass: string; // tailwind classes for a colored pill
  dotClass: string;
}

const META: Record<RecommendationKey, RecommendationMeta> = {
  strong_match: {
    key: "strong_match",
    label: "Strong Match",
    tone: "positive",
    badgeClass: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
    dotClass: "bg-emerald-500",
  },
  recommended: {
    key: "recommended",
    label: "Recommended",
    tone: "good",
    badgeClass: "bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/30",
    dotClass: "bg-teal-500",
  },
  moderate_fit: {
    key: "moderate_fit",
    label: "Moderate Fit",
    tone: "neutral",
    badgeClass: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
    dotClass: "bg-amber-500",
  },
  needs_review: {
    key: "needs_review",
    label: "Needs Review",
    tone: "caution",
    badgeClass: "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30",
    dotClass: "bg-orange-500",
  },
  limited_alignment: {
    key: "limited_alignment",
    label: "Limited Alignment",
    tone: "warning",
    badgeClass: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30",
    dotClass: "bg-rose-500",
  },
  not_suitable: {
    key: "not_suitable",
    label: "Not Suitable",
    tone: "negative",
    badgeClass: "bg-destructive/15 text-destructive border-destructive/30",
    dotClass: "bg-destructive",
  },
};

export function scoreToRecommendation(score: number | null | undefined): RecommendationMeta {
  if (score == null) return META.needs_review;
  if (score >= 88) return META.strong_match;
  if (score >= 75) return META.recommended;
  if (score >= 62) return META.moderate_fit;
  if (score >= 50) return META.needs_review;
  if (score >= 35) return META.limited_alignment;
  return META.not_suitable;
}

export function recommendationMeta(rec: AnyRecommendation, fallbackScore?: number | null): RecommendationMeta {
  if (!rec) return scoreToRecommendation(fallbackScore ?? null);
  const k = String(rec).toLowerCase().replace(/[\s-]+/g, "_");
  if ((META as any)[k]) return (META as any)[k] as RecommendationMeta;
  // Legacy mapping
  if (k === "strongly_recommended") return META.strong_match;
  if (k === "not_recommended") return META.not_suitable;
  if (k === "needs_review") return META.needs_review;
  return scoreToRecommendation(fallbackScore ?? null);
}

export const ALL_RECOMMENDATIONS = Object.values(META);
