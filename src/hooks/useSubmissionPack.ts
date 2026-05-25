import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function useGenerateSubmissionPack() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (submissionId: string) => {
      const { data, error } = await supabase.functions.invoke("generate-submission-pack", {
        body: { submission_id: submissionId },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data as { path: string; signed_url: string | null };
    },
    onSuccess: (_d, submissionId) => {
      qc.invalidateQueries({ queryKey: ["candidate-submission", submissionId] });
      qc.invalidateQueries({ queryKey: ["candidate-submissions"] });
      toast.success("Submission pack generated");
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to generate pack"),
  });
}

export async function getSubmissionPackUrl(path: string) {
  const { data, error } = await supabase.storage.from("submission-packs").createSignedUrl(path, 60 * 60);
  if (error) throw error;
  return data.signedUrl;
}

export function useCreateSubmission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      tenant_id: string;
      job_id: string;
      candidate_id: string;
      client_org_id: string;
      submission_message?: string;
      ai_validation_id?: string | null;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("candidate_submissions")
        .insert({
          ...input,
          status: "ai_validated",
          submitted_by: user?.id,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["candidate-submissions"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to create submission"),
  });
}
