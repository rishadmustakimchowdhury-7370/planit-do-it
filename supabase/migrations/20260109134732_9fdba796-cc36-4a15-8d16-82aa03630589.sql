
-- =============================================================================
-- FINAL SECURITY HARDENING - Fix remaining critical issues (Part 2 - Fixed)
-- =============================================================================

-- 4. FIX TESTIMONIALS - Require basic validation, not fully public
DROP POLICY IF EXISTS "Anyone can submit testimonials" ON public.testimonials;
DROP POLICY IF EXISTS "Anyone can submit testimonials with valid data" ON public.testimonials;

-- Testimonials require at least author_name and quote
CREATE POLICY "Anyone can submit testimonials with valid data"
ON public.testimonials
FOR INSERT
TO public
WITH CHECK (
  author_name IS NOT NULL AND 
  author_name != '' AND
  quote IS NOT NULL AND 
  quote != ''
);

-- 5. FIX AUDIT_LOG - System insert should use service role, not public
DROP POLICY IF EXISTS "System can insert audit log" ON public.audit_log;
DROP POLICY IF EXISTS "Service role can insert audit log" ON public.audit_log;

-- Only super admins or service role (from edge functions) can insert audit logs
CREATE POLICY "Service role can insert audit log"
ON public.audit_log
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL AND
  public.is_super_admin(auth.uid())
);

-- 6. FIX CREDIT_TRANSACTIONS - System insert should require auth
DROP POLICY IF EXISTS "System can insert transactions" ON public.credit_transactions;
DROP POLICY IF EXISTS "System can insert credit transactions" ON public.credit_transactions;

CREATE POLICY "System can insert credit transactions"
ON public.credit_transactions
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL AND
  public.user_belongs_to_tenant(auth.uid(), tenant_id)
);

-- 7. FIX DEMO_BOOKINGS - Add basic validation
DROP POLICY IF EXISTS "Anyone can submit demo booking" ON public.demo_bookings;
DROP POLICY IF EXISTS "Anyone can submit demo booking with valid data" ON public.demo_bookings;

CREATE POLICY "Anyone can submit demo booking with valid data"
ON public.demo_bookings
FOR INSERT
TO public
WITH CHECK (
  email IS NOT NULL AND 
  email != '' AND
  name IS NOT NULL AND
  name != ''
);

-- 8. ADD POLICIES FOR SUBSCRIPTIONS TABLE (has user_id, not tenant_id)
ALTER TABLE IF EXISTS public.subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view their tenant subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Super admins can manage subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Users can view their own subscriptions" ON public.subscriptions;

CREATE POLICY "Users can view their own subscriptions"
ON public.subscriptions
FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL AND
  auth.uid() = user_id
);

CREATE POLICY "Super admins can manage subscriptions"
ON public.subscriptions
FOR ALL
TO authenticated
USING (
  auth.uid() IS NOT NULL AND
  public.is_super_admin(auth.uid())
)
WITH CHECK (
  auth.uid() IS NOT NULL AND
  public.is_super_admin(auth.uid())
);
