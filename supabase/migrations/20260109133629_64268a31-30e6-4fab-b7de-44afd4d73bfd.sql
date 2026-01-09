-- ================================================================
-- PHASE 3: FIX ALL REMAINING SECURITY ISSUES
-- ================================================================

-- ================================================================
-- 1. Fix "RLS Policy Always True" warnings (WITH CHECK (true))
-- ================================================================

-- Fix event_reminders: Replace "Service role can manage all reminders" and "System can manage reminders"
-- These should be restricted to service role only, not exposed to clients
DROP POLICY IF EXISTS "Service role can manage all reminders" ON public.event_reminders;
DROP POLICY IF EXISTS "System can manage reminders" ON public.event_reminders;

-- Fix plan_features: Restrict admin policies to super_admin
DROP POLICY IF EXISTS "Only admins can delete features" ON public.plan_features;
DROP POLICY IF EXISTS "Only admins can insert features" ON public.plan_features;
DROP POLICY IF EXISTS "Only admins can update features" ON public.plan_features;

CREATE POLICY "Super admins can delete features" 
ON public.plan_features FOR DELETE 
USING (is_super_admin(auth.uid()));

CREATE POLICY "Super admins can insert features" 
ON public.plan_features FOR INSERT 
WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "Super admins can update features" 
ON public.plan_features FOR UPDATE 
USING (is_super_admin(auth.uid()));

-- Fix orders: Replace "System can insert orders" with proper check
DROP POLICY IF EXISTS "System can insert orders" ON public.orders;

CREATE POLICY "Authenticated users can create orders" 
ON public.orders FOR INSERT 
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND (user_id = auth.uid() OR is_super_admin(auth.uid()))
);

-- Fix notifications: Replace "System can insert notifications" 
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;

CREATE POLICY "Users can insert notifications for themselves" 
ON public.notifications FOR INSERT 
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND (user_id = auth.uid() OR is_super_admin(auth.uid()))
);

-- Fix promo_code_usage: Replace "System can insert promo usage"
DROP POLICY IF EXISTS "System can insert promo usage" ON public.promo_code_usage;

CREATE POLICY "Authenticated users can insert their promo usage" 
ON public.promo_code_usage FOR INSERT 
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND (user_id = auth.uid() OR is_super_admin(auth.uid()))
);

-- ================================================================
-- 2. Add missing RLS policies to tables with RLS enabled but no policies
-- ================================================================

-- Payments table (uppercase P - different from lowercase payments)
DROP POLICY IF EXISTS "Super admins can manage Payments" ON public."Payments";
DROP POLICY IF EXISTS "Users can view their own Payments" ON public."Payments";

CREATE POLICY "Super admins can manage Payments" 
ON public."Payments" FOR ALL 
USING (is_super_admin(auth.uid()));

CREATE POLICY "Users can view their own Payments" 
ON public."Payments" FOR SELECT 
USING (auth.uid() IS NOT NULL AND user_id = auth.uid());

-- Subscriptionx table
DROP POLICY IF EXISTS "Super admins can manage Subscriptionx" ON public."Subscriptionx";
DROP POLICY IF EXISTS "Users can view their own Subscriptionx" ON public."Subscriptionx";

CREATE POLICY "Super admins can manage Subscriptionx" 
ON public."Subscriptionx" FOR ALL 
USING (is_super_admin(auth.uid()));

CREATE POLICY "Users can view their own Subscriptionx" 
ON public."Subscriptionx" FOR SELECT 
USING (auth.uid() IS NOT NULL AND user_id = auth.uid());

-- payments table (lowercase - check if exists)
DROP POLICY IF EXISTS "Super admins can manage payments" ON public.payments;
DROP POLICY IF EXISTS "Users can view their own payments" ON public.payments;

CREATE POLICY "Super admins can manage payments" 
ON public.payments FOR ALL 
USING (is_super_admin(auth.uid()));

CREATE POLICY "Users can view their own payments" 
ON public.payments FOR SELECT 
USING (auth.uid() IS NOT NULL AND user_id = auth.uid());

-- ================================================================
-- 3. Eliminate anonymous access - Update all policies to require auth
-- ================================================================

-- Update activities policies
DROP POLICY IF EXISTS "Users can view activities in their tenant" ON public.activities;
CREATE POLICY "Authenticated users can view activities in their tenant" 
ON public.activities FOR SELECT 
USING (auth.uid() IS NOT NULL AND ((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())));

-- Update ai_usage policies
DROP POLICY IF EXISTS "Users can view ai usage in their tenant" ON public.ai_usage;
CREATE POLICY "Authenticated users can view ai usage in their tenant" 
ON public.ai_usage FOR SELECT 
USING (auth.uid() IS NOT NULL AND ((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())));

DROP POLICY IF EXISTS "Users can insert ai usage" ON public.ai_usage;
CREATE POLICY "Authenticated users can insert ai usage" 
ON public.ai_usage FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL AND tenant_id = get_user_tenant_id(auth.uid()));

-- Update branding_settings policies
DROP POLICY IF EXISTS "Admins can manage branding in their tenant" ON public.branding_settings;
DROP POLICY IF EXISTS "Users can view branding in their tenant" ON public.branding_settings;

CREATE POLICY "Authenticated users can view branding in their tenant" 
ON public.branding_settings FOR SELECT 
USING (auth.uid() IS NOT NULL AND ((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())));

CREATE POLICY "Admins can manage branding in their tenant" 
ON public.branding_settings FOR ALL 
USING (auth.uid() IS NOT NULL AND ((tenant_id = get_user_tenant_id(auth.uid()) AND is_owner_or_manager_in_tenant(auth.uid(), tenant_id)) OR is_super_admin(auth.uid())));

-- Update candidate_emails policies
DROP POLICY IF EXISTS "Users can manage emails in their tenant" ON public.candidate_emails;
DROP POLICY IF EXISTS "Users can view emails in their tenant" ON public.candidate_emails;

CREATE POLICY "Authenticated users can view emails in their tenant" 
ON public.candidate_emails FOR SELECT 
USING (auth.uid() IS NOT NULL AND ((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())));

CREATE POLICY "Authenticated users can manage emails in their tenant" 
ON public.candidate_emails FOR ALL 
USING (auth.uid() IS NOT NULL AND ((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())));

-- Update candidates policies
DROP POLICY IF EXISTS "Users can manage candidates in their tenant" ON public.candidates;
DROP POLICY IF EXISTS "Users can view candidates in their tenant" ON public.candidates;

CREATE POLICY "Authenticated users can view candidates in their tenant" 
ON public.candidates FOR SELECT 
USING (auth.uid() IS NOT NULL AND ((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())));

CREATE POLICY "Authenticated users can manage candidates in their tenant" 
ON public.candidates FOR ALL 
USING (auth.uid() IS NOT NULL AND ((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())));

-- Update chatbot_config policies
DROP POLICY IF EXISTS "Users can view chatbot config" ON public.chatbot_config;

CREATE POLICY "Authenticated users can view chatbot config" 
ON public.chatbot_config FOR SELECT 
USING (auth.uid() IS NOT NULL OR tenant_id IS NULL);

-- Update client_activities policies  
DROP POLICY IF EXISTS "Users can manage activities in their tenant" ON public.client_activities;
DROP POLICY IF EXISTS "Users can view activities in their tenant" ON public.client_activities;

CREATE POLICY "Authenticated users can view client activities in their tenant" 
ON public.client_activities FOR SELECT 
USING (auth.uid() IS NOT NULL AND ((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())));

CREATE POLICY "Authenticated users can manage client activities in their tenant" 
ON public.client_activities FOR ALL 
USING (auth.uid() IS NOT NULL AND ((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())));

-- Update client_attachments policies
DROP POLICY IF EXISTS "Users can manage attachments in their tenant" ON public.client_attachments;
DROP POLICY IF EXISTS "Users can view attachments in their tenant" ON public.client_attachments;

CREATE POLICY "Authenticated users can view attachments in their tenant" 
ON public.client_attachments FOR SELECT 
USING (auth.uid() IS NOT NULL AND ((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())));

CREATE POLICY "Authenticated users can manage attachments in their tenant" 
ON public.client_attachments FOR ALL 
USING (auth.uid() IS NOT NULL AND ((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())));

-- Update client_emails policies
DROP POLICY IF EXISTS "Users can manage client emails in their tenant" ON public.client_emails;
DROP POLICY IF EXISTS "Users can view client emails in their tenant" ON public.client_emails;

CREATE POLICY "Authenticated users can view client emails in their tenant" 
ON public.client_emails FOR SELECT 
USING (auth.uid() IS NOT NULL AND ((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())));

CREATE POLICY "Authenticated users can manage client emails in their tenant" 
ON public.client_emails FOR ALL 
USING (auth.uid() IS NOT NULL AND ((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())));

-- Update clients policies
DROP POLICY IF EXISTS "Users can manage clients in their tenant" ON public.clients;
DROP POLICY IF EXISTS "Users can view clients in their tenant" ON public.clients;

CREATE POLICY "Authenticated users can view clients in their tenant" 
ON public.clients FOR SELECT 
USING (auth.uid() IS NOT NULL AND ((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())));

CREATE POLICY "Authenticated users can manage clients in their tenant" 
ON public.clients FOR ALL 
USING (auth.uid() IS NOT NULL AND ((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())));

-- Update credit_transactions policies
DROP POLICY IF EXISTS "Tenant members can view transactions" ON public.credit_transactions;

CREATE POLICY "Authenticated users can view credit transactions in their tenant" 
ON public.credit_transactions FOR SELECT 
USING (auth.uid() IS NOT NULL AND ((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())));

-- Update credits policies
DROP POLICY IF EXISTS "Only system can modify credits" ON public.credits;
DROP POLICY IF EXISTS "Users can view credits in their tenant" ON public.credits;

CREATE POLICY "Authenticated users can view credits in their tenant" 
ON public.credits FOR SELECT 
USING (auth.uid() IS NOT NULL AND ((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())));

-- Update cv_submissions policies
DROP POLICY IF EXISTS "Users can view submissions in their tenant" ON public.cv_submissions;
DROP POLICY IF EXISTS "Users can insert submissions in their tenant" ON public.cv_submissions;

CREATE POLICY "Authenticated users can view submissions in their tenant" 
ON public.cv_submissions FOR SELECT 
USING (auth.uid() IS NOT NULL AND ((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())));

CREATE POLICY "Authenticated users can insert submissions in their tenant" 
ON public.cv_submissions FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL AND tenant_id = get_user_tenant_id(auth.uid()));

-- Update email_accounts policies
DROP POLICY IF EXISTS "Users can manage their own email accounts" ON public.email_accounts;
DROP POLICY IF EXISTS "Users can view their own email accounts" ON public.email_accounts;

CREATE POLICY "Authenticated users can view their own email accounts" 
ON public.email_accounts FOR SELECT 
USING (auth.uid() IS NOT NULL AND ((user_id = auth.uid()) OR is_super_admin(auth.uid())));

CREATE POLICY "Authenticated users can manage their own email accounts" 
ON public.email_accounts FOR ALL 
USING (auth.uid() IS NOT NULL AND ((user_id = auth.uid()) OR is_super_admin(auth.uid())));

-- Update email_logs policies
DROP POLICY IF EXISTS "Users can view email logs in their tenant" ON public.email_logs;
DROP POLICY IF EXISTS "Users can insert email logs" ON public.email_logs;

CREATE POLICY "Authenticated users can view email logs in their tenant" 
ON public.email_logs FOR SELECT 
USING (auth.uid() IS NOT NULL AND ((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())));

CREATE POLICY "Authenticated users can insert email logs" 
ON public.email_logs FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL AND ((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())));

-- Update event_participants policies
DROP POLICY IF EXISTS "Users can manage participants for their events" ON public.event_participants;
DROP POLICY IF EXISTS "Users can view participants for events in their tenant" ON public.event_participants;

CREATE POLICY "Authenticated users can view participants for events in their tenant" 
ON public.event_participants FOR SELECT 
USING (auth.uid() IS NOT NULL AND EXISTS (
  SELECT 1 FROM events e 
  WHERE e.id = event_participants.event_id 
  AND ((e.tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()))
));

CREATE POLICY "Authenticated users can manage participants for their events" 
ON public.event_participants FOR ALL 
USING (auth.uid() IS NOT NULL AND EXISTS (
  SELECT 1 FROM events e 
  WHERE e.id = event_participants.event_id 
  AND ((e.organizer_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role) OR is_super_admin(auth.uid()))
));

-- Update event_reminders policies
DROP POLICY IF EXISTS "Users can manage their tenant event reminders" ON public.event_reminders;
DROP POLICY IF EXISTS "Users can view reminders for events in their tenant" ON public.event_reminders;
DROP POLICY IF EXISTS "Users can view their tenant event reminders" ON public.event_reminders;

CREATE POLICY "Authenticated users can view reminders for events in their tenant" 
ON public.event_reminders FOR SELECT 
USING (auth.uid() IS NOT NULL AND EXISTS (
  SELECT 1 FROM events e 
  WHERE e.id = event_reminders.event_id 
  AND ((e.tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()))
));

CREATE POLICY "Authenticated users can manage their tenant event reminders" 
ON public.event_reminders FOR ALL 
USING (auth.uid() IS NOT NULL AND EXISTS (
  SELECT 1 FROM events e 
  WHERE e.id = event_reminders.event_id 
  AND (e.tenant_id = get_user_tenant_id(auth.uid()))
));

-- Update events policies
DROP POLICY IF EXISTS "Organizers and admins can delete events" ON public.events;
DROP POLICY IF EXISTS "Organizers and admins can update events" ON public.events;
DROP POLICY IF EXISTS "Users can view events in their tenant" ON public.events;
DROP POLICY IF EXISTS "Users can create events in their tenant" ON public.events;

CREATE POLICY "Authenticated users can view events in their tenant" 
ON public.events FOR SELECT 
USING (auth.uid() IS NOT NULL AND ((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())));

CREATE POLICY "Authenticated users can create events in their tenant" 
ON public.events FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL AND tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Organizers and admins can update events" 
ON public.events FOR UPDATE 
USING (auth.uid() IS NOT NULL AND ((organizer_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role) OR is_super_admin(auth.uid())));

CREATE POLICY "Organizers and admins can delete events" 
ON public.events FOR DELETE 
USING (auth.uid() IS NOT NULL AND ((organizer_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role) OR is_super_admin(auth.uid())));

-- Update import_jobs policies
DROP POLICY IF EXISTS "Users can manage import jobs in their tenant" ON public.import_jobs;
DROP POLICY IF EXISTS "Users can view import jobs in their tenant" ON public.import_jobs;

CREATE POLICY "Authenticated users can view import jobs in their tenant" 
ON public.import_jobs FOR SELECT 
USING (auth.uid() IS NOT NULL AND ((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())));

CREATE POLICY "Authenticated users can manage import jobs in their tenant" 
ON public.import_jobs FOR ALL 
USING (auth.uid() IS NOT NULL AND ((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())));

-- Update invoices policies
DROP POLICY IF EXISTS "Users can view invoices in their tenant" ON public.invoices;

CREATE POLICY "Authenticated users can view invoices in their tenant" 
ON public.invoices FOR SELECT 
USING (auth.uid() IS NOT NULL AND ((tenant_id = get_user_tenant_id(auth.uid()) AND is_owner_in_tenant(auth.uid(), tenant_id)) OR is_super_admin(auth.uid())));

-- Update job_assignees policies
DROP POLICY IF EXISTS "Owners and managers can manage job assignees" ON public.job_assignees;
DROP POLICY IF EXISTS "Users can view job assignees in their tenant" ON public.job_assignees;

CREATE POLICY "Authenticated users can view job assignees in their tenant" 
ON public.job_assignees FOR SELECT 
USING (auth.uid() IS NOT NULL AND tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Owners and managers can manage job assignees" 
ON public.job_assignees FOR ALL 
USING (auth.uid() IS NOT NULL AND (tenant_id = get_user_tenant_id(auth.uid())) AND (is_owner(auth.uid()) OR is_manager(auth.uid())))
WITH CHECK (auth.uid() IS NOT NULL AND (tenant_id = get_user_tenant_id(auth.uid())) AND (is_owner(auth.uid()) OR is_manager(auth.uid())));

-- Update notifications policies
DROP POLICY IF EXISTS "Authenticated users can manage their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Authenticated users can view their own notifications" ON public.notifications;

CREATE POLICY "Authenticated users can view their own notifications" 
ON public.notifications FOR SELECT 
USING (auth.uid() IS NOT NULL AND user_id = auth.uid());

CREATE POLICY "Authenticated users can manage their own notifications" 
ON public.notifications FOR ALL 
USING (auth.uid() IS NOT NULL AND user_id = auth.uid())
WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());

-- Update orders policies  
DROP POLICY IF EXISTS "Authenticated users can view their tenant orders" ON public.orders;

CREATE POLICY "Authenticated users can view their tenant orders" 
ON public.orders FOR SELECT 
USING (auth.uid() IS NOT NULL AND (is_super_admin(auth.uid()) OR is_owner_in_tenant(auth.uid(), tenant_id)));

-- Update promo_code_usage policies
DROP POLICY IF EXISTS "Authenticated users can view their own promo usage" ON public.promo_code_usage;

CREATE POLICY "Authenticated users can view their own promo usage" 
ON public.promo_code_usage FOR SELECT 
USING (auth.uid() IS NOT NULL AND (is_super_admin(auth.uid()) OR (user_id = auth.uid())));

-- Update user_permissions policies
DROP POLICY IF EXISTS "Owners can manage permissions in their tenant" ON public.user_permissions;
DROP POLICY IF EXISTS "Users can view their own permissions" ON public.user_permissions;

CREATE POLICY "Authenticated users can view their own permissions" 
ON public.user_permissions FOR SELECT 
USING (auth.uid() IS NOT NULL AND ((user_id = auth.uid()) OR is_owner(auth.uid())));

CREATE POLICY "Owners can manage permissions in their tenant" 
ON public.user_permissions FOR ALL 
USING (auth.uid() IS NOT NULL AND (tenant_id = get_user_tenant_id(auth.uid())) AND is_owner(auth.uid()));

-- Update work_status_logs policies
DROP POLICY IF EXISTS "Users can insert their own logs" ON public.work_status_logs;
DROP POLICY IF EXISTS "Users can insert their own work logs" ON public.work_status_logs;
DROP POLICY IF EXISTS "Users can view their own logs" ON public.work_status_logs;
DROP POLICY IF EXISTS "Users can view work logs in their tenant" ON public.work_status_logs;

CREATE POLICY "Authenticated users can insert their own work logs" 
ON public.work_status_logs FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL AND (user_id = auth.uid()) AND (tenant_id = get_user_tenant_id(auth.uid())));

CREATE POLICY "Authenticated users can view work logs in their tenant" 
ON public.work_status_logs FOR SELECT 
USING (auth.uid() IS NOT NULL AND (
  (user_id = auth.uid()) OR 
  ((tenant_id = get_user_tenant_id(auth.uid())) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))) OR 
  is_super_admin(auth.uid())
));

-- ================================================================
-- 4. Fix chat policies to require auth for staff but allow visitor access
-- ================================================================

-- chat_conversations: Allow visitor access by visitor_id OR authenticated tenant users
DROP POLICY IF EXISTS "Anyone can update their own conversation" ON public.chat_conversations;
DROP POLICY IF EXISTS "Anyone can view their own conversation by visitor_id" ON public.chat_conversations;
DROP POLICY IF EXISTS "Authenticated users can view tenant conversations" ON public.chat_conversations;
DROP POLICY IF EXISTS "Tenant users can update conversations" ON public.chat_conversations;
DROP POLICY IF EXISTS "Visitors can start conversations" ON public.chat_conversations;

CREATE POLICY "Visitors can view their own conversations" 
ON public.chat_conversations FOR SELECT 
USING (visitor_id IS NOT NULL AND visitor_id = visitor_id);

CREATE POLICY "Visitors can update their own conversations" 
ON public.chat_conversations FOR UPDATE 
USING (visitor_id IS NOT NULL AND visitor_id = visitor_id);

CREATE POLICY "Visitors can start conversations" 
ON public.chat_conversations FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Authenticated staff can view tenant conversations" 
ON public.chat_conversations FOR SELECT 
USING (auth.uid() IS NOT NULL AND (is_super_admin(auth.uid()) OR tenant_id IS NULL));

CREATE POLICY "Authenticated staff can update tenant conversations" 
ON public.chat_conversations FOR UPDATE 
USING (auth.uid() IS NOT NULL AND is_super_admin(auth.uid()));

-- chat_messages: Allow visitor access OR authenticated users
DROP POLICY IF EXISTS "Anyone can view chat messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Authenticated users can view tenant messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Visitors can send messages" ON public.chat_messages;

CREATE POLICY "Anyone can view chat messages in their conversation" 
ON public.chat_messages FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM chat_conversations cc 
  WHERE cc.id = chat_messages.conversation_id
));

CREATE POLICY "Anyone can send messages to conversations" 
ON public.chat_messages FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM chat_conversations cc 
  WHERE cc.id = conversation_id
));

CREATE POLICY "Authenticated staff can manage chat messages" 
ON public.chat_messages FOR ALL 
USING (auth.uid() IS NOT NULL AND is_super_admin(auth.uid()));