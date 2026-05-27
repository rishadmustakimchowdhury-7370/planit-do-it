
-- Phase 1: Recruiter Copilot + Placement Intelligence schema

-- 1) Extend ai_candidate_validations with the copilot block
ALTER TABLE public.ai_candidate_validations
  ADD COLUMN IF NOT EXISTS recruiter_copilot jsonb,
  ADD COLUMN IF NOT EXISTS recruiter_override jsonb,
  ADD COLUMN IF NOT EXISTS override_divergence boolean DEFAULT false;

-- 2) Recruiter feedback (endorse / override / confidence / positioning notes)
CREATE TABLE IF NOT EXISTS public.recruiter_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  recruiter_id uuid NOT NULL,
  job_id uuid NOT NULL,
  candidate_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('endorse','override','confidence','positioning_note','strategy_note')),
  ai_classification text,
  recruiter_classification text,
  confidence smallint CHECK (confidence BETWEEN 0 AND 100),
  note text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.recruiter_feedback TO authenticated;
GRANT ALL ON public.recruiter_feedback TO service_role;

ALTER TABLE public.recruiter_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Recruiters view tenant feedback"
  ON public.recruiter_feedback FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL AND public.user_belongs_to_tenant(auth.uid(), tenant_id));

CREATE POLICY "Recruiters insert own feedback"
  ON public.recruiter_feedback FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL AND recruiter_id = auth.uid() AND public.user_belongs_to_tenant(auth.uid(), tenant_id));

CREATE POLICY "Recruiters update own feedback"
  ON public.recruiter_feedback FOR UPDATE TO authenticated
  USING (auth.uid() = recruiter_id);

CREATE POLICY "Owners/Managers delete tenant feedback"
  ON public.recruiter_feedback FOR DELETE TO authenticated
  USING (public.is_owner_or_manager_in_tenant(auth.uid(), tenant_id));

CREATE INDEX IF NOT EXISTS idx_recruiter_feedback_job_cand ON public.recruiter_feedback(job_id, candidate_id);
CREATE INDEX IF NOT EXISTS idx_recruiter_feedback_recruiter ON public.recruiter_feedback(recruiter_id);

-- 3) Client feedback log (post-submission outcomes)
CREATE TABLE IF NOT EXISTS public.client_feedback_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  client_org_id uuid,
  job_id uuid NOT NULL,
  candidate_id uuid NOT NULL,
  submission_id uuid,
  outcome text CHECK (outcome IN ('approved','rejected','interview_requested','hired','withdrawn','no_response')),
  reason text,
  recorded_by uuid NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_feedback_log TO authenticated;
GRANT ALL ON public.client_feedback_log TO service_role;

ALTER TABLE public.client_feedback_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members read client feedback"
  ON public.client_feedback_log FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL AND public.user_belongs_to_tenant(auth.uid(), tenant_id));

CREATE POLICY "Tenant members write client feedback"
  ON public.client_feedback_log FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL AND recorded_by = auth.uid() AND public.user_belongs_to_tenant(auth.uid(), tenant_id));

CREATE POLICY "Owners/Managers update client feedback"
  ON public.client_feedback_log FOR UPDATE TO authenticated
  USING (public.is_owner_or_manager_in_tenant(auth.uid(), tenant_id));

CREATE INDEX IF NOT EXISTS idx_client_feedback_log_job ON public.client_feedback_log(job_id);
CREATE INDEX IF NOT EXISTS idx_client_feedback_log_client_org ON public.client_feedback_log(client_org_id);

-- 4) Recruiter memory signals (both per-recruiter and tenant-rollup)
CREATE TABLE IF NOT EXISTS public.recruiter_memory_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  scope text NOT NULL CHECK (scope IN ('recruiter','tenant','client')),
  recruiter_id uuid,         -- null when scope = tenant
  client_org_id uuid,        -- set when scope = client
  signal_type text NOT NULL, -- e.g. 'prefers_adjacent', 'rejects_short_tenure', 'client_prefers_big4'
  signal_value text NOT NULL,
  weight numeric NOT NULL DEFAULT 1.0,
  evidence_count int NOT NULL DEFAULT 1,
  last_observed_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_recruiter_memory_signal
  ON public.recruiter_memory_signals(tenant_id, scope, COALESCE(recruiter_id, '00000000-0000-0000-0000-000000000000'::uuid), COALESCE(client_org_id, '00000000-0000-0000-0000-000000000000'::uuid), signal_type, signal_value);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.recruiter_memory_signals TO authenticated;
GRANT ALL ON public.recruiter_memory_signals TO service_role;

ALTER TABLE public.recruiter_memory_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members read memory"
  ON public.recruiter_memory_signals FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL AND public.user_belongs_to_tenant(auth.uid(), tenant_id));

CREATE POLICY "Tenant members write own-or-tenant memory"
  ON public.recruiter_memory_signals FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND public.user_belongs_to_tenant(auth.uid(), tenant_id)
    AND (scope <> 'recruiter' OR recruiter_id = auth.uid())
  );

CREATE POLICY "Tenant members update memory"
  ON public.recruiter_memory_signals FOR UPDATE TO authenticated
  USING (
    public.user_belongs_to_tenant(auth.uid(), tenant_id)
    AND (scope <> 'recruiter' OR recruiter_id = auth.uid() OR public.is_owner_or_manager_in_tenant(auth.uid(), tenant_id))
  );

CREATE POLICY "Owners/Managers delete memory"
  ON public.recruiter_memory_signals FOR DELETE TO authenticated
  USING (public.is_owner_or_manager_in_tenant(auth.uid(), tenant_id));

CREATE TRIGGER trg_recruiter_memory_signals_touch
  BEFORE UPDATE ON public.recruiter_memory_signals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
