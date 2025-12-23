-- Add RLS policy for owners and managers to update roles in their tenant
CREATE POLICY "Owners and managers can update roles in their tenant"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (
  tenant_id IN (
    SELECT ur.tenant_id 
    FROM public.user_roles ur 
    WHERE ur.user_id = auth.uid() 
    AND ur.role IN ('owner', 'manager')
  )
)
WITH CHECK (
  tenant_id IN (
    SELECT ur.tenant_id 
    FROM public.user_roles ur 
    WHERE ur.user_id = auth.uid() 
    AND ur.role IN ('owner', 'manager')
  )
  -- Prevent managers from creating owners
  AND (
    role != 'owner' 
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur 
      WHERE ur.user_id = auth.uid() 
      AND ur.tenant_id = user_roles.tenant_id 
      AND ur.role = 'owner'
    )
  )
);