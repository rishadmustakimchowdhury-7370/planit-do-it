
ALTER TABLE public.scoring_weights_profiles
  ADD COLUMN IF NOT EXISTS role_similarity integer NOT NULL DEFAULT 35,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_scoring_weights_profiles_tenant_active
  ON public.scoring_weights_profiles (tenant_id) WHERE is_active = true;
