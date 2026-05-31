
-- Phase 2.1: Additive schema for Enterprise AI Validation Engine
-- Safe / additive only. No drops. No data migration.

-- 1. Structured JD/profile JSONB columns
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS structured_jd JSONB,
  ADD COLUMN IF NOT EXISTS structured_jd_version TEXT,
  ADD COLUMN IF NOT EXISTS structured_jd_at TIMESTAMPTZ;

ALTER TABLE public.candidates
  ADD COLUMN IF NOT EXISTS structured_profile JSONB,
  ADD COLUMN IF NOT EXISTS structured_profile_version TEXT,
  ADD COLUMN IF NOT EXISTS structured_profile_at TIMESTAMPTZ;

-- 2. Extend ai_candidate_validations with unified-score fields
ALTER TABLE public.ai_candidate_validations
  ADD COLUMN IF NOT EXISTS mandatory_skills_matched JSONB,
  ADD COLUMN IF NOT EXISTS preferred_skills_matched JSONB,
  ADD COLUMN IF NOT EXISTS missing_requirements JSONB,
  ADD COLUMN IF NOT EXISTS weights_profile_id UUID,
  ADD COLUMN IF NOT EXISTS final_score INT,
  ADD COLUMN IF NOT EXISTS prefilter_score INT,
  ADD COLUMN IF NOT EXISTS recommendation_tier TEXT,
  ADD COLUMN IF NOT EXISTS explanation TEXT;

-- 3. Extend rediscovered_matches with final score / tier link
ALTER TABLE public.rediscovered_matches
  ADD COLUMN IF NOT EXISTS final_score INT,
  ADD COLUMN IF NOT EXISTS recommendation_tier TEXT,
  ADD COLUMN IF NOT EXISTS ai_validation_id UUID;

-- 4. Scoring weights profiles (admin-tunable, tenant-scoped)
CREATE TABLE IF NOT EXISTS public.scoring_weights_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  mandatory_skills INT NOT NULL DEFAULT 35,
  industry INT NOT NULL DEFAULT 20,
  domain INT NOT NULL DEFAULT 15,
  title INT NOT NULL DEFAULT 10,
  experience INT NOT NULL DEFAULT 10,
  location INT NOT NULL DEFAULT 5,
  education INT NOT NULL DEFAULT 5,
  tier_highly_recommended INT NOT NULL DEFAULT 85,
  tier_recommended INT NOT NULL DEFAULT 70,
  tier_consider INT NOT NULL DEFAULT 55,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT scoring_weights_sum_100 CHECK (
    mandatory_skills + industry + domain + title + experience + location + education = 100
  )
);

CREATE INDEX IF NOT EXISTS idx_scoring_weights_tenant ON public.scoring_weights_profiles(tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_scoring_weights_default_per_tenant
  ON public.scoring_weights_profiles(tenant_id) WHERE is_default;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.scoring_weights_profiles TO authenticated;
GRANT ALL ON public.scoring_weights_profiles TO service_role;

ALTER TABLE public.scoring_weights_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "scoring_weights_tenant_read"
  ON public.scoring_weights_profiles FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_super_admin(auth.uid()));

CREATE POLICY "scoring_weights_owner_manager_write"
  ON public.scoring_weights_profiles FOR INSERT TO authenticated
  WITH CHECK (
    public.is_owner_or_manager_in_tenant(auth.uid(), tenant_id)
    OR public.is_super_admin(auth.uid())
  );

CREATE POLICY "scoring_weights_owner_manager_update"
  ON public.scoring_weights_profiles FOR UPDATE TO authenticated
  USING (
    public.is_owner_or_manager_in_tenant(auth.uid(), tenant_id)
    OR public.is_super_admin(auth.uid())
  );

CREATE POLICY "scoring_weights_owner_delete"
  ON public.scoring_weights_profiles FOR DELETE TO authenticated
  USING (
    public.is_owner_in_tenant(auth.uid(), tenant_id)
    OR public.is_super_admin(auth.uid())
  );

CREATE TRIGGER scoring_weights_set_updated_at
  BEFORE UPDATE ON public.scoring_weights_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Validation queue for async fan-out (idempotent: only create if absent)
CREATE TABLE IF NOT EXISTS public.validation_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  job_id UUID NOT NULL,
  candidate_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  priority INT NOT NULL DEFAULT 100,
  attempts INT NOT NULL DEFAULT 0,
  last_error TEXT,
  enqueued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  processed_at TIMESTAMPTZ,
  CONSTRAINT validation_queue_status_chk
    CHECK (status IN ('pending','in_progress','done','failed','skipped'))
);

CREATE INDEX IF NOT EXISTS idx_validation_queue_pending
  ON public.validation_queue(status, priority, enqueued_at) WHERE status = 'pending';
CREATE UNIQUE INDEX IF NOT EXISTS uniq_validation_queue_open
  ON public.validation_queue(job_id, candidate_id) WHERE status IN ('pending','in_progress');

GRANT SELECT ON public.validation_queue TO authenticated;
GRANT ALL ON public.validation_queue TO service_role;

ALTER TABLE public.validation_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "validation_queue_tenant_read"
  ON public.validation_queue FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_super_admin(auth.uid()));
