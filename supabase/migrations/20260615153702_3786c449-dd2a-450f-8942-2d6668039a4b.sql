ALTER TABLE public.apollo_integrations
  ADD COLUMN IF NOT EXISTS plan_tier text DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS capabilities jsonb DEFAULT '{}'::jsonb;