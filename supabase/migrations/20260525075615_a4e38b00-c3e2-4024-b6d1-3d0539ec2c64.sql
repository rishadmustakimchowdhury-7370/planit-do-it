
DO $$ BEGIN
  CREATE TYPE public.submission_status AS ENUM (
    'draft','ai_validated','prepared','submitted','viewed','screening',
    'interview_requested','interview_confirmed','final_review','offer',
    'hired','rejected','withdrawn'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.ai_candidate_validations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  job_id uuid NOT NULL,
  candidate_id uuid NOT NULL,
  fit_score integer CHECK (fit_score >= 0 AND fit_score <= 100),
  recommendation text CHECK (recommendation IN ('strongly_recommended','needs_review','not_recommended')),
  summary text,
  strengths jsonb NOT NULL DEFAULT '[]'::jsonb,
  weaknesses jsonb NOT NULL DEFAULT '[]'::jsonb,
  risks jsonb NOT NULL DEFAULT '[]'::jsonb,
  model text,
  generated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_aiv_job_cand ON public.ai_candidate_validations(job_id, candidate_id);
CREATE INDEX IF NOT EXISTS idx_aiv_tenant ON public.ai_candidate_validations(tenant_id);
ALTER TABLE public.ai_candidate_validations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "aiv_tenant_select" ON public.ai_candidate_validations FOR SELECT USING (
  auth.uid() IS NOT NULL AND (public.is_super_admin(auth.uid()) OR public.user_belongs_to_tenant(auth.uid(), tenant_id))
);
CREATE POLICY "aiv_tenant_insert" ON public.ai_candidate_validations FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL AND public.user_belongs_to_tenant(auth.uid(), tenant_id)
);
CREATE POLICY "aiv_tenant_update" ON public.ai_candidate_validations FOR UPDATE USING (
  auth.uid() IS NOT NULL AND public.user_belongs_to_tenant(auth.uid(), tenant_id)
);
CREATE TRIGGER trg_aiv_updated_at BEFORE UPDATE ON public.ai_candidate_validations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.candidate_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  job_id uuid NOT NULL,
  candidate_id uuid NOT NULL,
  job_candidate_id uuid,
  client_org_id uuid NOT NULL,
  status public.submission_status NOT NULL DEFAULT 'draft',
  submission_message text,
  ai_validation_id uuid REFERENCES public.ai_candidate_validations(id) ON DELETE SET NULL,
  branded_cv_url text,
  original_cv_url text,
  pack_pdf_url text,
  submitted_by uuid,
  submitted_at timestamptz,
  viewed_at timestamptz,
  last_activity_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cs_tenant ON public.candidate_submissions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cs_job ON public.candidate_submissions(job_id);
CREATE INDEX IF NOT EXISTS idx_cs_client_org ON public.candidate_submissions(client_org_id);
CREATE INDEX IF NOT EXISTS idx_cs_status ON public.candidate_submissions(status);
ALTER TABLE public.candidate_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cs_agency_select" ON public.candidate_submissions FOR SELECT USING (
  auth.uid() IS NOT NULL AND (public.is_super_admin(auth.uid()) OR public.user_belongs_to_tenant(auth.uid(), tenant_id))
);
CREATE POLICY "cs_agency_insert" ON public.candidate_submissions FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL AND public.user_belongs_to_tenant(auth.uid(), tenant_id)
);
CREATE POLICY "cs_agency_update" ON public.candidate_submissions FOR UPDATE USING (
  auth.uid() IS NOT NULL AND public.user_belongs_to_tenant(auth.uid(), tenant_id)
);
CREATE POLICY "cs_agency_delete" ON public.candidate_submissions FOR DELETE USING (
  auth.uid() IS NOT NULL AND public.is_owner_or_manager_in_tenant(auth.uid(), tenant_id)
);
CREATE POLICY "cs_client_select" ON public.candidate_submissions FOR SELECT USING (
  auth.uid() IS NOT NULL
  AND public.is_client_user(auth.uid())
  AND client_org_id = public.client_org_for_user(auth.uid())
  AND status <> 'draft'
);
CREATE TRIGGER trg_cs_updated_at BEFORE UPDATE ON public.candidate_submissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.submission_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES public.candidate_submissions(id) ON DELETE CASCADE,
  client_user_id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  client_org_id uuid NOT NULL,
  viewed_at timestamptz,
  decision text CHECK (decision IN ('pending','approved','rejected','requested_interview','on_hold')) DEFAULT 'pending',
  decision_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (submission_id, client_user_id)
);
CREATE INDEX IF NOT EXISTS idx_sr_submission ON public.submission_recipients(submission_id);
CREATE INDEX IF NOT EXISTS idx_sr_user ON public.submission_recipients(client_user_id);
ALTER TABLE public.submission_recipients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sr_agency_all" ON public.submission_recipients FOR ALL USING (
  auth.uid() IS NOT NULL AND (public.is_super_admin(auth.uid()) OR public.user_belongs_to_tenant(auth.uid(), tenant_id))
) WITH CHECK (
  auth.uid() IS NOT NULL AND (public.is_super_admin(auth.uid()) OR public.user_belongs_to_tenant(auth.uid(), tenant_id))
);
CREATE POLICY "sr_client_select_own" ON public.submission_recipients FOR SELECT USING (
  auth.uid() IS NOT NULL AND client_user_id = auth.uid()
);
CREATE POLICY "sr_client_update_own" ON public.submission_recipients FOR UPDATE USING (
  auth.uid() IS NOT NULL AND client_user_id = auth.uid()
) WITH CHECK (
  auth.uid() IS NOT NULL AND client_user_id = auth.uid()
);

CREATE TABLE IF NOT EXISTS public.submission_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES public.candidate_submissions(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL,
  client_org_id uuid NOT NULL,
  actor_user_id uuid,
  actor_type text NOT NULL CHECK (actor_type IN ('internal','client','system')),
  event_type text NOT NULL,
  message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sa_submission ON public.submission_activity(submission_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sa_tenant ON public.submission_activity(tenant_id);
ALTER TABLE public.submission_activity ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sa_agency_select" ON public.submission_activity FOR SELECT USING (
  auth.uid() IS NOT NULL AND (public.is_super_admin(auth.uid()) OR public.user_belongs_to_tenant(auth.uid(), tenant_id))
);
CREATE POLICY "sa_agency_insert" ON public.submission_activity FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL AND public.user_belongs_to_tenant(auth.uid(), tenant_id)
);
CREATE POLICY "sa_client_select" ON public.submission_activity FOR SELECT USING (
  auth.uid() IS NOT NULL
  AND public.is_client_user(auth.uid())
  AND client_org_id = public.client_org_for_user(auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.submission_recipients sr
    WHERE sr.submission_id = submission_activity.submission_id
      AND sr.client_user_id = auth.uid()
  )
);
CREATE POLICY "sa_client_insert" ON public.submission_activity FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL
  AND public.is_client_user(auth.uid())
  AND client_org_id = public.client_org_for_user(auth.uid())
  AND actor_user_id = auth.uid()
  AND actor_type = 'client'
);

CREATE TABLE IF NOT EXISTS public.client_user_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_user_id uuid NOT NULL UNIQUE,
  client_org_id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  view_pipeline boolean NOT NULL DEFAULT true,
  request_interviews boolean NOT NULL DEFAULT true,
  leave_feedback boolean NOT NULL DEFAULT true,
  send_messages boolean NOT NULL DEFAULT true,
  approve_reject boolean NOT NULL DEFAULT false,
  view_internal_notes boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cup_org ON public.client_user_permissions(client_org_id);
ALTER TABLE public.client_user_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cup_agency_all" ON public.client_user_permissions FOR ALL USING (
  auth.uid() IS NOT NULL AND (public.is_super_admin(auth.uid()) OR public.is_owner_or_manager_in_tenant(auth.uid(), tenant_id))
) WITH CHECK (
  auth.uid() IS NOT NULL AND (public.is_super_admin(auth.uid()) OR public.is_owner_or_manager_in_tenant(auth.uid(), tenant_id))
);
CREATE POLICY "cup_client_select_own" ON public.client_user_permissions FOR SELECT USING (
  auth.uid() IS NOT NULL AND client_user_id = auth.uid()
);
CREATE TRIGGER trg_cup_updated_at BEFORE UPDATE ON public.client_user_permissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Backfill from existing candidate_client_shares
INSERT INTO public.candidate_submissions (
  id, tenant_id, job_id, candidate_id, job_candidate_id, client_org_id,
  status, branded_cv_url, submission_message, submitted_at, last_activity_at, created_at, updated_at
)
SELECT
  ccs.id,
  ccs.tenant_id,
  jc.job_id,
  jc.candidate_id,
  ccs.job_candidate_id,
  ccs.client_org_id,
  CASE WHEN ccs.withdrawn_at IS NOT NULL THEN 'withdrawn'::public.submission_status
       ELSE 'submitted'::public.submission_status END,
  ccs.branded_cv_url,
  ccs.recruiter_summary,
  COALESCE(ccs.shared_at, now()),
  COALESCE(ccs.shared_at, now()),
  COALESCE(ccs.shared_at, now()),
  now()
FROM public.candidate_client_shares ccs
JOIN public.job_candidates jc ON jc.id = ccs.job_candidate_id
WHERE ccs.status = 'shared'
ON CONFLICT (id) DO NOTHING;
