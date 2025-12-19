-- Fix team_invitations RLS policies to use correct roles
DROP POLICY IF EXISTS "Admins can manage invitations in their tenant" ON public.team_invitations;

-- Allow owners and managers to manage team invitations
CREATE POLICY "Owners and managers can manage invitations"
ON public.team_invitations FOR ALL
USING (
  tenant_id = get_user_tenant_id(auth.uid()) 
  AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager'))
  OR is_super_admin(auth.uid())
);

-- Allow owners and managers to insert invitations
CREATE POLICY "Owners and managers can invite"
ON public.team_invitations FOR INSERT
WITH CHECK (
  tenant_id = get_user_tenant_id(auth.uid())
  AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager'))
);