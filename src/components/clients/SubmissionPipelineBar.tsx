import { PIPELINE_STAGES, SUBMISSION_STATUS_META, type SubmissionStatus } from "./SubmissionStatusBadge";
import { Check } from "lucide-react";

export function SubmissionPipelineBar({ status, className = "" }: { status: SubmissionStatus; className?: string }) {
  const currentOrder = SUBMISSION_STATUS_META[status].order;
  const isTerminal = status === "rejected" || status === "withdrawn";

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {PIPELINE_STAGES.map((s, i) => {
        const meta = SUBMISSION_STATUS_META[s];
        const reached = !isTerminal && meta.order <= currentOrder;
        const active = !isTerminal && s === status;
        return (
          <div key={s} className="flex items-center gap-1 flex-1 min-w-0">
            <div className={`h-2 flex-1 rounded-full transition-colors ${
              reached ? "bg-primary" : "bg-muted"
            } ${active ? "ring-2 ring-primary/30" : ""}`} title={meta.label} />
            {i < PIPELINE_STAGES.length - 1 && <div className="w-1" />}
          </div>
        );
      })}
      {isTerminal && (
        <span className="text-xs text-destructive font-medium ml-2">{SUBMISSION_STATUS_META[status].label}</span>
      )}
    </div>
  );
}
