-- Drop existing admin policy
DROP POLICY IF EXISTS "Admins can manage trusted clients" ON public.trusted_clients;

-- Create new policy that allows both super_admin and owner roles
CREATE POLICY "Admins and owners can manage trusted clients" 
ON public.trusted_clients 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() 
    AND ur.role IN ('super_admin', 'owner')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() 
    AND ur.role IN ('super_admin', 'owner')
  )
);