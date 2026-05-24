
-- Helper: insert notification rows
CREATE OR REPLACE FUNCTION public.client_portal_notify(
  _tenant_id uuid,
  _user_ids uuid[],
  _type text,
  _title text,
  _message text,
  _entity_type text,
  _entity_id uuid,
  _link text,
  _metadata jsonb DEFAULT '{}'::jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid;
BEGIN
  IF _user_ids IS NULL THEN RETURN; END IF;
  FOREACH uid IN ARRAY _user_ids LOOP
    IF uid IS NULL THEN CONTINUE; END IF;
    INSERT INTO public.notifications (tenant_id, user_id, type, title, message, entity_type, entity_id, link, metadata)
    VALUES (_tenant_id, uid, _type, _title, _message, _entity_type, _entity_id, _link, _metadata);
  END LOOP;
END;
$$;

-- ============ DISCUSSIONS ============
CREATE OR REPLACE FUNCTION public.notify_candidate_discussion()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  recipients uuid[];
  cand_name text;
  job_id_v uuid;
  job_title text;
  jc_link text;
BEGIN
  SELECT jc.job_id, c.full_name, j.title
    INTO job_id_v, cand_name, job_title
  FROM job_candidates jc
  JOIN candidates c ON c.id = jc.candidate_id
  JOIN jobs j ON j.id = jc.job_id
  WHERE jc.id = NEW.job_candidate_id;

  IF NEW.author_type = 'client' THEN
    -- Notify recruiter who shared the job (and assigned recruiter)
    SELECT array_agg(DISTINCT u) FROM (
      SELECT shared_by AS u FROM job_client_shares
        WHERE job_id = job_id_v AND client_org_id = NEW.client_org_id AND withdrawn_at IS NULL
      UNION
      SELECT assigned_to FROM jobs WHERE id = job_id_v AND assigned_to IS NOT NULL
    ) s INTO recipients;
    jc_link := '/candidates/' || (SELECT candidate_id FROM job_candidates WHERE id = NEW.job_candidate_id);
    PERFORM public.client_portal_notify(
      NEW.tenant_id, recipients, 'client_discussion_message',
      'New client message on ' || COALESCE(cand_name, 'candidate'),
      LEFT(NEW.body, 140),
      'job_candidate', NEW.job_candidate_id, jc_link,
      jsonb_build_object('client_org_id', NEW.client_org_id, 'job_id', job_id_v)
    );
  ELSE
    -- Notify all active client portal users in the org
    SELECT array_agg(user_id) INTO recipients
      FROM client_portal_users
      WHERE client_org_id = NEW.client_org_id AND is_active = true;
    jc_link := '/client/jobs/' || job_id_v;
    PERFORM public.client_portal_notify(
      NEW.tenant_id, recipients, 'recruiter_discussion_message',
      'New message about ' || COALESCE(cand_name, 'candidate'),
      LEFT(NEW.body, 140),
      'job_candidate', NEW.job_candidate_id, jc_link,
      jsonb_build_object('job_id', job_id_v)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_candidate_discussion ON public.candidate_discussions;
CREATE TRIGGER trg_notify_candidate_discussion
  AFTER INSERT ON public.candidate_discussions
  FOR EACH ROW EXECUTE FUNCTION public.notify_candidate_discussion();

-- ============ FEEDBACK ============
CREATE OR REPLACE FUNCTION public.notify_candidate_feedback()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  recipients uuid[];
  cand_name text;
  job_id_v uuid;
  msg text;
BEGIN
  SELECT jc.job_id, c.full_name INTO job_id_v, cand_name
  FROM job_candidates jc JOIN candidates c ON c.id = jc.candidate_id
  WHERE jc.id = NEW.job_candidate_id;

  msg := COALESCE(
    CASE WHEN NEW.decision IS NOT NULL THEN 'Decision: ' || NEW.decision ELSE NULL END,
    CASE WHEN NEW.rating IS NOT NULL THEN 'Rating: ' || NEW.rating || '/5' ELSE NULL END,
    LEFT(COALESCE(NEW.comment, ''), 140)
  );

  IF NEW.author_type = 'client' THEN
    SELECT array_agg(DISTINCT u) FROM (
      SELECT shared_by AS u FROM job_client_shares
        WHERE job_id = job_id_v AND client_org_id = NEW.client_org_id AND withdrawn_at IS NULL
      UNION
      SELECT assigned_to FROM jobs WHERE id = job_id_v AND assigned_to IS NOT NULL
    ) s INTO recipients;
    PERFORM public.client_portal_notify(
      NEW.tenant_id, recipients, 'client_feedback_submitted',
      'Client feedback on ' || COALESCE(cand_name, 'candidate'), msg,
      'job_candidate', NEW.job_candidate_id,
      '/candidates/' || (SELECT candidate_id FROM job_candidates WHERE id = NEW.job_candidate_id),
      jsonb_build_object('client_org_id', NEW.client_org_id, 'decision', NEW.decision, 'rating', NEW.rating)
    );
  ELSE
    SELECT array_agg(user_id) INTO recipients
      FROM client_portal_users
      WHERE client_org_id = NEW.client_org_id AND is_active = true;
    PERFORM public.client_portal_notify(
      NEW.tenant_id, recipients, 'recruiter_feedback_shared',
      'Recruiter feedback on ' || COALESCE(cand_name, 'candidate'), msg,
      'job_candidate', NEW.job_candidate_id,
      '/client/jobs/' || job_id_v,
      jsonb_build_object('decision', NEW.decision, 'rating', NEW.rating)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_candidate_feedback ON public.candidate_feedback;
CREATE TRIGGER trg_notify_candidate_feedback
  AFTER INSERT ON public.candidate_feedback
  FOR EACH ROW EXECUTE FUNCTION public.notify_candidate_feedback();

-- ============ INTERVIEW REQUESTS ============
CREATE OR REPLACE FUNCTION public.notify_interview_request()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  recipients uuid[];
  cand_name text;
  job_title text;
BEGIN
  SELECT c.full_name, j.title INTO cand_name, job_title
  FROM job_candidates jc
  JOIN candidates c ON c.id = jc.candidate_id
  JOIN jobs j ON j.id = jc.job_id
  WHERE jc.id = NEW.job_candidate_id;

  IF TG_OP = 'INSERT' THEN
    SELECT array_agg(DISTINCT u) FROM (
      SELECT shared_by AS u FROM job_client_shares
        WHERE job_id = NEW.job_id AND client_org_id = NEW.client_org_id AND withdrawn_at IS NULL
      UNION
      SELECT assigned_to FROM jobs WHERE id = NEW.job_id AND assigned_to IS NOT NULL
    ) s INTO recipients;
    PERFORM public.client_portal_notify(
      NEW.tenant_id, recipients, 'interview_request_received',
      'New interview request: ' || COALESCE(cand_name, 'candidate'),
      'Client proposed ' || jsonb_array_length(NEW.proposed_slots) || ' time slot(s) for ' || COALESCE(job_title, 'a role'),
      'interview_request', NEW.id,
      '/candidates/' || (SELECT candidate_id FROM job_candidates WHERE id = NEW.job_candidate_id),
      jsonb_build_object('job_id', NEW.job_id, 'client_org_id', NEW.client_org_id)
    );
    RETURN NEW;
  END IF;

  -- UPDATE: status change
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('accepted','declined') THEN
    recipients := ARRAY[NEW.requested_by];
    PERFORM public.client_portal_notify(
      NEW.tenant_id, recipients,
      CASE WHEN NEW.status = 'accepted' THEN 'interview_request_accepted' ELSE 'interview_request_declined' END,
      CASE WHEN NEW.status = 'accepted'
        THEN 'Interview confirmed for ' || COALESCE(cand_name, 'candidate')
        ELSE 'Interview request declined' END,
      COALESCE(NEW.recruiter_notes, CASE WHEN NEW.status='accepted' THEN 'Your recruiter accepted the proposed time.' ELSE 'Your recruiter declined the request.' END),
      'interview_request', NEW.id, '/client/interviews',
      jsonb_build_object('status', NEW.status, 'job_id', NEW.job_id)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_interview_request_ins ON public.interview_requests;
CREATE TRIGGER trg_notify_interview_request_ins
  AFTER INSERT ON public.interview_requests
  FOR EACH ROW EXECUTE FUNCTION public.notify_interview_request();

DROP TRIGGER IF EXISTS trg_notify_interview_request_upd ON public.interview_requests;
CREATE TRIGGER trg_notify_interview_request_upd
  AFTER UPDATE ON public.interview_requests
  FOR EACH ROW EXECUTE FUNCTION public.notify_interview_request();

-- ============ JOB SHARED ============
CREATE OR REPLACE FUNCTION public.notify_job_client_share()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  recipients uuid[];
  job_title text;
BEGIN
  SELECT title INTO job_title FROM jobs WHERE id = NEW.job_id;
  SELECT array_agg(user_id) INTO recipients
    FROM client_portal_users
    WHERE client_org_id = NEW.client_org_id AND is_active = true;
  PERFORM public.client_portal_notify(
    NEW.tenant_id, recipients, 'job_shared',
    'New role shared with you',
    'You now have access to ' || COALESCE(job_title, 'a new role'),
    'job', NEW.job_id, '/client/jobs/' || NEW.job_id,
    jsonb_build_object('shared_by', NEW.shared_by)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_job_client_share ON public.job_client_shares;
CREATE TRIGGER trg_notify_job_client_share
  AFTER INSERT ON public.job_client_shares
  FOR EACH ROW EXECUTE FUNCTION public.notify_job_client_share();
