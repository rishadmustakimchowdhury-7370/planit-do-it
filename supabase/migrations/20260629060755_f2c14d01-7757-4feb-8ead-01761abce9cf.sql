
-- =========================================================
-- PHASE A: Chat hardening
-- =========================================================
-- M1 fix: remove the broad public INSERT policy that lets anyone
-- insert into ANY chat_messages row regardless of visitor_id.
DROP POLICY IF EXISTS "Anyone can send messages to conversations" ON public.chat_messages;

-- The remaining anon visitor-scoped INSERT/SELECT policies require
-- a matching x-visitor-id header. Visitor IDs are now generated
-- client-side as crypto.randomUUID() (122 bits entropy), making
-- enumeration computationally infeasible. All sensitive read/write
-- paths additionally go through SECURITY DEFINER RPCs that re-verify
-- visitor ownership.

-- =========================================================
-- PHASE B: Privilege escalation hardening
-- =========================================================

-- B1: Tighten super_admin ALL policy on user_roles with WITH CHECK.
-- Prevents a (compromised) super-admin from minting additional
-- super_admin rows directly via PostgREST. New super_admin grants
-- must go through a dedicated service-role-only RPC.
DROP POLICY IF EXISTS "Super admins can manage all roles" ON public.user_roles;
CREATE POLICY "Super admins can manage all roles"
  ON public.user_roles
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (is_super_admin(auth.uid()))
  WITH CHECK (
    is_super_admin(auth.uid())
    AND role <> 'super_admin'::app_role
  );

-- B2: Audit-logged service-role-only RPC for minting super_admin.
CREATE OR REPLACE FUNCTION public.grant_super_admin(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Only callable by service_role (edge functions / admin tooling).
  IF current_setting('role', true) <> 'service_role' THEN
    RAISE EXCEPTION 'grant_super_admin: forbidden';
  END IF;

  INSERT INTO public.user_roles (user_id, role, tenant_id)
  VALUES (_user_id, 'super_admin'::app_role, NULL)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.audit_log (action, target_type, target_id, metadata)
  VALUES ('grant_super_admin', 'user', _user_id, jsonb_build_object('granted_at', now()))
  ON CONFLICT DO NOTHING;
EXCEPTION WHEN undefined_table THEN
  -- audit_log is optional; do not fail role grant if it does not exist.
  NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.grant_super_admin(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_super_admin(uuid) TO service_role;

-- B3: demo_bookings — add explicit restrictive SELECT denying
-- non-super-admin authenticated reads. The existing super-admin
-- ALL policy still permits the right party; this just makes the
-- restriction explicit and survives any future broader policy.
DROP POLICY IF EXISTS "Block non super admin reads on demo bookings" ON public.demo_bookings;
CREATE POLICY "Block non super admin reads on demo bookings"
  ON public.demo_bookings
  AS RESTRICTIVE
  FOR SELECT
  TO authenticated, anon
  USING (is_super_admin(auth.uid()));
