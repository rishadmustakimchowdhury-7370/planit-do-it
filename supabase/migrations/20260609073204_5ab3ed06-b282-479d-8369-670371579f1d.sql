-- Fix FK violation: events were being inserted in a BEFORE INSERT trigger
-- before the parent client_submission_reports row existed. Split into
-- BEFORE UPDATE (mutate NEW) and AFTER INSERT/UPDATE (log events).

DROP TRIGGER IF EXISTS trg_csr_audit ON public.client_submission_reports;
DROP FUNCTION IF EXISTS public.tg_csr_audit();

-- BEFORE UPDATE: mutate NEW for approval timestamps and edit-after-approval reset
CREATE OR REPLACE FUNCTION public.tg_csr_audit_before()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_actor uuid := auth.uid();
BEGIN
  IF (COALESCE(OLD.status,'') <> 'approved') AND NEW.status = 'approved' THEN
    NEW.approved_at := COALESCE(NEW.approved_at, now());
    NEW.approved_by := COALESCE(v_actor, NEW.approved_by);
  ELSIF OLD.status = 'approved' AND NEW.status = 'approved'
        AND NEW.report_data IS DISTINCT FROM OLD.report_data THEN
    NEW.status := 'draft';
    NEW.approved_at := NULL;
    NEW.approved_by := NULL;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_csr_audit_before
  BEFORE UPDATE ON public.client_submission_reports
  FOR EACH ROW EXECUTE FUNCTION public.tg_csr_audit_before();

-- AFTER INSERT/UPDATE: safe to insert events (row exists & is visible to FK check)
CREATE OR REPLACE FUNCTION public.tg_csr_audit_after()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_actor uuid := auth.uid();
BEGIN
  IF NEW.id IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.client_submission_report_events
      (tenant_id, report_id, job_id, candidate_id, version, event_type, actor_id, metadata)
    VALUES (NEW.tenant_id, NEW.id, NEW.job_id, NEW.candidate_id, NEW.version, 'draft',
            COALESCE(v_actor, NEW.generated_by), jsonb_build_object('source','generated'));
    RETURN NEW;
  END IF;

  IF (COALESCE(OLD.status,'') <> 'approved') AND NEW.status = 'approved' THEN
    INSERT INTO public.client_submission_report_events
      (tenant_id, report_id, job_id, candidate_id, version, event_type, actor_id, metadata)
    VALUES (NEW.tenant_id, NEW.id, NEW.job_id, NEW.candidate_id, NEW.version, 'approved',
            NEW.approved_by, jsonb_build_object('snapshot_version', NEW.version));
  ELSIF OLD.status = 'approved' AND NEW.status = 'draft'
        AND NEW.report_data IS DISTINCT FROM OLD.report_data THEN
    INSERT INTO public.client_submission_report_events
      (tenant_id, report_id, job_id, candidate_id, version, event_type, actor_id, metadata)
    VALUES (NEW.tenant_id, NEW.id, NEW.job_id, NEW.candidate_id, NEW.version, 'draft',
            v_actor, jsonb_build_object('reason','edited_after_approval'));
  END IF;

  RETURN NEW;
END $$;

CREATE TRIGGER trg_csr_audit_after
  AFTER INSERT OR UPDATE ON public.client_submission_reports
  FOR EACH ROW EXECUTE FUNCTION public.tg_csr_audit_after();