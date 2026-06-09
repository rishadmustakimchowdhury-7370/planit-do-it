-- Single Active Validation Rule for ai_candidate_validations
ALTER TABLE public.ai_candidate_validations
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- Backfill: mark only the latest row per (job_id, candidate_id) as active,
-- archive everything older.
WITH latest AS (
  SELECT DISTINCT ON (job_id, candidate_id) id
  FROM public.ai_candidate_validations
  ORDER BY job_id, candidate_id, created_at DESC
)
UPDATE public.ai_candidate_validations v
SET is_active = (v.id IN (SELECT id FROM latest));

-- Enforce one active row per (job_id, candidate_id)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_aiv_active_per_pair
  ON public.ai_candidate_validations(job_id, candidate_id)
  WHERE is_active;

CREATE INDEX IF NOT EXISTS idx_aiv_active_pair
  ON public.ai_candidate_validations(job_id, candidate_id) WHERE is_active;

-- Trigger: when a new validation is inserted (or an existing one is flipped
-- active), archive every other row for the same (job_id, candidate_id).
CREATE OR REPLACE FUNCTION public.archive_prior_validations()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_active THEN
    UPDATE public.ai_candidate_validations
       SET is_active = false
     WHERE job_id = NEW.job_id
       AND candidate_id = NEW.candidate_id
       AND id <> NEW.id
       AND is_active = true;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_aiv_archive_prior ON public.ai_candidate_validations;
CREATE TRIGGER trg_aiv_archive_prior
AFTER INSERT OR UPDATE OF is_active ON public.ai_candidate_validations
FOR EACH ROW
EXECUTE FUNCTION public.archive_prior_validations();