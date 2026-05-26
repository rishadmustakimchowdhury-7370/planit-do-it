
ALTER TABLE public.candidate_submissions
  ADD COLUMN IF NOT EXISTS recruiter_notes text[] DEFAULT '{}'::text[];

ALTER TABLE public.ai_candidate_validations
  ADD COLUMN IF NOT EXISTS mandate_match jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS recruiter_review text;
