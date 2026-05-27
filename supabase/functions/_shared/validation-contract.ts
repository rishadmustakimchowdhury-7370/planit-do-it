// Canonical contract for the Executive Search Operating System.
// Every surface (AI Match, Validation, Submission Pack, Executive PDF,
// Client Portal, Recruiter Dashboard) consumes this exact shape. No surface
// may re-derive scores or recommendations independently.

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
  functional_ownership: string[];         // verbs/areas the candidate truly owns
  ecosystem_signals: EcosystemSignal[];   // companies/orgs that carry weight
  strengths: string[];
  considerations: string[];               // interview focus areas (never "lacks")
  risks: string[];
  missing_requirements: string[];
  recruiter_notes_summary: string[];
  recruiter_notes_impact: { note: string; effect: string }[];
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
