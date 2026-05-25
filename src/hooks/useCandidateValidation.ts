import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export type AICandidateValidation = {
  id: string;
  tenant_id: string;
  job_id: string;
  candidate_id: string;
  fit_score: number | null;
  recommendation: "strongly_recommended" | "needs_review" | "not_recommended" | null;
  summary: string | null;
  strengths: string[];
  weaknesses: string[];
  risks: string[];
  model: string | null;
  generated_by: string | null;
  created_at: string;
  updated_at: string;
};

export function useLatestValidation(jobId?: string | null, candidateId?: string | null) {
  return useQuery({
    queryKey: ["ai-validation", jobId, candidateId],
    enabled: !!jobId && !!candidateId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_candidate_validations")
        .select("*")
        .eq("job_id", jobId!)
        .eq("candidate_id", candidateId!)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as AICandidateValidation) ?? null;
    },
  });
}

export function useValidateCandidateFit() {
  const [loading, setLoading] = useState(false);
  const qc = useQueryClient();

  async function run(jobId: string, candidateId: string, opts?: { force?: boolean }) {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("validate-candidate-fit", {
        body: { job_id: jobId, candidate_id: candidateId, force: !!opts?.force },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      await qc.invalidateQueries({ queryKey: ["ai-validation", jobId, candidateId] });
      return (data as any).validation as AICandidateValidation;
    } catch (e: any) {
      toast.error(e?.message ?? "Validation failed");
      throw e;
    } finally {
      setLoading(false);
    }
  }

  return { run, loading };
}
