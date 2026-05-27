
-- Executive Search OS: validation-staleness + JD signature + recruiter intelligence fields

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS jd_signature TEXT;

ALTER TABLE public.ai_candidate_validations
  ADD COLUMN IF NOT EXISTS jd_signature TEXT,
  ADD COLUMN IF NOT EXISTS validation_stale BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS interview_probability INTEGER,
  ADD COLUMN IF NOT EXISTS ecosystem_signals JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS match_classification TEXT,
  ADD COLUMN IF NOT EXISTS engine_version TEXT DEFAULT 'exec_search_v1';

CREATE INDEX IF NOT EXISTS idx_acv_stale ON public.ai_candidate_validations(job_id) WHERE validation_stale = true;

-- Signature function: hash of material JD fields
CREATE OR REPLACE FUNCTION public.compute_jd_signature(
  _title text, _description text, _requirements text, _location text,
  _employment_type text, _experience_level text, _skills jsonb, _jd_parsed text
) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT md5(
    coalesce(_title,'') || '|' ||
    coalesce(_description,'') || '|' ||
    coalesce(_requirements,'') || '|' ||
    coalesce(_location,'') || '|' ||
    coalesce(_employment_type,'') || '|' ||
    coalesce(_experience_level,'') || '|' ||
    coalesce(_skills::text,'') || '|' ||
    coalesce(_jd_parsed,'')
  );
$$;

-- Trigger: maintain jd_signature on jobs + cascade staleness to validations
CREATE OR REPLACE FUNCTION public.tg_jobs_signature_and_stale() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  new_sig text;
BEGIN
  new_sig := public.compute_jd_signature(
    NEW.title, NEW.description, NEW.requirements, NEW.location,
    NEW.employment_type, NEW.experience_level, NEW.skills, NEW.jd_parsed_text
  );
  NEW.jd_signature := new_sig;

  IF TG_OP = 'UPDATE' AND OLD.jd_signature IS DISTINCT FROM new_sig THEN
    UPDATE public.ai_candidate_validations
       SET validation_stale = true, updated_at = now()
     WHERE job_id = NEW.id
       AND (jd_signature IS NULL OR jd_signature <> new_sig);
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS jobs_signature_stale ON public.jobs;
CREATE TRIGGER jobs_signature_stale
  BEFORE INSERT OR UPDATE ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.tg_jobs_signature_and_stale();

-- Backfill existing signatures
UPDATE public.jobs SET jd_signature = public.compute_jd_signature(
  title, description, requirements, location, employment_type, experience_level, skills, jd_parsed_text
) WHERE jd_signature IS NULL;
