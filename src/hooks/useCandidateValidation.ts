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
  // Centralized engine enrichment (joined from rediscovered_matches)
  sub_scores?: {
    role?: number; skills?: number; industry?: number; seniority?: number;
    experience?: number; location?: number; penalty?: number;
    job_family?: string | null; candidate_family?: string | null;
  } | null;
  confidence?: "low" | "medium" | "high" | null;
  scoring_version?: string | null;
};

export function useLatestValidation(jobId?: string | null, candidateId?: string | null) {
  return useQuery({
    queryKey: ["ai-validation", jobId, candidateId],
    enabled: !!jobId && !!candidateId,
    queryFn: async () => {
      const [{ data: validation, error }, { data: canonical }] = await Promise.all([
        supabase.from("ai_candidate_validations").select("*")
          .eq("job_id", jobId!).eq("candidate_id", candidateId!)
          .order("created_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("rediscovered_matches")
          .select("match_score, sub_scores, confidence, model_version")
          .eq("job_id", jobId!).eq("candidate_id", candidateId!).maybeSingle(),
      ]);
      if (error) throw error;
      if (!validation) return null;
      // Override fit_score with canonical (single source of truth) if present
      const merged: AICandidateValidation = {
        ...(validation as any),
        fit_score: canonical?.match_score ?? (validation as any).fit_score,
        sub_scores: (canonical?.sub_scores as any) ?? null,
        confidence: (canonical?.confidence as any) ?? null,
        scoring_version: canonical?.model_version ?? "hybrid_v1",
      };
      return merged;
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
