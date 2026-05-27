// Outcome capture hooks — records placement_outcomes events from recruiter UI.
// Each capture is tenant-scoped via RLS. Capture is one-click + reason; the
// modal is opened by the UI component that uses this hook.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

export type OutcomeType =
  | "shortlist_accepted" | "shortlist_rejected"
  | "interview_scheduled" | "interview_rejected"
  | "offer_extended" | "offer_accepted" | "offer_rejected"
  | "placement_succeeded" | "placement_failed"
  | "candidate_withdrew";

export type OutcomeReasonCategory =
  | "compensation" | "culture_fit" | "experience_gap" | "tenure"
  | "ecosystem_mismatch" | "overqualified" | "timing" | "client_silence" | "other";

export interface OutcomeRow {
  id: string;
  outcome_type: OutcomeType;
  outcome_reason: string | null;
  outcome_reason_category: OutcomeReasonCategory | null;
  source: string;
  created_at: string;
  recorded_by: string | null;
}

export const OUTCOME_LABEL: Record<OutcomeType, string> = {
  shortlist_accepted: "Shortlist Accepted",
  shortlist_rejected: "Shortlist Rejected",
  interview_scheduled: "Interview Scheduled",
  interview_rejected: "Interview Rejected",
  offer_extended: "Offer Extended",
  offer_accepted: "Offer Accepted",
  offer_rejected: "Offer Rejected",
  placement_succeeded: "Placement Succeeded",
  placement_failed: "Placement Failed",
  candidate_withdrew: "Candidate Withdrew",
};

export const REASON_LABEL: Record<OutcomeReasonCategory, string> = {
  compensation: "Compensation",
  culture_fit: "Culture fit",
  experience_gap: "Experience gap",
  tenure: "Tenure pattern",
  ecosystem_mismatch: "Ecosystem mismatch",
  overqualified: "Overqualified",
  timing: "Timing",
  client_silence: "Client silence",
  other: "Other",
};

export function useOutcomes(jobId?: string | null, candidateId?: string | null) {
  return useQuery({
    queryKey: ["placement-outcomes", jobId, candidateId],
    enabled: !!jobId && !!candidateId,
    queryFn: async () => {
      const { data } = await supabase
        .from("placement_outcomes")
        .select("id, outcome_type, outcome_reason, outcome_reason_category, source, created_at, recorded_by")
        .eq("job_id", jobId!).eq("candidate_id", candidateId!)
        .order("created_at", { ascending: false })
        .limit(50);
      return (data ?? []) as OutcomeRow[];
    },
  });
}

interface RecordArgs {
  jobId: string;
  candidateId: string;
  outcomeType: OutcomeType;
  reason?: string | null;
  reasonCategory?: OutcomeReasonCategory | null;
  clientOrgId?: string | null;
  aiValidationId?: string | null;
  submissionId?: string | null;
  source?: "manual" | "stage_change" | "submission_event" | "client_portal" | "recruiter_override";
}

export function useRecordOutcome() {
  const { tenantId } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: RecordArgs) => {
      if (!tenantId) throw new Error("No tenant context");
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("placement_outcomes").insert({
        tenant_id: tenantId,
        job_id: args.jobId,
        candidate_id: args.candidateId,
        client_org_id: args.clientOrgId ?? null,
        ai_validation_id: args.aiValidationId ?? null,
        submission_id: args.submissionId ?? null,
        outcome_type: args.outcomeType,
        outcome_reason: args.reason ?? null,
        outcome_reason_category: args.reasonCategory ?? null,
        source: args.source ?? "manual",
        recorded_by: u.user?.id ?? null,
      });
      if (error) throw error;

      // Stamp submission outcome filter columns when relevant
      if (args.submissionId) {
        await supabase
          .from("candidate_submissions")
          .update({ outcome_status: args.outcomeType, outcome_recorded_at: new Date().toISOString() })
          .eq("id", args.submissionId);
      }
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["placement-outcomes", vars.jobId, vars.candidateId] });
      toast.success("Outcome recorded — learning loop updated.");
    },
    onError: (e: any) => toast.error(e?.message ?? "Couldn't record outcome"),
  });
}

export function useRefreshOutcomeMemory() {
  const { tenantId } = useAuth();
  return useMutation({
    mutationFn: async () => {
      if (!tenantId) throw new Error("No tenant context");
      const { data, error } = await supabase.functions.invoke("refresh-outcome-memory", {
        body: { tenant_id: tenantId },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data as { signals_written: number; outcomes_processed: number; refreshed_at: string };
    },
    onSuccess: (r) => toast.success(`Intelligence refreshed — ${r.signals_written} signals from ${r.outcomes_processed} outcomes.`),
    onError: (e: any) => toast.error(e?.message ?? "Failed to refresh intelligence"),
  });
}
