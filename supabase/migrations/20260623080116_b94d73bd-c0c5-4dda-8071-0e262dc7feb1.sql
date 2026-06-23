
CREATE TABLE IF NOT EXISTS public.candidate_cv_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL,
  version integer NOT NULL,
  source text NOT NULL DEFAULT 'uploaded',
  label text,
  file_path text,
  file_name text,
  mime_type text,
  file_size integer,
  ai_content text,
  is_active boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ccv_candidate ON public.candidate_cv_versions(candidate_id, version DESC);
CREATE INDEX IF NOT EXISTS idx_ccv_tenant ON public.candidate_cv_versions(tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_ccv_candidate_version ON public.candidate_cv_versions(candidate_id, version);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.candidate_cv_versions TO authenticated;
GRANT ALL ON public.candidate_cv_versions TO service_role;

ALTER TABLE public.candidate_cv_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ccv_tenant_select" ON public.candidate_cv_versions FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));
CREATE POLICY "ccv_tenant_insert" ON public.candidate_cv_versions FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));
CREATE POLICY "ccv_tenant_update" ON public.candidate_cv_versions FOR UPDATE TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()))
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));
CREATE POLICY "ccv_tenant_delete" ON public.candidate_cv_versions FOR DELETE TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE TRIGGER trg_ccv_updated_at
  BEFORE UPDATE ON public.candidate_cv_versions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
