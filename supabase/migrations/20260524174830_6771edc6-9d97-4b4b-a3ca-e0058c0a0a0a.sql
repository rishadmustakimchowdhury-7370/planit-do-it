
-- Status enum
DO $$ BEGIN
  CREATE TYPE public.interview_request_status AS ENUM ('pending','accepted','declined','cancelled','expired');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.interview_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  client_org_id uuid NOT NULL,
  job_id uuid NOT NULL,
  job_candidate_id uuid NOT NULL,
  requested_by uuid NOT NULL,
  meeting_format text NOT NULL DEFAULT 'video', -- video | phone | onsite
  duration_minutes integer NOT NULL DEFAULT 30,
  proposed_slots jsonb NOT NULL DEFAULT '[]'::jsonb, -- [{start_time, end_time, timezone}]
  client_notes text,
  status public.interview_request_status NOT NULL DEFAULT 'pending',
  responded_by uuid,
  responded_at timestamptz,
  recruiter_notes text,
  selected_slot jsonb,
  event_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_interview_requests_tenant ON public.interview_requests(tenant_id);
CREATE INDEX IF NOT EXISTS idx_interview_requests_client_org ON public.interview_requests(client_org_id);
CREATE INDEX IF NOT EXISTS idx_interview_requests_job_candidate ON public.interview_requests(job_candidate_id);
CREATE INDEX IF NOT EXISTS idx_interview_requests_status ON public.interview_requests(status);

ALTER TABLE public.events ADD COLUMN IF NOT EXISTS interview_request_id uuid;

CREATE TRIGGER update_interview_requests_updated_at
BEFORE UPDATE ON public.interview_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.interview_requests ENABLE ROW LEVEL SECURITY;

-- Client users: insert only for candidates shared with their org
CREATE POLICY "Clients create requests for shared candidates"
ON public.interview_requests FOR INSERT TO authenticated
WITH CHECK (
  client_org_id = public.client_org_for_user(auth.uid())
  AND tenant_id = public.client_tenant_for_user(auth.uid())
  AND requested_by = auth.uid()
  AND public.client_can_see_candidate(auth.uid(), job_candidate_id)
);

-- Client users: select own org
CREATE POLICY "Clients view own org requests"
ON public.interview_requests FOR SELECT TO authenticated
USING (client_org_id = public.client_org_for_user(auth.uid()));

-- Client users: cancel their own request (update status only handled in app)
CREATE POLICY "Clients update own pending requests"
ON public.interview_requests FOR UPDATE TO authenticated
USING (
  client_org_id = public.client_org_for_user(auth.uid())
  AND requested_by = auth.uid()
  AND status = 'pending'
)
WITH CHECK (
  client_org_id = public.client_org_for_user(auth.uid())
  AND requested_by = auth.uid()
);

-- Internal tenant users: view all in tenant
CREATE POLICY "Tenant members view requests"
ON public.interview_requests FOR SELECT TO authenticated
USING (
  public.user_belongs_to_tenant(auth.uid(), tenant_id)
  OR public.is_super_admin(auth.uid())
);

-- Internal tenant users (recruiter/manager/owner): respond
CREATE POLICY "Tenant members respond to requests"
ON public.interview_requests FOR UPDATE TO authenticated
USING (
  public.user_belongs_to_tenant(auth.uid(), tenant_id)
)
WITH CHECK (
  public.user_belongs_to_tenant(auth.uid(), tenant_id)
);

-- Insert from internal side (recruiter proposing on behalf) - allow tenant members
CREATE POLICY "Tenant members create requests"
ON public.interview_requests FOR INSERT TO authenticated
WITH CHECK (
  public.user_belongs_to_tenant(auth.uid(), tenant_id)
);
