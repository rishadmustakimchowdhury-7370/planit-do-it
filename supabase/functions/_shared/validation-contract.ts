// Canonical contract for the Executive Search Operating System.
// Every surface (AI Match, Validation, Submission Pack, Executive PDF,
// Client Portal, Recruiter Dashboard, Recruiter Copilot) consumes this exact
// shape. No surface may re-derive scores, recommendations, or copilot output
// independently.

export type MatchClassification =
  | "strong_match"            // direct ownership across all mandates
  | "recommended"             // direct ownership across most mandates
  | "transferable_match"      // adjacent industry / regulated-portable
  | "needs_validation"        // ownership evidence ambiguous; interview required
  | "weak_match"              // mostly keyword-level evidence
  | "reject";                 // recruiter-only; never client-visible

// Client portal taxonomy — `reject` is collapsed to a polite band.
export type ClientSafeClassification =
  | "strong_match"
  | "recommended"
  | "transferable_match"
  | "interview_worthy"        // shown instead of needs_validation
  | "further_validation";     // shown instead of weak_match/reject

export const CLIENT_SAFE_MAP: Record<MatchClassification, ClientSafeClassification> = {
  strong_match: "strong_match",
  recommended: "recommended",
  transferable_match: "transferable_match",
  needs_validation: "interview_worthy",
  weak_match: "further_validation",
  reject: "further_validation",
};

export const CLIENT_SAFE_PHRASE: Record<ClientSafeClassification, string> = {
  strong_match: "Strong Match",
  recommended: "Recommended",
  transferable_match: "Transferable Match",
  interview_worthy: "Interview Worthy",
  further_validation: "Further Validation Recommended",
};

export interface EvidenceItem {
  requirement: string;
  kind: "mandatory" | "preferred" | "bonus";
  match_type: "direct" | "adjacent" | "transferable" | "unrelated";
  evidence_tier: "HIGH" | "MEDIUM" | "LOW";
  evidence: string;
  fit: "EXCEEDS" | "STRONG" | "GOOD" | "PARTIAL" | "WEAK" | "NOT MATCHED";
  ownership_verb?: string | null;
}

export interface EcosystemSignal {
  company: string;
  ecosystem: string;           // e.g. "Commodities Trading Houses"
  relevance: "tier1" | "tier2" | "adjacent";
}

// =========================================================================
// Recruiter Copilot — Phase 1 of Placement Intelligence
// Every copilot consumer reads exactly this shape; the validation engine is
// the single producer. Recruiter-only fields are NEVER surfaced in clientSafe
// renderings.
// =========================================================================

export type InterviewQuestionCategory =
  | "technical" | "leadership" | "operational_ownership"
  | "compliance" | "behavioral" | "risk" | "ecosystem";

export interface InterviewQuestion {
  category: InterviewQuestionCategory;
  question: string;
  intent: string;             // why we are asking — recruiter-only
  targets_requirement?: string | null;
}

export interface PredictedObjection {
  concern: string;            // recruiter-safe phrasing
  requirement_at_risk?: string | null;
  severity: "low" | "medium" | "high";
  suggested_response: string; // how the recruiter should rebut/handle
}

export interface PositioningAngle {
  angle: string;              // one-line narrative bullet
  evidence: string;           // anchor from the CV
  audience: "client" | "internal";
}

export type SubmissionStrategy =
  | "submit_now"
  | "screen_further"
  | "position_as_adjacent"
  | "emphasize_leadership"
  | "highlight_ecosystem"
  | "hold";

export interface PlacementProbability {
  shortlist_pct: number;          // 0–100
  interview_pct: number;          // 0–100
  placement_pct: number;          // 0–100
  client_acceptance_risk: "low" | "medium" | "high";
  rationale: string;              // recruiter-only, concise
}

export interface RecruiterCopilot {
  interview_guide: InterviewQuestion[];
  client_objections: PredictedObjection[];
  positioning_angles: PositioningAngle[];
  submission_strategy: {
    recommendation: SubmissionStrategy;
    rationale: string;
    talking_points: string[];
  };
  placement_probability: PlacementProbability;
}

export interface ValidationOutput {
  engine_version: string;
  match_classification: MatchClassification;
  interview_probability: number;          // 0–100
  summary: string;
  jd_analysis: {
    industry_domain: string | null;
    seniority_target: string | null;
    employment_lens: string | null;
    mandatory_requirements: string[];
    preferred_requirements: string[];
    bonus_requirements: string[];
    transferable_families: string[];
    certifications: string[];
    operational_ownership: string[];
  };
  requirement_matches: EvidenceItem[];
  functional_ownership: string[];
  ecosystem_signals: EcosystemSignal[];
  strengths: string[];
  considerations: string[];
  risks: string[];
  missing_requirements: string[];
  recruiter_notes_summary: string[];
  recruiter_notes_impact: { note: string; effect: string }[];
  recruiter_copilot?: RecruiterCopilot | null;
}

// Translate the strict recruiter band → a polite, commercially safe surface.
export function toClientSafe(cls: MatchClassification): ClientSafeClassification {
  return CLIENT_SAFE_MAP[cls] ?? "further_validation";
}

// Materialize a polite paragraph for the "further_validation" / "reject" path
// so the client never sees blunt language.
export function clientSafeSummary(cls: MatchClassification, summary: string): string {
  if (cls === "reject" || cls === "weak_match") {
    return "Current evidence suggests limited alignment with several core requirements. Further recruiter validation would be required before recommendation.";
  }
  return summary;
}
