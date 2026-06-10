ALTER TABLE public.candidate_submissions ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'email';
ALTER TYPE public.submission_status ADD VALUE IF NOT EXISTS 'on_hold';