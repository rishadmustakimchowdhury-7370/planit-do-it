
-- 1. Reply tracking on submissions
ALTER TABLE public.candidate_submissions
  ADD COLUMN IF NOT EXISTS email_replied boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reply_date timestamptz,
  ADD COLUMN IF NOT EXISTS reply_summary text;

-- 2. Audit table for stage changes
CREATE TABLE IF NOT EXISTS public.submission_stage_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES public.candidate_submissions(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL,
  from_status text,
  to_status text NOT NULL,
  changed_by uuid,
  source text NOT NULL DEFAULT 'manual',
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.submission_stage_audit TO authenticated;
GRANT ALL ON public.submission_stage_audit TO service_role;

ALTER TABLE public.submission_stage_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members read stage audit"
  ON public.submission_stage_audit FOR SELECT
  TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR public.user_belongs_to_tenant(auth.uid(), tenant_id)
  );

CREATE POLICY "Service writes stage audit"
  ON public.submission_stage_audit FOR INSERT
  TO authenticated
  WITH CHECK (
    public.user_belongs_to_tenant(auth.uid(), tenant_id)
  );

CREATE INDEX IF NOT EXISTS idx_submission_stage_audit_submission
  ON public.submission_stage_audit(submission_id, created_at DESC);

-- 3. Trigger: status changes on candidate_submissions
CREATE OR REPLACE FUNCTION public.log_submission_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.submission_stage_audit (
      submission_id, tenant_id, from_status, to_status, changed_by, source
    ) VALUES (
      NEW.id, NEW.tenant_id, OLD.status::text, NEW.status::text, auth.uid(), 'system'
    );

    INSERT INTO public.submission_activity (
      submission_id, tenant_id, client_org_id, actor_user_id, actor_type, event_type, metadata
    ) VALUES (
      NEW.id, NEW.tenant_id, NEW.client_org_id, auth.uid(), 'recruiter',
      'status_changed',
      jsonb_build_object('from', OLD.status::text, 'to', NEW.status::text)
    );

    NEW.last_activity_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_submission_status_change ON public.candidate_submissions;
CREATE TRIGGER trg_log_submission_status_change
  BEFORE UPDATE OF status ON public.candidate_submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.log_submission_status_change();

-- 4. Trigger: client feedback rows feed the timeline
CREATE OR REPLACE FUNCTION public.log_client_feedback_to_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.submission_id IS NULL THEN RETURN NEW; END IF;
  INSERT INTO public.submission_activity (
    submission_id, tenant_id, client_org_id, actor_user_id, actor_type, event_type, message, metadata
  ) VALUES (
    NEW.submission_id, NEW.tenant_id, NEW.client_org_id, NEW.recorded_by, 'recruiter',
    'client_feedback', NEW.reason,
    jsonb_build_object('outcome', NEW.outcome)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_client_feedback_to_activity ON public.client_feedback_log;
CREATE TRIGGER trg_log_client_feedback_to_activity
  AFTER INSERT ON public.client_feedback_log
  FOR EACH ROW
  EXECUTE FUNCTION public.log_client_feedback_to_activity();

-- 5. RPC for safe stage transitions
CREATE OR REPLACE FUNCTION public.set_submission_status(
  _submission_id uuid,
  _to_status text,
  _note text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant uuid;
BEGIN
  SELECT tenant_id INTO v_tenant
  FROM public.candidate_submissions
  WHERE id = _submission_id;

  IF v_tenant IS NULL THEN
    RAISE EXCEPTION 'Submission not found';
  END IF;

  IF NOT (public.is_super_admin(auth.uid())
          OR public.user_belongs_to_tenant(auth.uid(), v_tenant)) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  UPDATE public.candidate_submissions
  SET status = _to_status::submission_status
  WHERE id = _submission_id;

  IF _note IS NOT NULL AND length(_note) > 0 THEN
    UPDATE public.submission_stage_audit
    SET note = _note
    WHERE id = (
      SELECT id FROM public.submission_stage_audit
      WHERE submission_id = _submission_id
      ORDER BY created_at DESC LIMIT 1
    );
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_submission_status(uuid, text, text) TO authenticated;
