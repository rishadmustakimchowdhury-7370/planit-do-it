
CREATE TABLE public.client_submission_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  job_id uuid NOT NULL,
  candidate_id uuid NOT NULL,
  recruiter_id uuid,
  version int NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'draft',
  report_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  model text,
  generated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_csr_job_candidate ON public.client_submission_reports(tenant_id, job_id, candidate_id, version DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_submission_reports TO authenticated;
GRANT ALL ON public.client_submission_reports TO service_role;

ALTER TABLE public.client_submission_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant members can view reports"
  ON public.client_submission_reports FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "tenant members can insert reports"
  ON public.client_submission_reports FOR INSERT TO authenticated
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "tenant members can update reports"
  ON public.client_submission_reports FOR UPDATE TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "tenant members can delete reports"
  ON public.client_submission_reports FOR DELETE TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

CREATE TRIGGER trg_csr_updated_at
  BEFORE UPDATE ON public.client_submission_reports
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
