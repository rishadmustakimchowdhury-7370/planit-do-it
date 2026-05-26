// Structured recruiter notes — single source of truth for screening details.
// The free-text array fed to the AI engine is auto-derived from these fields.

export interface StructuredRecruiterNotes {
  notice_period?: string;
  current_salary?: string;
  salary_expectation?: string;
  relocation?: string;
  visa_status?: string;
  availability?: string;
  communication_quality?: "excellent" | "strong" | "average" | "needs_work" | "";
  client_facing_ability?: "excellent" | "strong" | "average" | "limited" | "";
  interview_feedback?: string;
  other_notes?: string[];
}

const FIELD_LABELS: Record<keyof StructuredRecruiterNotes, string> = {
  notice_period: "Notice period",
  current_salary: "Current salary",
  salary_expectation: "Salary expectation",
  relocation: "Relocation",
  visa_status: "Visa status",
  availability: "Availability",
  communication_quality: "Communication quality",
  client_facing_ability: "Client-facing ability",
  interview_feedback: "Interview feedback",
  other_notes: "Other notes",
};

const ORDER: (keyof StructuredRecruiterNotes)[] = [
  "notice_period",
  "current_salary",
  "salary_expectation",
  "availability",
  "relocation",
  "visa_status",
  "communication_quality",
  "client_facing_ability",
  "interview_feedback",
  "other_notes",
];

const QUALITY_LABEL: Record<string, string> = {
  excellent: "excellent",
  strong: "strong",
  average: "average",
  needs_work: "needs work",
  limited: "limited",
};

export function structuredNotesToLines(n: StructuredRecruiterNotes | null | undefined): string[] {
  if (!n) return [];
  const lines: string[] = [];
  for (const key of ORDER) {
    const v = (n as any)[key];
    if (v == null) continue;
    if (Array.isArray(v)) {
      for (const item of v) {
        const t = String(item).trim();
        if (t) lines.push(t);
      }
      continue;
    }
    const str = String(v).trim();
    if (!str) continue;
    const label = FIELD_LABELS[key];
    const pretty = QUALITY_LABEL[str] ?? str;
    lines.push(`${label}: ${pretty}`);
  }
  return lines;
}

export function emptyStructuredNotes(): StructuredRecruiterNotes {
  return {
    notice_period: "",
    current_salary: "",
    salary_expectation: "",
    relocation: "",
    visa_status: "",
    availability: "",
    communication_quality: "",
    client_facing_ability: "",
    interview_feedback: "",
    other_notes: [],
  };
}
