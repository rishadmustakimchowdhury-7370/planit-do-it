-- 1. Update existing integration rows
ALTER TABLE public.candidate_source_integrations DROP CONSTRAINT IF EXISTS candidate_source_integrations_provider_check;

UPDATE public.candidate_source_integrations
SET provider = 'vibe_prospecting'
WHERE provider = 'viral_prospect';

ALTER TABLE public.candidate_source_integrations
  ADD CONSTRAINT candidate_source_integrations_provider_check
  CHECK (provider IN ('lusha','vibe_prospecting'));

-- 2. Rename source labels in candidates
UPDATE public.candidates
SET source = 'Vibe Prospecting'
WHERE source = 'Viral Prospect';
