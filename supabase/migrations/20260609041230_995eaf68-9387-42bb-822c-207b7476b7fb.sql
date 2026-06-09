
-- ============================================================
-- Automatic structuring infrastructure
-- ============================================================

-- 1. Status columns on jobs
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS structuring_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS structuring_last_error text,
  ADD COLUMN IF NOT EXISTS structuring_retry_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS structuring_started_at timestamptz;

-- 2. Status columns on candidates
ALTER TABLE public.candidates
  ADD COLUMN IF NOT EXISTS structuring_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS structuring_last_error text,
  ADD COLUMN IF NOT EXISTS structuring_retry_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS structuring_started_at timestamptz;

-- Backfill: rows already structured at current schema -> completed
UPDATE public.jobs SET structuring_status = 'completed'
  WHERE structured_jd IS NOT NULL AND structuring_status = 'pending';
UPDATE public.candidates SET structuring_status = 'completed'
  WHERE structured_profile IS NOT NULL AND structuring_status = 'pending';

CREATE INDEX IF NOT EXISTS idx_jobs_structuring_status
  ON public.jobs(structuring_status) WHERE structuring_status IN ('pending','failed');
CREATE INDEX IF NOT EXISTS idx_candidates_structuring_status
  ON public.candidates(structuring_status) WHERE structuring_status IN ('pending','failed');

-- 3. Trigger helper: enqueue HTTP call to auto-structure-entity
CREATE OR REPLACE FUNCTION public._enqueue_auto_structure(
  _entity_type text,
  _entity_id uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Best-effort fire-and-forget. pg_net queues the request; failures here
  -- must never block the underlying insert/update.
  BEGIN
    PERFORM net.http_post(
      url := 'https://efdvolifacsnmiinifiq.supabase.co/functions/v1/auto-structure-entity',
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body := jsonb_build_object('entity_type', _entity_type, 'entity_id', _entity_id)
    );
  EXCEPTION WHEN OTHERS THEN
    -- swallow — the cron sweeper will retry pending rows
    NULL;
  END;
END;
$$;

-- 4. Job trigger
CREATE OR REPLACE FUNCTION public.auto_structure_job_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_meaningful_change boolean := false;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_meaningful_change := true;
  ELSE
    -- Only re-structure when meaningful fields change
    IF NEW.title IS DISTINCT FROM OLD.title
       OR NEW.description IS DISTINCT FROM OLD.description
       OR NEW.requirements IS DISTINCT FROM OLD.requirements
       OR NEW.skills IS DISTINCT FROM OLD.skills
       OR NEW.jd_parsed_text IS DISTINCT FROM OLD.jd_parsed_text
       OR NEW.experience_level IS DISTINCT FROM OLD.experience_level
       OR NEW.employment_type IS DISTINCT FROM OLD.employment_type
    THEN
      v_meaningful_change := true;
    END IF;
  END IF;

  IF v_meaningful_change AND NEW.title IS NOT NULL AND length(trim(NEW.title)) > 0 THEN
    -- Reset to pending only if this is a real content change
    IF TG_OP = 'UPDATE' THEN
      NEW.structuring_status := 'pending';
      NEW.structuring_last_error := NULL;
    END IF;
    PERFORM public._enqueue_auto_structure('job', NEW.id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS jobs_auto_structure ON public.jobs;
CREATE TRIGGER jobs_auto_structure
  BEFORE INSERT OR UPDATE ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.auto_structure_job_trigger();

-- 5. Candidate trigger
CREATE OR REPLACE FUNCTION public.auto_structure_candidate_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_meaningful_change boolean := false;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_meaningful_change := true;
  ELSE
    IF NEW.full_name IS DISTINCT FROM OLD.full_name
       OR NEW.current_title IS DISTINCT FROM OLD.current_title
       OR NEW.current_company IS DISTINCT FROM OLD.current_company
       OR NEW.summary IS DISTINCT FROM OLD.summary
       OR NEW.skills IS DISTINCT FROM OLD.skills
       OR NEW.work_history IS DISTINCT FROM OLD.work_history
       OR NEW.education IS DISTINCT FROM OLD.education
       OR NEW.cv_parsed_data IS DISTINCT FROM OLD.cv_parsed_data
       OR NEW.cv_file_url IS DISTINCT FROM OLD.cv_file_url
       OR NEW.linkedin_data IS DISTINCT FROM OLD.linkedin_data
       OR NEW.experience_years IS DISTINCT FROM OLD.experience_years
    THEN
      v_meaningful_change := true;
    END IF;
  END IF;

  IF v_meaningful_change THEN
    IF TG_OP = 'UPDATE' THEN
      NEW.structuring_status := 'pending';
      NEW.structuring_last_error := NULL;
    END IF;
    PERFORM public._enqueue_auto_structure('candidate', NEW.id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS candidates_auto_structure ON public.candidates;
CREATE TRIGGER candidates_auto_structure
  BEFORE INSERT OR UPDATE ON public.candidates
  FOR EACH ROW EXECUTE FUNCTION public.auto_structure_candidate_trigger();

-- 6. Cron sweeper (every 2 minutes) — re-enqueues stuck pending/failed rows.
-- This guarantees DB-trigger authority even if pg_net momentarily fails.
CREATE OR REPLACE FUNCTION public.sweep_pending_structuring()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  r record;
BEGIN
  -- Jobs: pending OR failed (with backoff: retry_count < 5 and last attempt > 5 min ago)
  FOR r IN
    SELECT id FROM public.jobs
    WHERE structuring_status IN ('pending','failed')
      AND structuring_retry_count < 5
      AND (structuring_started_at IS NULL OR structuring_started_at < now() - interval '5 minutes')
      AND title IS NOT NULL AND length(trim(title)) > 0
    LIMIT 25
  LOOP
    PERFORM public._enqueue_auto_structure('job', r.id);
  END LOOP;

  FOR r IN
    SELECT id FROM public.candidates
    WHERE structuring_status IN ('pending','failed')
      AND structuring_retry_count < 5
      AND (structuring_started_at IS NULL OR structuring_started_at < now() - interval '5 minutes')
    LIMIT 25
  LOOP
    PERFORM public._enqueue_auto_structure('candidate', r.id);
  END LOOP;
END;
$$;

-- Schedule the sweeper via pg_cron (if extension available)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('sweep_pending_structuring');
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'sweep_pending_structuring',
      '*/2 * * * *',
      $cron$ SELECT public.sweep_pending_structuring(); $cron$
    );
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
