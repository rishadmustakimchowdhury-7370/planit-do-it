
CREATE TABLE public.client_submission_pack_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  report_id uuid NOT NULL REFERENCES public.client_submission_reports(id) ON DELETE CASCADE,
  job_id uuid NOT NULL,
  candidate_id uuid NOT NULL,
  recruiter_id uuid,
  pack_option text NOT NULL CHECK (pack_option IN ('A','B','C')),
  storage_path text NOT NULL,
  file_name text NOT NULL,
  file_size integer,
  status text NOT NULL DEFAULT 'ready',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_cspf_lookup ON public.client_submission_pack_files(tenant_id, job_id, candidate_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_submission_pack_files TO authenticated;
GRANT ALL ON public.client_submission_pack_files TO service_role;

ALTER TABLE public.client_submission_pack_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant members can view pack files"
  ON public.client_submission_pack_files FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "tenant members can insert pack files"
  ON public.client_submission_pack_files FOR INSERT TO authenticated
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "tenant members can delete pack files"
  ON public.client_submission_pack_files FOR DELETE TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

CREATE TRIGGER trg_cspf_updated_at
  BEFORE UPDATE ON public.client_submission_pack_files
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
