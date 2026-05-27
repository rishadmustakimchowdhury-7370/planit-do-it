
ALTER TABLE public.rediscovered_matches
  ADD COLUMN IF NOT EXISTS discovery_classification text,
  ADD COLUMN IF NOT EXISTS interview_probability integer,
  ADD COLUMN IF NOT EXISTS ecosystem_signals jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS why_ranked jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS functional_ownership jsonb DEFAULT '[]'::jsonb;
