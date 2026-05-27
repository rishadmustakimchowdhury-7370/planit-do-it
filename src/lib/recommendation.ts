// Centralized recommendation taxonomy — single source of truth for all UI.
// Internal (recruiter-only) bands include `reject` and `weak_match`. The client
// portal MUST use clientSafeMeta() which collapses those to polite framings.

export type RecommendationKey =
  // New Executive Search OS taxonomy
  | "strong_match"
  | "recommended"
  | "transferable_match"
  | "needs_validation"
  | "weak_match"
  | "reject"
  // Retained legacy keys (older rows) — mapped at render time
  | "moderate_fit"
  | "needs_review"
  | "limited_alignment"
  | "not_suitable";

export type AnyRecommendation = RecommendationKey | string | null | undefined;

export interface RecommendationMeta {
  key: RecommendationKey;
  label: string;
  tone: "positive" | "good" | "neutral" | "caution" | "warning" | "negative";
  badgeClass: string;
  dotClass: string;
}

const META: Record<RecommendationKey, RecommendationMeta> = {
  strong_match: {
    key: "strong_match", label: "Strong Match", tone: "positive",
    badgeClass: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
    dotClass: "bg-emerald-500",
  },
  recommended: {
    key: "recommended", label: "Recommended", tone: "good",
    badgeClass: "bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/30",
    dotClass: "bg-teal-500",
  },
  transferable_match: {
    key: "transferable_match", label: "Transferable Match", tone: "good",
    badgeClass: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30",
    dotClass: "bg-sky-500",
  },
  needs_validation: {
    key: "needs_validation", label: "Needs Validation", tone: "neutral",
    badgeClass: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
    dotClass: "bg-amber-500",
  },
  weak_match: {
    key: "weak_match", label: "Weak Match", tone: "warning",
    badgeClass: "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30",
    dotClass: "bg-orange-500",
  },
  reject: {
    key: "reject", label: "Reject (Internal)", tone: "negative",
    badgeClass: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30",
    dotClass: "bg-rose-500",
  },
  // Legacy
  moderate_fit: {
    key: "moderate_fit", label: "Moderate Fit", tone: "neutral",
    badgeClass: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
    dotClass: "bg-amber-500",
  },
  needs_review: {
    key: "needs_review", label: "Needs Review", tone: "caution",
    badgeClass: "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30",
    dotClass: "bg-orange-500",
  },
  limited_alignment: {
    key: "limited_alignment", label: "Limited Alignment", tone: "warning",
    badgeClass: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30",
    dotClass: "bg-rose-500",
  },
  not_suitable: {
    key: "not_suitable", label: "Not Suitable", tone: "negative",
    badgeClass: "bg-destructive/15 text-destructive border-destructive/30",
    dotClass: "bg-destructive",
  },
};

// Client-safe versions — collapse blunt bands to polite framings.
const CLIENT_SAFE_KEYS: Record<RecommendationKey, RecommendationKey> = {
  strong_match: "strong_match",
  recommended: "recommended",
  transferable_match: "transferable_match",
  needs_validation: "needs_validation",
  weak_match: "needs_validation",      // shown as "Interview Worthy" via override
  reject: "needs_validation",          // never expose "reject" to client
  moderate_fit: "needs_validation",
  needs_review: "needs_validation",
  limited_alignment: "needs_validation",
  not_suitable: "needs_validation",
};

const CLIENT_SAFE_LABEL: Partial<Record<RecommendationKey, string>> = {
  needs_validation: "Interview Worthy",
};

export function scoreToRecommendation(score: number | null | undefined): RecommendationMeta {
  if (score == null) return META.needs_validation;
  if (score >= 85) return META.strong_match;
  if (score >= 70) return META.recommended;
  if (score >= 55) return META.transferable_match;
  if (score >= 40) return META.needs_validation;
  if (score >= 25) return META.weak_match;
  return META.reject;
}

export function recommendationMeta(rec: AnyRecommendation, fallbackScore?: number | null): RecommendationMeta {
  if (!rec) return scoreToRecommendation(fallbackScore ?? null);
  const k = String(rec).toLowerCase().replace(/[\s-]+/g, "_");
  if (k === "strongly_recommended" || k === "highly_recommended") return META.strong_match;
  if (k === "not_recommended") return META.reject;
  if ((META as any)[k]) return (META as any)[k] as RecommendationMeta;
  return scoreToRecommendation(fallbackScore ?? null);
}

// Use on every client-facing surface (portal, submission pack, executive PDF).
export function clientSafeMeta(rec: AnyRecommendation, fallbackScore?: number | null): RecommendationMeta {
  const base = recommendationMeta(rec, fallbackScore);
  const safeKey = CLIENT_SAFE_KEYS[base.key] ?? "needs_validation";
  const meta = META[safeKey];
  const label = CLIENT_SAFE_LABEL[safeKey] ?? meta.label;
  return { ...meta, label };
}

export function clientSafeSummary(rec: AnyRecommendation, summary?: string | null): string {
  const k = String(rec ?? "").toLowerCase();
  if (k === "reject" || k === "weak_match" || k === "not_suitable" || k === "limited_alignment") {
    return "Current evidence suggests limited alignment with several core requirements. Further recruiter validation would be required before recommendation.";
  }
  return summary ?? "";
}

export const ALL_RECOMMENDATIONS = [
  META.strong_match, META.recommended, META.transferable_match,
  META.needs_validation, META.weak_match, META.reject,
];
