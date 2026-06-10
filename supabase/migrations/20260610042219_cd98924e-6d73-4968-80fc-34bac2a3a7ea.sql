
ALTER TABLE public.candidate_submissions
  ADD CONSTRAINT candidate_submissions_candidate_id_fkey
    FOREIGN KEY (candidate_id) REFERENCES public.candidates(id) ON DELETE CASCADE,
  ADD CONSTRAINT candidate_submissions_job_id_fkey
    FOREIGN KEY (job_id) REFERENCES public.jobs(id) ON DELETE CASCADE,
  ADD CONSTRAINT candidate_submissions_client_org_id_fkey
    FOREIGN KEY (client_org_id) REFERENCES public.client_organizations(id) ON DELETE CASCADE,
  ADD CONSTRAINT candidate_submissions_tenant_id_fkey
    FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
