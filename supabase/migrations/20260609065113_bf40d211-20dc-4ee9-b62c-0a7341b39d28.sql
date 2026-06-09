
ALTER TABLE public.client_submission_reports
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by uuid;

CREATE TABLE IF NOT EXISTS public.client_submission_report_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  report_id uuid NOT NULL REFERENCES public.client_submission_reports(id) ON DELETE CASCADE,
  job_id uuid NOT NULL,
  candidate_id uuid NOT NULL,
  version integer NOT NULL DEFAULT 1,
  event_type text NOT NULL CHECK (event_type IN ('draft','approved','generated','sent')),
  actor_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.client_submission_report_events TO authenticated;
GRANT ALL ON public.client_submission_report_events TO service_role;

ALTER TABLE public.client_submission_report_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant members read report events"
  ON public.client_submission_report_events FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "tenant members insert report events"
  ON public.client_submission_report_events FOR INSERT TO authenticated
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_csre_lookup
  ON public.client_submission_report_events (tenant_id, job_id, candidate_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.tg_csr_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_actor uuid := auth.uid();
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.client_submission_report_events
      (tenant_id, report_id, job_id, candidate_id, version, event_type, actor_id, metadata)
    VALUES (NEW.tenant_id, NEW.id, NEW.job_id, NEW.candidate_id, NEW.version, 'draft',
            COALESCE(v_actor, NEW.generated_by), jsonb_build_object('source','generated'));
    RETURN NEW;
  END IF;

  IF (COALESCE(OLD.status,'') <> 'approved') AND NEW.status = 'approved' THEN
    NEW.approved_at := now();
    NEW.approved_by := COALESCE(v_actor, NEW.approved_by);
    INSERT INTO public.client_submission_report_events
      (tenant_id, report_id, job_id, candidate_id, version, event_type, actor_id, metadata)
    VALUES (NEW.tenant_id, NEW.id, NEW.job_id, NEW.candidate_id, NEW.version, 'approved',
            NEW.approved_by, jsonb_build_object('snapshot', NEW.report_data));
    RETURN NEW;
  END IF;

  IF OLD.status = 'approved' AND NEW.status = 'approved' AND NEW.report_data IS DISTINCT FROM OLD.report_data THEN
    NEW.status := 'draft';
    NEW.approved_at := NULL;
    NEW.approved_by := NULL;
    INSERT INTO public.client_submission_report_events
      (tenant_id, report_id, job_id, candidate_id, version, event_type, actor_id, metadata)
    VALUES (NEW.tenant_id, NEW.id, NEW.job_id, NEW.candidate_id, NEW.version, 'draft',
            v_actor, jsonb_build_object('reason','edited_after_approval'));
    RETURN NEW;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_csr_audit ON public.client_submission_reports;
CREATE TRIGGER trg_csr_audit
  BEFORE INSERT OR UPDATE ON public.client_submission_reports
  FOR EACH ROW EXECUTE FUNCTION public.tg_csr_audit();

CREATE OR REPLACE FUNCTION public.tg_cspf_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_version int;
BEGIN
  SELECT version INTO v_version FROM public.client_submission_reports WHERE id = NEW.report_id;
  INSERT INTO public.client_submission_report_events
    (tenant_id, report_id, job_id, candidate_id, version, event_type, actor_id, metadata)
  VALUES (NEW.tenant_id, NEW.report_id, NEW.job_id, NEW.candidate_id, COALESCE(v_version,1), 'generated',
          NEW.recruiter_id, jsonb_build_object('pack_id', NEW.id, 'pack_option', NEW.pack_option, 'file_name', NEW.file_name));
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_cspf_audit ON public.client_submission_pack_files;
CREATE TRIGGER trg_cspf_audit
  AFTER INSERT ON public.client_submission_pack_files
  FOR EACH ROW EXECUTE FUNCTION public.tg_cspf_audit();

CREATE OR REPLACE FUNCTION public.tg_cemail_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_report_id uuid;
  v_version int;
BEGIN
  IF NEW.candidate_id IS NULL OR NEW.job_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.status NOT IN ('sent','sending') THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = NEW.status THEN RETURN NEW; END IF;

  v_report_id := NEW.submission_report_id;
  IF v_report_id IS NULL THEN
    SELECT id, version INTO v_report_id, v_version FROM public.client_submission_reports
      WHERE tenant_id = NEW.tenant_id AND job_id = NEW.job_id AND candidate_id = NEW.candidate_id
      ORDER BY version DESC LIMIT 1;
  ELSE
    SELECT version INTO v_version FROM public.client_submission_reports WHERE id = v_report_id;
  END IF;

  IF v_report_id IS NULL THEN RETURN NEW; END IF;

  INSERT INTO public.client_submission_report_events
    (tenant_id, report_id, job_id, candidate_id, version, event_type, actor_id, metadata)
  VALUES (NEW.tenant_id, v_report_id, NEW.job_id, NEW.candidate_id, COALESCE(v_version,1), 'sent',
          NEW.sent_by, jsonb_build_object('email_id', NEW.id, 'to_email', NEW.to_email, 'subject', NEW.subject));
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_cemail_audit ON public.client_emails;
CREATE TRIGGER trg_cemail_audit
  AFTER INSERT OR UPDATE OF status ON public.client_emails
  FOR EACH ROW EXECUTE FUNCTION public.tg_cemail_audit();
