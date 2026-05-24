
ALTER TABLE public.rediscovered_matches
  ADD COLUMN IF NOT EXISTS sub_scores jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS model_version text NOT NULL DEFAULT 'hybrid_v1';

CREATE INDEX IF NOT EXISTS idx_rediscovered_matches_job_score
  ON public.rediscovered_matches (job_id, match_score DESC);
