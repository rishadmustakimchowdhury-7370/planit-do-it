
-- =================== Status change trigger on candidate_submissions ===================
CREATE OR REPLACE FUNCTION public.tg_candidate_submissions_status_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  notif_title text;
  notif_body  text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.submission_activity (submission_id, tenant_id, actor_id, activity_type, payload)
    VALUES (NEW.id, NEW.tenant_id, NEW.submitted_by, 'submission_created',
      jsonb_build_object('status', NEW.status));
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.submission_activity (submission_id, tenant_id, actor_id, activity_type, payload)
    VALUES (NEW.id, NEW.tenant_id, auth.uid(), 'status_changed',
      jsonb_build_object('from', OLD.status, 'to', NEW.status));

    -- Notify submitter on meaningful transitions
    IF NEW.submitted_by IS NOT NULL AND NEW.status IN ('viewed','screening','interview_requested','offer','hired','rejected') THEN
      notif_title := 'Submission update';
      notif_body  := 'Status changed to ' || NEW.status::text;
      INSERT INTO public.notifications (user_id, tenant_id, type, title, body, link)
      VALUES (NEW.submitted_by, NEW.tenant_id, 'submission_status', notif_title, notif_body,
              '/jobs/' || NEW.job_id::text);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_candidate_submissions_status_activity ON public.candidate_submissions;
CREATE TRIGGER trg_candidate_submissions_status_activity
AFTER INSERT OR UPDATE ON public.candidate_submissions
FOR EACH ROW EXECUTE FUNCTION public.tg_candidate_submissions_status_activity();

-- =================== Trigger on submission_recipients (view / decision) ===================
CREATE OR REPLACE FUNCTION public.tg_submission_recipients_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sub RECORD;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.viewed_at IS DISTINCT FROM OLD.viewed_at AND NEW.viewed_at IS NOT NULL THEN
    INSERT INTO public.submission_activity (submission_id, tenant_id, actor_id, activity_type, payload)
    VALUES (NEW.submission_id, NEW.tenant_id, NEW.client_user_id, 'recipient_viewed',
      jsonb_build_object('recipient_id', NEW.id));

    SELECT * INTO sub FROM public.candidate_submissions WHERE id = NEW.submission_id;
    IF sub.status = 'submitted' THEN
      UPDATE public.candidate_submissions
        SET status = 'viewed', viewed_at = COALESCE(viewed_at, now()), last_activity_at = now()
        WHERE id = NEW.submission_id;
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.decision IS DISTINCT FROM OLD.decision AND NEW.decision IS NOT NULL THEN
    INSERT INTO public.submission_activity (submission_id, tenant_id, actor_id, activity_type, payload)
    VALUES (NEW.submission_id, NEW.tenant_id, NEW.client_user_id, 'recipient_decision',
      jsonb_build_object('recipient_id', NEW.id, 'decision', NEW.decision));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_submission_recipients_activity ON public.submission_recipients;
CREATE TRIGGER trg_submission_recipients_activity
AFTER UPDATE ON public.submission_recipients
FOR EACH ROW EXECUTE FUNCTION public.tg_submission_recipients_activity();

-- =================== Client RPC: mark_submission_viewed ===================
CREATE OR REPLACE FUNCTION public.mark_submission_viewed(_submission_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  UPDATE public.submission_recipients
    SET viewed_at = COALESCE(viewed_at, now())
    WHERE submission_id = _submission_id AND client_user_id = auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION public.mark_submission_viewed(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_submission_viewed(uuid) TO authenticated;

-- =================== Client RPC: respond_to_submission ===================
CREATE OR REPLACE FUNCTION public.respond_to_submission(
  _submission_id uuid,
  _decision text  -- 'approved' | 'rejected' | 'requested_interview'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec RECORD;
  total int;
  approved_count int;
  rejected_count int;
  new_status submission_status;
  perm_ok boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF _decision NOT IN ('approved','rejected','requested_interview') THEN
    RAISE EXCEPTION 'Invalid decision: %', _decision;
  END IF;

  SELECT sr.*, cs.client_org_id AS sub_client_org, cs.tenant_id AS sub_tenant
    INTO rec
    FROM public.submission_recipients sr
    JOIN public.candidate_submissions cs ON cs.id = sr.submission_id
    WHERE sr.submission_id = _submission_id
      AND sr.client_user_id = auth.uid()
    LIMIT 1;

  IF rec.id IS NULL THEN
    RAISE EXCEPTION 'You are not a recipient of this submission';
  END IF;

  -- Permission check
  IF _decision IN ('approved','rejected') THEN
    SELECT COALESCE((SELECT approve_reject FROM public.client_user_permissions
                     WHERE client_user_id = auth.uid() AND client_org_id = rec.sub_client_org), true)
      INTO perm_ok;
    IF NOT perm_ok THEN RAISE EXCEPTION 'Missing approve/reject permission'; END IF;
  ELSIF _decision = 'requested_interview' THEN
    SELECT COALESCE((SELECT request_interviews FROM public.client_user_permissions
                     WHERE client_user_id = auth.uid() AND client_org_id = rec.sub_client_org), true)
      INTO perm_ok;
    IF NOT perm_ok THEN RAISE EXCEPTION 'Missing interview request permission'; END IF;
  END IF;

  UPDATE public.submission_recipients
    SET decision = _decision,
        decision_at = now(),
        viewed_at = COALESCE(viewed_at, now())
    WHERE id = rec.id;

  -- Aggregate decisions and possibly advance submission
  SELECT COUNT(*),
         COUNT(*) FILTER (WHERE decision = 'approved'),
         COUNT(*) FILTER (WHERE decision = 'rejected')
    INTO total, approved_count, rejected_count
    FROM public.submission_recipients
    WHERE submission_id = _submission_id;

  IF _decision = 'requested_interview' THEN
    new_status := 'interview_requested';
  ELSIF approved_count > 0 THEN
    new_status := 'screening';
  ELSIF rejected_count = total THEN
    new_status := 'rejected';
  ELSE
    new_status := NULL;
  END IF;

  IF new_status IS NOT NULL THEN
    UPDATE public.candidate_submissions
      SET status = new_status, last_activity_at = now()
      WHERE id = _submission_id;
  ELSE
    UPDATE public.candidate_submissions
      SET last_activity_at = now()
      WHERE id = _submission_id;
  END IF;

  RETURN rec.id;
END;
$$;

REVOKE ALL ON FUNCTION public.respond_to_submission(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.respond_to_submission(uuid, text) TO authenticated;
