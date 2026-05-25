import { Badge } from "@/components/ui/badge";
import type { Database } from "@/integrations/supabase/types";

export type SubmissionStatus = Database["public"]["Enums"]["submission_status"];

export const SUBMISSION_STATUS_META: Record<SubmissionStatus, { label: string; tone: string; order: number }> = {
  draft:               { label: "Draft",                tone: "bg-muted text-muted-foreground",                      order: 0 },
  ai_validated:        { label: "AI Validated",         tone: "bg-violet-500/10 text-violet-700 dark:text-violet-300", order: 1 },
  prepared:            { label: "Pack Ready",           tone: "bg-blue-500/10 text-blue-700 dark:text-blue-300",      order: 2 },
  submitted:           { label: "Submitted",            tone: "bg-sky-500/10 text-sky-700 dark:text-sky-300",         order: 3 },
  viewed:              { label: "Viewed",               tone: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-300",      order: 4 },
  screening:           { label: "Screening",            tone: "bg-amber-500/10 text-amber-700 dark:text-amber-300",   order: 5 },
  interview_requested: { label: "Interview Requested",  tone: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300",order: 6 },
  interview_confirmed: { label: "Interview Confirmed",  tone: "bg-purple-500/10 text-purple-700 dark:text-purple-300",order: 7 },
  final_review:        { label: "Final Review",         tone: "bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-300", order: 8 },
  offer:               { label: "Offer",                tone: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300", order: 9 },
  hired:               { label: "Hired",                tone: "bg-emerald-600/15 text-emerald-700 dark:text-emerald-300", order: 10 },
  rejected:            { label: "Rejected",             tone: "bg-destructive/10 text-destructive",                  order: 11 },
  withdrawn:           { label: "Withdrawn",            tone: "bg-muted text-muted-foreground",                      order: 12 },
};

export const PIPELINE_STAGES: SubmissionStatus[] = [
  "submitted", "viewed", "screening", "interview_requested", "interview_confirmed", "final_review", "offer", "hired",
];

export function SubmissionStatusBadge({ status }: { status: SubmissionStatus }) {
  const meta = SUBMISSION_STATUS_META[status];
  return (
    <Badge className={`${meta.tone} border-transparent font-medium`} variant="outline">
      {meta.label}
    </Badge>
  );
}
