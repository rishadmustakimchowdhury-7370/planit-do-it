-- Drop existing restrictive policy on credit_transactions
DROP POLICY IF EXISTS "Owners can view all transactions" ON public.credit_transactions;

-- Create new policy allowing all tenant members to view credit transactions
CREATE POLICY "Tenant members can view transactions" 
ON public.credit_transactions 
FOR SELECT 
USING (tenant_id = get_user_tenant_id(auth.uid()));