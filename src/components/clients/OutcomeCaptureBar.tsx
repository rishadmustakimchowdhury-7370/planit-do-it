// Recruiter-only one-click outcome capture bar.
// Mounted on candidate workflow + submission workspace surfaces. The platform
// learns from each captured outcome (Placement Outcome Intelligence).

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Sparkles, ThumbsUp, ThumbsDown, Calendar, FileSignature, CheckCircle2, XCircle, UserMinus } from "lucide-react";
import {
  useOutcomes, useRecordOutcome, OUTCOME_LABEL, REASON_LABEL,
  type OutcomeType, type OutcomeReasonCategory,
} from "@/hooks/useOutcomeCapture";
import { formatDistanceToNow } from "date-fns";

interface Props {
  jobId: string;
  candidateId: string;
  clientOrgId?: string | null;
  aiValidationId?: string | null;
  submissionId?: string | null;
  compact?: boolean;
}

const QUICK: Array<{ type: OutcomeType; label: string; icon: any; tone: "success" | "warn" | "danger" | "neutral" }> = [
  { type: "interview_scheduled",  label: "Interview",       icon: Calendar,       tone: "success" },
  { type: "offer_extended",       label: "Offer Extended",  icon: FileSignature,  tone: "success" },
  { type: "placement_succeeded",  label: "Hired",           icon: CheckCircle2,   tone: "success" },
  { type: "shortlist_rejected",   label: "Rejected",        icon: XCircle,        tone: "danger"  },
  { type: "candidate_withdrew",   label: "Withdrew",        icon: UserMinus,      tone: "neutral" },
];

const TONE: Record<string, string> = {
  success: "border-emerald-500/30 hover:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  warn:    "border-amber-500/30 hover:bg-amber-500/10 text-amber-700 dark:text-amber-300",
  danger:  "border-rose-500/30 hover:bg-rose-500/10 text-rose-700 dark:text-rose-300",
  neutral: "border-muted hover:bg-muted/40 text-muted-foreground",
};

export function OutcomeCaptureBar({ jobId, candidateId, clientOrgId, aiValidationId, submissionId, compact }: Props) {
  const { data: outcomes } = useOutcomes(jobId, candidateId);
  const record = useRecordOutcome();
  const [pending, setPending] = useState<OutcomeType | null>(null);
  const [reason, setReason] = useState("");
  const [category, setCategory] = useState<OutcomeReasonCategory | "">("");

  const latest = outcomes?.[0];

  const submit = async () => {
    if (!pending) return;
    await record.mutateAsync({
      jobId, candidateId,
      outcomeType: pending,
      reason: reason || null,
      reasonCategory: (category || null) as any,
      clientOrgId, aiValidationId, submissionId,
    });
    setPending(null); setReason(""); setCategory("");
  };

  return (
    <div className={compact ? "" : "rounded-lg border bg-muted/20 p-3"}>
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5" /> Outcome
        </div>
        {latest && (
          <span className="text-[11px] text-muted-foreground">
            Last: <strong className="text-foreground">{OUTCOME_LABEL[latest.outcome_type]}</strong> · {formatDistanceToNow(new Date(latest.created_at), { addSuffix: true })}
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {QUICK.map((q) => (
          <Button
            key={q.type}
            size="sm" variant="outline"
            className={`h-8 gap-1.5 ${TONE[q.tone]}`}
            onClick={() => setPending(q.type)}
          >
            <q.icon className="h-3.5 w-3.5" /> {q.label}
          </Button>
        ))}
      </div>

      <Dialog open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Record outcome: {pending ? OUTCOME_LABEL[pending] : ""}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Reason category (helps AI learn)</Label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as any)}
                className="w-full h-9 rounded-md border bg-background px-2 text-sm"
              >
                <option value="">(optional)</option>
                {Object.entries(REASON_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Notes (recruiter-only)</Label>
              <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)}
                placeholder="What drove this outcome? (used only to improve future recommendations)" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPending(null)}>Cancel</Button>
            <Button onClick={submit} disabled={record.isPending}>
              {record.isPending ? "Saving…" : "Save outcome"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
