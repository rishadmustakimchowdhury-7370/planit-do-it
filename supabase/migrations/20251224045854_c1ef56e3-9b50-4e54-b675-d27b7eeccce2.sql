-- Add DELETE policy for user_roles so owners and managers can remove team members
CREATE POLICY "Owners and managers can delete roles in their tenant"
ON public.user_roles
FOR DELETE
TO authenticated
USING (
  tenant_id IN (
    SELECT ur.tenant_id 
    FROM user_roles ur 
    WHERE ur.user_id = auth.uid() 
    AND ur.role IN ('owner', 'manager')
  )
  AND (
    -- Managers cannot delete owners
    role != 'owner' 
    OR EXISTS (
      SELECT 1 FROM user_roles ur 
      WHERE ur.user_id = auth.uid() 
      AND ur.tenant_id = user_roles.tenant_id 
      AND ur.role = 'owner'
    )
  )
);

-- Add DELETE policy for profiles so owners and managers can delete team members
CREATE POLICY "Owners and managers can delete profiles in their tenant"
ON public.profiles
FOR DELETE
TO authenticated
USING (
  tenant_id IN (
    SELECT ur.tenant_id 
    FROM user_roles ur 
    WHERE ur.user_id = auth.uid() 
    AND ur.role IN ('owner', 'manager')
  )
);