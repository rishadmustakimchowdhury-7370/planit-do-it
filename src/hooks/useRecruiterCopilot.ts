// Recruiter Copilot client hooks — Phase 5 (HITL + memory) + Phase 6 (comms).
// All copilot data is read from the same ai_candidate_validations row that the
// validation engine writes. Recruiter overrides + endorsements write to
// recruiter_feedback and recruiter_memory_signals.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type InterviewCategory =
  | "technical" | "leadership" | "operational_ownership"
  | "compliance" | "behavioral" | "risk" | "ecosystem";

export interface RecruiterCopilotData {
  interview_guide: Array<{ category: InterviewCategory; question: string; intent: string; targets_requirement: string | null }>;
  client_objections: Array<{ concern: string; requirement_at_risk: string | null; severity: "low"|"medium"|"high"; suggested_response: string }>;
  positioning_angles: Array<{ angle: string; evidence: string; audience: "client"|"internal" }>;
  submission_strategy: {
    recommendation: "submit_now"|"screen_further"|"position_as_adjacent"|"emphasize_leadership"|"highlight_ecosystem"|"hold";
    rationale: string;
    talking_points: string[];
  };
  placement_probability: {
    shortlist_pct: number; interview_pct: number; placement_pct: number;
    client_acceptance_risk: "low"|"medium"|"high"; rationale: string;
  };
}

export const STRATEGY_LABEL: Record<RecruiterCopilotData["submission_strategy"]["recommendation"], string> = {
  submit_now: "Submit Now",
  screen_further: "Screen Further",
  position_as_adjacent: "Position as Adjacent",
  emphasize_leadership: "Emphasize Leadership",
  highlight_ecosystem: "Highlight Ecosystem",
  hold: "Hold",
};

export const CATEGORY_LABEL: Record<InterviewCategory, string> = {
  technical: "Technical",
  leadership: "Leadership",
  operational_ownership: "Operational Ownership",
  compliance: "Compliance / Regulatory",
  behavioral: "Behavioral",
  risk: "Risk",
  ecosystem: "Ecosystem-Specific",
};

export function useRecruiterFeedback(jobId?: string | null, candidateId?: string | null) {
  return useQuery({
    queryKey: ["recruiter-feedback", jobId, candidateId],
    enabled: !!jobId && !!candidateId,
    queryFn: async () => {
      const { data } = await supabase
        .from("recruiter_feedback")
        .select("*")
        .eq("job_id", jobId!).eq("candidate_id", candidateId!)
        .order("created_at", { ascending: false })
        .limit(20);
      return (data ?? []) as any[];
    },
  });
}

interface RecordFeedbackArgs {
  tenantId: string;
  jobId: string;
  candidateId: string;
  action: "endorse" | "override" | "confidence" | "positioning_note" | "strategy_note";
  aiClassification?: string | null;
  recruiterClassification?: string | null;
  confidence?: number | null;
  note?: string | null;
}

export function useRecordRecruiterFeedback() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: RecordFeedbackArgs) => {
      const { data: u } = await supabase.auth.getUser();
      const recruiterId = u.user?.id;
      if (!recruiterId) throw new Error("Not signed in");

      const { error } = await supabase.from("recruiter_feedback").insert({
        tenant_id: args.tenantId,
        recruiter_id: recruiterId,
        job_id: args.jobId,
        candidate_id: args.candidateId,
        action: args.action,
        ai_classification: args.aiClassification ?? null,
        recruiter_classification: args.recruiterClassification ?? null,
        confidence: args.confidence ?? null,
        note: args.note ?? null,
      });
      if (error) throw error;

      // If override, persist recruiter decision onto the validation row so the
      // next re-validation can detect divergence and surface a banner.
      if (args.action === "override" && args.recruiterClassification) {
        await supabase
          .from("ai_candidate_validations")
          .update({
            recruiter_override: {
              classification: args.recruiterClassification,
              recruiter_id: recruiterId,
              note: args.note ?? null,
              at: new Date().toISOString(),
            },
            override_divergence: false,
          })
          .eq("job_id", args.jobId).eq("candidate_id", args.candidateId);
      }

      // Memory signal: recruiter-scoped pattern (e.g. recruiter overrides toward adjacent)
      if (args.action === "override" || args.action === "endorse") {
        await supabase.from("recruiter_memory_signals").insert({
          tenant_id: args.tenantId,
          scope: "recruiter",
          recruiter_id: recruiterId,
          signal_type: args.action === "override" ? "override_pattern" : "endorse_pattern",
          signal_value: `${args.aiClassification ?? "unknown"}→${args.recruiterClassification ?? args.aiClassification ?? "endorsed"}`,
          weight: 1,
        }).then(() => undefined).catch(() => undefined);
      }
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["recruiter-feedback", vars.jobId, vars.candidateId] });
      qc.invalidateQueries({ queryKey: ["ai-validation", vars.jobId, vars.candidateId] });
      toast.success("Recruiter feedback saved");
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to save feedback"),
  });
}

export type ClientCommType =
  | "submission_summary" | "positioning_note"
  | "interview_scheduling" | "follow_up" | "objection_response";

export function useGenerateClientComms() {
  return useMutation({
    mutationFn: async (args: { jobId: string; candidateId: string; type: ClientCommType; objection?: string; language?: string }) => {
      const { data, error } = await supabase.functions.invoke("generate-client-comms", {
        body: {
          job_id: args.jobId, candidate_id: args.candidateId,
          type: args.type, objection: args.objection, language: args.language,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data as { subject: string | null; body: string; type: ClientCommType };
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to generate message"),
  });
}
