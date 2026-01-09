-- =====================================================
-- PHASE 2: FIX RLS POLICIES - BATCH 1 (LinkedIn & Notifications)
-- =====================================================

-- LINKEDIN_OUTREACH_CAMPAIGNS TABLE
DROP POLICY IF EXISTS "Users can view campaigns in their tenant" ON public.linkedin_outreach_campaigns;
DROP POLICY IF EXISTS "Users can manage campaigns in their tenant" ON public.linkedin_outreach_campaigns;

CREATE POLICY "Authenticated users can view campaigns in their tenant"
ON public.linkedin_outreach_campaigns FOR SELECT
TO authenticated
USING (
  public.is_super_admin(auth.uid()) OR
  public.user_belongs_to_tenant(auth.uid(), tenant_id)
);

CREATE POLICY "Authenticated users can manage campaigns in their tenant"
ON public.linkedin_outreach_campaigns FOR ALL
TO authenticated
USING (
  public.is_super_admin(auth.uid()) OR
  public.user_belongs_to_tenant(auth.uid(), tenant_id)
)
WITH CHECK (
  public.is_super_admin(auth.uid()) OR
  public.user_belongs_to_tenant(auth.uid(), tenant_id)
);

-- LINKEDIN_OUTREACH_CONSENT TABLE
DROP POLICY IF EXISTS "Users can view their own consent" ON public.linkedin_outreach_consent;
DROP POLICY IF EXISTS "Users can manage their own consent" ON public.linkedin_outreach_consent;

CREATE POLICY "Authenticated users can view their own consent"
ON public.linkedin_outreach_consent FOR SELECT
TO authenticated
USING (
  public.is_super_admin(auth.uid()) OR
  user_id = auth.uid()
);

CREATE POLICY "Authenticated users can manage their own consent"
ON public.linkedin_outreach_consent FOR ALL
TO authenticated
USING (
  public.is_super_admin(auth.uid()) OR
  user_id = auth.uid()
)
WITH CHECK (
  public.is_super_admin(auth.uid()) OR
  user_id = auth.uid()
);

-- LINKEDIN_OUTREACH_LOGS TABLE
DROP POLICY IF EXISTS "Users can view logs in their tenant" ON public.linkedin_outreach_logs;

CREATE POLICY "Authenticated users can view outreach logs in their tenant"
ON public.linkedin_outreach_logs FOR SELECT
TO authenticated
USING (
  public.is_super_admin(auth.uid()) OR
  public.user_belongs_to_tenant(auth.uid(), tenant_id)
);

-- LINKEDIN_OUTREACH_QUEUE TABLE
DROP POLICY IF EXISTS "Users can view queue items in their tenant" ON public.linkedin_outreach_queue;
DROP POLICY IF EXISTS "Users can manage queue items in their tenant" ON public.linkedin_outreach_queue;

CREATE POLICY "Authenticated users can view queue items in their tenant"
ON public.linkedin_outreach_queue FOR SELECT
TO authenticated
USING (
  public.is_super_admin(auth.uid()) OR
  public.user_belongs_to_tenant(auth.uid(), tenant_id)
);

CREATE POLICY "Authenticated users can manage queue items in their tenant"
ON public.linkedin_outreach_queue FOR ALL
TO authenticated
USING (
  public.is_super_admin(auth.uid()) OR
  public.user_belongs_to_tenant(auth.uid(), tenant_id)
)
WITH CHECK (
  public.is_super_admin(auth.uid()) OR
  public.user_belongs_to_tenant(auth.uid(), tenant_id)
);

-- NOTIFICATIONS TABLE
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can delete their own notifications" ON public.notifications;

CREATE POLICY "Authenticated users can view their own notifications"
ON public.notifications FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Authenticated users can manage their own notifications"
ON public.notifications FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- ORDERS TABLE (Admin/Finance only)
DROP POLICY IF EXISTS "Users can view their own orders" ON public.orders;
DROP POLICY IF EXISTS "Super admins can manage all orders" ON public.orders;

CREATE POLICY "Authenticated users can view their tenant orders"
ON public.orders FOR SELECT
TO authenticated
USING (
  public.is_super_admin(auth.uid()) OR
  public.is_owner_in_tenant(auth.uid(), tenant_id)
);

CREATE POLICY "Super admins can manage all orders"
ON public.orders FOR ALL
TO authenticated
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

-- PROFILES TABLE
DROP POLICY IF EXISTS "Users can view active profiles in their tenant" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Owners and managers can update profiles in their tenant" ON public.profiles;
DROP POLICY IF EXISTS "Owners and managers can delete profiles in their tenant" ON public.profiles;
DROP POLICY IF EXISTS "Owners can view all profiles including deleted" ON public.profiles;
DROP POLICY IF EXISTS "Super admins can manage all profiles" ON public.profiles;

CREATE POLICY "Authenticated users can view active profiles in their tenant"
ON public.profiles FOR SELECT
TO authenticated
USING (
  public.is_super_admin(auth.uid()) OR
  id = auth.uid() OR
  (
    tenant_id = public.get_user_tenant_id(auth.uid()) AND
    is_active = true AND
    deleted_at IS NULL
  )
);

CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

CREATE POLICY "Owners and managers can manage profiles in their tenant"
ON public.profiles FOR UPDATE
TO authenticated
USING (
  public.is_super_admin(auth.uid()) OR
  public.is_owner_or_manager_in_tenant(auth.uid(), tenant_id)
)
WITH CHECK (
  public.is_super_admin(auth.uid()) OR
  public.is_owner_or_manager_in_tenant(auth.uid(), tenant_id)
);

CREATE POLICY "Super admins can manage all profiles"
ON public.profiles FOR ALL
TO authenticated
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

-- PROMO_CODE_USAGE TABLE
DROP POLICY IF EXISTS "Users can view their own promo usage" ON public.promo_code_usage;

CREATE POLICY "Authenticated users can view their own promo usage"
ON public.promo_code_usage FOR SELECT
TO authenticated
USING (
  public.is_super_admin(auth.uid()) OR
  user_id = auth.uid()
);

-- PROMO_CODE_USES TABLE
DROP POLICY IF EXISTS "Users can view their own promo code uses" ON public.promo_code_uses;
DROP POLICY IF EXISTS "Super admins can view all promo code uses" ON public.promo_code_uses;

CREATE POLICY "Authenticated users can view their own promo code uses"
ON public.promo_code_uses FOR SELECT
TO authenticated
USING (
  public.is_super_admin(auth.uid()) OR
  user_id = auth.uid()
);

-- RECRUITER_ACTIVITIES TABLE
DROP POLICY IF EXISTS "Users can view activities in their tenant" ON public.recruiter_activities;
DROP POLICY IF EXISTS "Admins can manage all activities in tenant" ON public.recruiter_activities;

CREATE POLICY "Authenticated users can view recruiter activities in their tenant"
ON public.recruiter_activities FOR SELECT
TO authenticated
USING (
  public.is_super_admin(auth.uid()) OR
  public.user_belongs_to_tenant(auth.uid(), tenant_id)
);

CREATE POLICY "Authenticated users can manage recruiter activities in their tenant"
ON public.recruiter_activities FOR ALL
TO authenticated
USING (
  public.is_super_admin(auth.uid()) OR
  public.user_belongs_to_tenant(auth.uid(), tenant_id)
)
WITH CHECK (
  public.is_super_admin(auth.uid()) OR
  public.user_belongs_to_tenant(auth.uid(), tenant_id)
);

-- SCHEDULED_ACTIONS TABLE
DROP POLICY IF EXISTS "Super admins can manage scheduled actions" ON public.scheduled_actions;

CREATE POLICY "Super admins can manage scheduled actions"
ON public.scheduled_actions FOR ALL
TO authenticated
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

-- STRIPE_CONNECT TABLE
DROP POLICY IF EXISTS "Super admins can view stripe connect" ON public.stripe_connect;
DROP POLICY IF EXISTS "Super admins can update stripe connect" ON public.stripe_connect;

CREATE POLICY "Super admins can manage stripe connect"
ON public.stripe_connect FOR ALL
TO authenticated
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

-- SUPPORT_TICKETS TABLE
DROP POLICY IF EXISTS "Users can view tickets in their tenant" ON public.support_tickets;
DROP POLICY IF EXISTS "Support can manage tickets" ON public.support_tickets;

CREATE POLICY "Authenticated users can view tickets in their tenant"
ON public.support_tickets FOR SELECT
TO authenticated
USING (
  public.is_super_admin(auth.uid()) OR
  public.user_belongs_to_tenant(auth.uid(), tenant_id)
);

CREATE POLICY "Owners and super admins can manage tickets"
ON public.support_tickets FOR ALL
TO authenticated
USING (
  public.is_super_admin(auth.uid()) OR
  public.is_owner_in_tenant(auth.uid(), tenant_id)
)
WITH CHECK (
  public.is_super_admin(auth.uid()) OR
  public.is_owner_in_tenant(auth.uid(), tenant_id)
);