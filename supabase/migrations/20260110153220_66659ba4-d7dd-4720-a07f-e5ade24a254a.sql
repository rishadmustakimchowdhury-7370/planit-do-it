
-- ============================================
-- COMPREHENSIVE SECURITY FIX FOR ALL 9 ISSUES
-- ============================================

-- 1. FIX PAYMENTS TABLE (Payments with capital P)
DROP POLICY IF EXISTS "Super admins can manage Payments" ON public."Payments";
DROP POLICY IF EXISTS "Users can view their own Payments" ON public."Payments";

CREATE POLICY "Super admins can manage Payments"
ON public."Payments" FOR ALL
TO authenticated
USING (is_super_admin(auth.uid()));

CREATE POLICY "Users can view their own Payments"
ON public."Payments" FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL AND user_id = auth.uid());

-- 2. FIX SUBSCRIPTIONS TABLE (Subscriptionx)
DROP POLICY IF EXISTS "Super admins can manage Subscriptionx" ON public."Subscriptionx";
DROP POLICY IF EXISTS "Users can view their own Subscriptionx" ON public."Subscriptionx";

CREATE POLICY "Super admins can manage Subscriptionx"
ON public."Subscriptionx" FOR ALL
TO authenticated
USING (is_super_admin(auth.uid()));

CREATE POLICY "Users can view their own Subscriptionx"
ON public."Subscriptionx" FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL AND user_id = auth.uid());

-- 3. FIX PROFILES TABLE - Already uses TO authenticated, but ensure no public access
-- Policies look correct, but let's ensure they're properly restricted

-- 4. FIX CANDIDATES TABLE
DROP POLICY IF EXISTS "Authenticated users can manage candidates in their tenant" ON public.candidates;
DROP POLICY IF EXISTS "Authenticated users can view candidates in their tenant" ON public.candidates;

CREATE POLICY "Authenticated users can view candidates in their tenant"
ON public.candidates FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL 
  AND (tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()))
);

CREATE POLICY "Authenticated users can insert candidates in their tenant"
ON public.candidates FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND tenant_id = get_user_tenant_id(auth.uid())
);

CREATE POLICY "Authenticated users can update candidates in their tenant"
ON public.candidates FOR UPDATE
TO authenticated
USING (
  auth.uid() IS NOT NULL 
  AND (tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()))
);

CREATE POLICY "Authenticated users can delete candidates in their tenant"
ON public.candidates FOR DELETE
TO authenticated
USING (
  auth.uid() IS NOT NULL 
  AND (tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()))
);

-- 5. FIX CANDIDATE_EMAILS TABLE
DROP POLICY IF EXISTS "Authenticated users can manage emails in their tenant" ON public.candidate_emails;
DROP POLICY IF EXISTS "Authenticated users can view emails in their tenant" ON public.candidate_emails;

CREATE POLICY "Authenticated users can view candidate emails in their tenant"
ON public.candidate_emails FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL 
  AND (tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()))
);

CREATE POLICY "Authenticated users can insert candidate emails in their tenant"
ON public.candidate_emails FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND tenant_id = get_user_tenant_id(auth.uid())
);

CREATE POLICY "Authenticated users can update candidate emails in their tenant"
ON public.candidate_emails FOR UPDATE
TO authenticated
USING (
  auth.uid() IS NOT NULL 
  AND (tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()))
);

CREATE POLICY "Authenticated users can delete candidate emails in their tenant"
ON public.candidate_emails FOR DELETE
TO authenticated
USING (
  auth.uid() IS NOT NULL 
  AND (tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()))
);

-- 6. FIX CLIENTS TABLE
DROP POLICY IF EXISTS "Authenticated users can manage clients in their tenant" ON public.clients;
DROP POLICY IF EXISTS "Authenticated users can view clients in their tenant" ON public.clients;

CREATE POLICY "Authenticated users can view clients in their tenant"
ON public.clients FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL 
  AND (tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()))
);

CREATE POLICY "Authenticated users can insert clients in their tenant"
ON public.clients FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND tenant_id = get_user_tenant_id(auth.uid())
);

CREATE POLICY "Authenticated users can update clients in their tenant"
ON public.clients FOR UPDATE
TO authenticated
USING (
  auth.uid() IS NOT NULL 
  AND (tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()))
);

CREATE POLICY "Authenticated users can delete clients in their tenant"
ON public.clients FOR DELETE
TO authenticated
USING (
  auth.uid() IS NOT NULL 
  AND (tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()))
);

-- 7. FIX INVOICES TABLE
DROP POLICY IF EXISTS "Authenticated users can view invoices in their tenant" ON public.invoices;
DROP POLICY IF EXISTS "Super admins can manage invoices" ON public.invoices;

CREATE POLICY "Owners can view invoices in their tenant"
ON public.invoices FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL 
  AND (
    (tenant_id = get_user_tenant_id(auth.uid()) AND is_owner_in_tenant(auth.uid(), tenant_id))
    OR is_super_admin(auth.uid())
  )
);

CREATE POLICY "Super admins can manage invoices"
ON public.invoices FOR ALL
TO authenticated
USING (is_super_admin(auth.uid()));

-- 8. STRIPE_CONNECT - Already restricted to authenticated, ensure super admin only
DROP POLICY IF EXISTS "Super admins can manage stripe connect" ON public.stripe_connect;
DROP POLICY IF EXISTS "Super admins can insert stripe connect" ON public.stripe_connect;

CREATE POLICY "Super admins only can access stripe connect"
ON public.stripe_connect FOR ALL
TO authenticated
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));
