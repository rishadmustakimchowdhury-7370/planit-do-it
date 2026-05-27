import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export type AICandidateValidation = {
  id: string;
  tenant_id: string;
  job_id: string;
  candidate_id: string;
  fit_score: number | null;
  recommendation: string | null;
  match_classification: string | null;
  interview_probability: number | null;
  ecosystem_signals: Array<{ company: string; ecosystem: string; relevance: string }> | null;
  validation_stale: boolean | null;
  engine_version: string | null;
  jd_signature: string | null;
  summary: string | null;
  strengths: string[];
  weaknesses: string[];
  risks: string[];
  model: string | null;
  generated_by: string | null;
  created_at: string;
  updated_at: string;
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

  async function run(jobId: string, candidateId: string, opts?: { force?: boolean; silent?: boolean }) {
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
      if (!opts?.silent) toast.error(e?.message ?? "Validation failed");
      throw e;
    } finally {
      setLoading(false);
    }
  }

  return { run, loading };
}

// Auto-revalidate when the JD changes (validation_stale = true). Runs once per
// stale row per session and never blocks the UI. Returns {staleInProgress}.
export function useAutoRevalidate(validation: AICandidateValidation | null | undefined) {
  const [staleInProgress, setStaleInProgress] = useState(false);
  const fired = useRef<Set<string>>(new Set());
  const { run } = useValidateCandidateFit();

  useEffect(() => {
    if (!validation?.validation_stale) return;
    const key = `${validation.job_id}:${validation.candidate_id}`;
    if (fired.current.has(key)) return;
    fired.current.add(key);
    setStaleInProgress(true);
    run(validation.job_id, validation.candidate_id, { force: true, silent: true })
      .catch(() => { /* keep silent; user can click Re-run */ })
      .finally(() => setStaleInProgress(false));
  }, [validation?.validation_stale, validation?.job_id, validation?.candidate_id, run]);

  return { staleInProgress };
}
