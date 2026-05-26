
ALTER TABLE public.candidate_submissions
  ADD COLUMN IF NOT EXISTS recruiter_summary text,
  ADD COLUMN IF NOT EXISTS recruiter_strengths text[],
  ADD COLUMN IF NOT EXISTS recruiter_considerations text[],
  ADD COLUMN IF NOT EXISTS recruiter_recommendation text,
  ADD COLUMN IF NOT EXISTS pack_components jsonb NOT NULL DEFAULT '{"ai_report":true,"branded_cv":true,"original_cv":true}'::jsonb,
  ADD COLUMN IF NOT EXISTS pack_status text NOT NULL DEFAULT 'idle',
  ADD COLUMN IF NOT EXISTS pack_error text,
  ADD COLUMN IF NOT EXISTS draft_state jsonb,
  ADD COLUMN IF NOT EXISTS sent_at timestamptz;

ALTER TABLE public.submission_recipients
  ADD COLUMN IF NOT EXISTS downloaded_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_action_at timestamptz;

CREATE TABLE IF NOT EXISTS public.submission_pack_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES public.candidate_submissions(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL,
  version int NOT NULL,
  path text NOT NULL,
  components jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (submission_id, version)
);
CREATE INDEX IF NOT EXISTS idx_spv_submission ON public.submission_pack_versions(submission_id, version DESC);
ALTER TABLE public.submission_pack_versions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "spv_agency_all" ON public.submission_pack_versions;
CREATE POLICY "spv_agency_all" ON public.submission_pack_versions FOR ALL USING (
  auth.uid() IS NOT NULL AND (public.is_super_admin(auth.uid()) OR public.user_belongs_to_tenant(auth.uid(), tenant_id))
) WITH CHECK (
  auth.uid() IS NOT NULL AND public.user_belongs_to_tenant(auth.uid(), tenant_id)
);
DROP POLICY IF EXISTS "spv_client_select" ON public.submission_pack_versions;
CREATE POLICY "spv_client_select" ON public.submission_pack_versions FOR SELECT USING (
  auth.uid() IS NOT NULL AND public.is_client_user(auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.submission_recipients sr
    WHERE sr.submission_id = submission_pack_versions.submission_id
      AND sr.client_user_id = auth.uid()
  )
);
