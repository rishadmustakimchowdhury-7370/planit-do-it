
-- ============================================================
-- PHASE 2: Sharing Model
-- ============================================================

-- 1. job_client_shares
CREATE TABLE IF NOT EXISTS public.job_client_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  client_org_id uuid NOT NULL REFERENCES public.client_organizations(id) ON DELETE CASCADE,
  shared_by uuid NOT NULL,
  permissions jsonb NOT NULL DEFAULT '{"can_view_pipeline":true,"can_request_interview":true,"can_leave_feedback":true,"can_message":true}'::jsonb,
  shared_at timestamptz NOT NULL DEFAULT now(),
  withdrawn_at timestamptz,
  UNIQUE (job_id, client_org_id)
);
CREATE INDEX IF NOT EXISTS idx_jcs_tenant ON public.job_client_shares(tenant_id);
CREATE INDEX IF NOT EXISTS idx_jcs_job ON public.job_client_shares(job_id);
CREATE INDEX IF NOT EXISTS idx_jcs_org ON public.job_client_shares(client_org_id);

-- 2. candidate_client_shares
CREATE TABLE IF NOT EXISTS public.candidate_client_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  job_candidate_id uuid NOT NULL REFERENCES public.job_candidates(id) ON DELETE CASCADE,
  client_org_id uuid NOT NULL REFERENCES public.client_organizations(id) ON DELETE CASCADE,
  shared_by uuid NOT NULL,
  status text NOT NULL DEFAULT 'shared' CHECK (status IN ('shared','withdrawn')),
  branded_cv_url text,
  recruiter_summary text,
  ai_insights_snapshot jsonb,
  shared_at timestamptz NOT NULL DEFAULT now(),
  withdrawn_at timestamptz,
  UNIQUE (job_candidate_id, client_org_id)
);
CREATE INDEX IF NOT EXISTS idx_ccs_tenant ON public.candidate_client_shares(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ccs_jc ON public.candidate_client_shares(job_candidate_id);
CREATE INDEX IF NOT EXISTS idx_ccs_org ON public.candidate_client_shares(client_org_id);

-- 3. Enable RLS
ALTER TABLE public.job_client_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_client_shares ENABLE ROW LEVEL SECURITY;

-- 4. RLS — job_client_shares
CREATE POLICY "Internal staff manage job shares in tenant"
ON public.job_client_shares FOR ALL
TO authenticated
USING (
  auth.uid() IS NOT NULL AND (
    public.is_super_admin(auth.uid())
    OR public.is_owner_or_manager_in_tenant(auth.uid(), tenant_id)
    OR (public.is_recruiter(auth.uid()) AND public.get_user_tenant_id(auth.uid()) = tenant_id)
  )
)
WITH CHECK (
  auth.uid() IS NOT NULL AND (
    public.is_super_admin(auth.uid())
    OR public.is_owner_or_manager_in_tenant(auth.uid(), tenant_id)
    OR (public.is_recruiter(auth.uid()) AND public.get_user_tenant_id(auth.uid()) = tenant_id)
  )
);

CREATE POLICY "Client users view their own job shares"
ON public.job_client_shares FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND client_org_id = public.client_org_for_user(auth.uid())
);

-- 5. RLS — candidate_client_shares
CREATE POLICY "Internal staff manage candidate shares in tenant"
ON public.candidate_client_shares FOR ALL
TO authenticated
USING (
  auth.uid() IS NOT NULL AND (
    public.is_super_admin(auth.uid())
    OR public.is_owner_or_manager_in_tenant(auth.uid(), tenant_id)
    OR (public.is_recruiter(auth.uid()) AND public.get_user_tenant_id(auth.uid()) = tenant_id)
  )
)
WITH CHECK (
  auth.uid() IS NOT NULL AND (
    public.is_super_admin(auth.uid())
    OR public.is_owner_or_manager_in_tenant(auth.uid(), tenant_id)
    OR (public.is_recruiter(auth.uid()) AND public.get_user_tenant_id(auth.uid()) = tenant_id)
  )
);

CREATE POLICY "Client users view their own candidate shares"
ON public.candidate_client_shares FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND client_org_id = public.client_org_for_user(auth.uid())
  AND status = 'shared'
);

-- 6. Extend RLS on jobs / candidates / job_candidates so client users can read shared rows
--    (existing internal policies remain unchanged)

CREATE POLICY "Client users can view shared jobs"
ON public.jobs FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND public.client_can_see_job(auth.uid(), id)
);

CREATE POLICY "Client users can view shared job_candidates"
ON public.job_candidates FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND public.client_can_see_candidate(auth.uid(), id)
);

CREATE POLICY "Client users can view candidates via shared job_candidates"
ON public.candidates FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.job_candidates jc
    JOIN public.candidate_client_shares ccs ON ccs.job_candidate_id = jc.id
    WHERE jc.candidate_id = candidates.id
      AND ccs.client_org_id = public.client_org_for_user(auth.uid())
      AND ccs.status = 'shared'
  )
);
