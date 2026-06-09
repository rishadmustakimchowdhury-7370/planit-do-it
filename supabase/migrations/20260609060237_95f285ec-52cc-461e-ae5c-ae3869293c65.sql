ALTER TABLE public.client_emails
  ADD COLUMN IF NOT EXISTS job_id uuid REFERENCES public.jobs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS candidate_id uuid REFERENCES public.candidates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS submission_version integer,
  ADD COLUMN IF NOT EXISTS submission_pack_file_id uuid REFERENCES public.client_submission_pack_files(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS submission_report_id uuid REFERENCES public.client_submission_reports(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_client_emails_job_candidate
  ON public.client_emails(tenant_id, job_id, candidate_id);

CREATE INDEX IF NOT EXISTS idx_client_emails_client_created
  ON public.client_emails(tenant_id, client_id, created_at DESC);