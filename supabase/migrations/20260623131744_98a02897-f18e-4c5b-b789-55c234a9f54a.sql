
-- Priority 1: Lock down user_roles INSERTs (privilege escalation fix)
-- Currently no explicit INSERT policy exists; only super_admin ALL covers inserts.
-- The handle_new_user trigger is SECURITY DEFINER so it is unaffected by RLS.
-- Add an explicit INSERT policy mirroring the UPDATE policy so the rule is auditable
-- and prevents any future GRANT from accidentally allowing self-elevation.

DROP POLICY IF EXISTS "Owners and managers can insert roles in their tenant" ON public.user_roles;

CREATE POLICY "Owners and managers can insert roles in their tenant"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  -- Caller must be owner/manager in the target tenant
  tenant_id IN (
    SELECT ur.tenant_id FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = ANY (ARRAY['owner'::app_role, 'manager'::app_role])
  )
  -- Only an existing owner can mint another owner
  AND (
    role <> 'owner'::app_role
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.tenant_id = user_roles.tenant_id
        AND ur.role = 'owner'::app_role
    )
  )
  -- Nobody can self-assign any role through this path
  AND user_id <> auth.uid()
  -- Nobody can mint super_admin via this policy (only the super_admin ALL policy can)
  AND role <> 'super_admin'::app_role
);
