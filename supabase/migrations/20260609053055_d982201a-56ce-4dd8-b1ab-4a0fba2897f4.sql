CREATE TABLE public.prepare_for_client_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  candidate_id uuid NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  recruiter_id uuid NOT NULL,
  text_notes text DEFAULT '' NOT NULL,
  structured_notes jsonb DEFAULT '{}'::jsonb NOT NULL,
  voice_transcripts jsonb DEFAULT '[]'::jsonb NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE (tenant_id, job_id, candidate_id, recruiter_id)
);

CREATE INDEX idx_pfc_assess_job_candidate ON public.prepare_for_client_assessments(job_id, candidate_id);
CREATE INDEX idx_pfc_assess_recruiter ON public.prepare_for_client_assessments(recruiter_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.prepare_for_client_assessments TO authenticated;
GRANT ALL ON public.prepare_for_client_assessments TO service_role;

ALTER TABLE public.prepare_for_client_assessments ENABLE ROW LEVEL SECURITY;

CREATE POLICY pfc_assess_select ON public.prepare_for_client_assessments
FOR SELECT TO authenticated
USING (auth.uid() IS NOT NULL AND (public.is_super_admin(auth.uid()) OR public.user_belongs_to_tenant(auth.uid(), tenant_id)));

CREATE POLICY pfc_assess_insert ON public.prepare_for_client_assessments
FOR INSERT TO authenticated
WITH CHECK (auth.uid() IS NOT NULL AND public.user_belongs_to_tenant(auth.uid(), tenant_id) AND recruiter_id = auth.uid());

CREATE POLICY pfc_assess_update ON public.prepare_for_client_assessments
FOR UPDATE TO authenticated
USING (auth.uid() IS NOT NULL AND public.user_belongs_to_tenant(auth.uid(), tenant_id) AND (recruiter_id = auth.uid() OR public.is_owner_or_manager_in_tenant(auth.uid(), tenant_id)));

CREATE POLICY pfc_assess_delete ON public.prepare_for_client_assessments
FOR DELETE TO authenticated
USING (auth.uid() IS NOT NULL AND (recruiter_id = auth.uid() OR public.is_owner_or_manager_in_tenant(auth.uid(), tenant_id)));

CREATE TRIGGER pfc_assess_set_updated_at
BEFORE UPDATE ON public.prepare_for_client_assessments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();