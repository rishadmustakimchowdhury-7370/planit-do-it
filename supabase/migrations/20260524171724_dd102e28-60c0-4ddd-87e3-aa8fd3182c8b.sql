
-- ============================================================
-- PHASE 1: Client Collaboration Portal Foundation
-- ============================================================

-- 1. Extend app_role enum with external roles
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'client_user';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'hiring_manager';

-- 2. client_organizations
CREATE TABLE IF NOT EXISTS public.client_organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  name text NOT NULL,
  logo_url text,
  primary_color text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_client_orgs_tenant ON public.client_organizations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_client_orgs_client ON public.client_organizations(client_id);

-- 3. client_portal_users
CREATE TABLE IF NOT EXISTS public.client_portal_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  client_org_id uuid NOT NULL REFERENCES public.client_organizations(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'client_user' CHECK (role IN ('client_user','hiring_manager')),
  full_name text,
  email text NOT NULL,
  title text,
  is_active boolean NOT NULL DEFAULT true,
  invited_by uuid,
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, client_org_id)
);
CREATE INDEX IF NOT EXISTS idx_cpu_user ON public.client_portal_users(user_id);
CREATE INDEX IF NOT EXISTS idx_cpu_tenant ON public.client_portal_users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cpu_org ON public.client_portal_users(client_org_id);

-- 4. client_invitations
CREATE TABLE IF NOT EXISTS public.client_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  client_org_id uuid NOT NULL REFERENCES public.client_organizations(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'client_user' CHECK (role IN ('client_user','hiring_manager')),
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32),'hex'),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','revoked','expired')),
  invited_by uuid,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at timestamptz,
  accepted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cinv_token ON public.client_invitations(token);
CREATE INDEX IF NOT EXISTS idx_cinv_email ON public.client_invitations(email);
CREATE INDEX IF NOT EXISTS idx_cinv_tenant ON public.client_invitations(tenant_id);

-- 5. Triggers: updated_at
CREATE TRIGGER trg_client_orgs_updated_at
BEFORE UPDATE ON public.client_organizations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_cpu_updated_at
BEFORE UPDATE ON public.client_portal_users
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6. Helper functions (SECURITY DEFINER, used by RLS everywhere)
CREATE OR REPLACE FUNCTION public.is_client_user(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.client_portal_users
    WHERE user_id = _user_id AND is_active = true
  );
$$;

CREATE OR REPLACE FUNCTION public.client_org_for_user(_user_id uuid)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT client_org_id FROM public.client_portal_users
  WHERE user_id = _user_id AND is_active = true
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.client_tenant_for_user(_user_id uuid)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id FROM public.client_portal_users
  WHERE user_id = _user_id AND is_active = true
  LIMIT 1;
$$;

-- Share-visibility helpers (tables created in Phase 2; these are forward-declared safely)
CREATE OR REPLACE FUNCTION public.client_can_see_job(_user_id uuid, _job_id uuid)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_exists boolean := false;
BEGIN
  v_org := public.client_org_for_user(_user_id);
  IF v_org IS NULL THEN RETURN false; END IF;
  IF to_regclass('public.job_client_shares') IS NULL THEN RETURN false; END IF;
  EXECUTE 'SELECT EXISTS (SELECT 1 FROM public.job_client_shares WHERE job_id = $1 AND client_org_id = $2)'
    INTO v_exists USING _job_id, v_org;
  RETURN v_exists;
END;
$$;

CREATE OR REPLACE FUNCTION public.client_can_see_candidate(_user_id uuid, _job_candidate_id uuid)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_exists boolean := false;
BEGIN
  v_org := public.client_org_for_user(_user_id);
  IF v_org IS NULL THEN RETURN false; END IF;
  IF to_regclass('public.candidate_client_shares') IS NULL THEN RETURN false; END IF;
  EXECUTE 'SELECT EXISTS (SELECT 1 FROM public.candidate_client_shares WHERE job_candidate_id = $1 AND client_org_id = $2 AND status = ''shared'')'
    INTO v_exists USING _job_candidate_id, v_org;
  RETURN v_exists;
END;
$$;

-- 7. Enable RLS
ALTER TABLE public.client_organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_portal_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_invitations ENABLE ROW LEVEL SECURITY;

-- 8. RLS policies — client_organizations
CREATE POLICY "Internal staff manage client orgs in tenant"
ON public.client_organizations FOR ALL
TO authenticated
USING (
  auth.uid() IS NOT NULL AND (
    public.is_super_admin(auth.uid())
    OR public.is_owner_or_manager_in_tenant(auth.uid(), tenant_id)
  )
)
WITH CHECK (
  auth.uid() IS NOT NULL AND (
    public.is_super_admin(auth.uid())
    OR public.is_owner_or_manager_in_tenant(auth.uid(), tenant_id)
  )
);

CREATE POLICY "Client users can view their own org"
ON public.client_organizations FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND id = public.client_org_for_user(auth.uid())
);

-- 9. RLS policies — client_portal_users
CREATE POLICY "Internal staff manage portal users in tenant"
ON public.client_portal_users FOR ALL
TO authenticated
USING (
  auth.uid() IS NOT NULL AND (
    public.is_super_admin(auth.uid())
    OR public.is_owner_or_manager_in_tenant(auth.uid(), tenant_id)
  )
)
WITH CHECK (
  auth.uid() IS NOT NULL AND (
    public.is_super_admin(auth.uid())
    OR public.is_owner_or_manager_in_tenant(auth.uid(), tenant_id)
  )
);

CREATE POLICY "Client users can view themselves"
ON public.client_portal_users FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL AND user_id = auth.uid());

-- 10. RLS policies — client_invitations
CREATE POLICY "Internal staff manage invitations in tenant"
ON public.client_invitations FOR ALL
TO authenticated
USING (
  auth.uid() IS NOT NULL AND (
    public.is_super_admin(auth.uid())
    OR public.is_owner_or_manager_in_tenant(auth.uid(), tenant_id)
  )
)
WITH CHECK (
  auth.uid() IS NOT NULL AND (
    public.is_super_admin(auth.uid())
    OR public.is_owner_or_manager_in_tenant(auth.uid(), tenant_id)
  )
);

-- Accept-invitation lookup (token-based, equivalent to team_invitations pattern)
CREATE OR REPLACE FUNCTION public.get_client_invitation_by_token(p_token text)
RETURNS TABLE (
  id uuid, email text, role text, tenant_id uuid, client_org_id uuid,
  status text, expires_at timestamptz, invited_by uuid
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ci.id, ci.email, ci.role, ci.tenant_id, ci.client_org_id,
         ci.status, ci.expires_at, ci.invited_by
  FROM public.client_invitations ci
  WHERE ci.token = p_token
    AND ci.status = 'pending'
    AND ci.expires_at > now()
  LIMIT 1;
$$;
