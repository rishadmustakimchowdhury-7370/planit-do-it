
-- 1) Expand allowed actor_type values to match what the app & triggers actually insert
ALTER TABLE public.submission_activity
  DROP CONSTRAINT IF EXISTS submission_activity_actor_type_check;

ALTER TABLE public.submission_activity
  ADD CONSTRAINT submission_activity_actor_type_check
  CHECK (actor_type IN ('recruiter','manager','owner','client','system','ai','internal'));

-- 2) Make submission triggers safe — never block primary workflow if activity logging fails
CREATE OR REPLACE FUNCTION public.tg_candidate_submissions_status_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  notif_title text;
  notif_body  text;
BEGIN
  BEGIN
    IF TG_OP = 'INSERT' THEN
      INSERT INTO public.submission_activity (submission_id, tenant_id, client_org_id, actor_user_id, actor_type, event_type, metadata)
      VALUES (NEW.id, NEW.tenant_id, NEW.client_org_id, NEW.submitted_by, 'recruiter', 'submission_created',
        jsonb_build_object('status', NEW.status));
      RETURN NEW;
    END IF;

    IF NEW.status IS DISTINCT FROM OLD.status THEN
      INSERT INTO public.submission_activity (submission_id, tenant_id, client_org_id, actor_user_id, actor_type, event_type, metadata)
      VALUES (NEW.id, NEW.tenant_id, NEW.client_org_id, auth.uid(), 'recruiter', 'status_changed',
        jsonb_build_object('from', OLD.status, 'to', NEW.status));

      IF NEW.submitted_by IS NOT NULL AND NEW.status::text IN ('viewed','screening','interview_requested','offer','hired','rejected') THEN
        notif_title := 'Submission update';
        notif_body  := 'Status changed to ' || NEW.status::text;
        INSERT INTO public.notifications (user_id, tenant_id, type, title, body, link)
        VALUES (NEW.submitted_by, NEW.tenant_id, 'submission_status', notif_title, notif_body,
                '/jobs/' || NEW.job_id::text);
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'submission_activity trigger failed (non-blocking): %', SQLERRM;
  END;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.tg_submission_recipients_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  sub RECORD;
BEGIN
  BEGIN
    IF TG_OP = 'UPDATE' AND NEW.viewed_at IS DISTINCT FROM OLD.viewed_at AND NEW.viewed_at IS NOT NULL THEN
      INSERT INTO public.submission_activity (submission_id, tenant_id, client_org_id, actor_user_id, actor_type, event_type, metadata)
      SELECT NEW.submission_id, NEW.tenant_id, cs.client_org_id, NEW.client_user_id, 'client', 'recipient_viewed',
        jsonb_build_object('recipient_id', NEW.id)
      FROM public.candidate_submissions cs WHERE cs.id = NEW.submission_id;

      SELECT * INTO sub FROM public.candidate_submissions WHERE id = NEW.submission_id;
      IF sub.status::text = 'submitted' THEN
        UPDATE public.candidate_submissions
          SET status = 'viewed', viewed_at = COALESCE(viewed_at, now()), last_activity_at = now()
          WHERE id = NEW.submission_id;
      END IF;
    END IF;

    IF TG_OP = 'UPDATE' AND NEW.decision IS DISTINCT FROM OLD.decision AND NEW.decision IS NOT NULL THEN
      INSERT INTO public.submission_activity (submission_id, tenant_id, client_org_id, actor_user_id, actor_type, event_type, metadata)
      SELECT NEW.submission_id, NEW.tenant_id, cs.client_org_id, NEW.client_user_id, 'client', 'recipient_decision',
        jsonb_build_object('recipient_id', NEW.id, 'decision', NEW.decision)
      FROM public.candidate_submissions cs WHERE cs.id = NEW.submission_id;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'submission_recipients trigger failed (non-blocking): %', SQLERRM;
  END;
  RETURN NEW;
END;
$function$;
