-- Fix critical security issues: Restrict chat tables and event_reminders

-- 1. Drop existing overly permissive policies on chat_conversations
DROP POLICY IF EXISTS "Public can view conversations" ON public.chat_conversations;
DROP POLICY IF EXISTS "Anyone can view conversations" ON public.chat_conversations;

-- 2. Create proper RLS policies for chat_conversations
-- Only authenticated users in the same tenant can view conversations
CREATE POLICY "Authenticated users can view tenant conversations"
ON public.chat_conversations
FOR SELECT
TO authenticated
USING (
  tenant_id IS NULL OR
  tenant_id = public.get_user_tenant_id(auth.uid())
);

-- Allow visitors to view their own conversations by visitor_id
CREATE POLICY "Visitors can view own conversations"
ON public.chat_conversations
FOR SELECT
TO anon
USING (
  visitor_id IS NOT NULL AND visitor_id = current_setting('request.headers', true)::json->>'x-visitor-id'
);

-- Allow new conversation creation
CREATE POLICY "Anyone can create conversations"
ON public.chat_conversations
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Allow tenant users to update conversations
CREATE POLICY "Tenant users can update conversations"
ON public.chat_conversations
FOR UPDATE
TO authenticated
USING (
  tenant_id IS NULL OR
  tenant_id = public.get_user_tenant_id(auth.uid())
);

-- 3. Drop existing overly permissive policies on chat_messages
DROP POLICY IF EXISTS "Anyone can read messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Anyone can view messages" ON public.chat_messages;

-- 4. Create proper RLS policies for chat_messages
-- Authenticated users can view messages for their tenant's conversations
CREATE POLICY "Authenticated users can view tenant messages"
ON public.chat_messages
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.chat_conversations c
    WHERE c.id = chat_messages.conversation_id
    AND (c.tenant_id IS NULL OR c.tenant_id = public.get_user_tenant_id(auth.uid()))
  )
);

-- Visitors can view messages in their own conversations
CREATE POLICY "Visitors can view own conversation messages"
ON public.chat_messages
FOR SELECT
TO anon
USING (
  EXISTS (
    SELECT 1 FROM public.chat_conversations c
    WHERE c.id = chat_messages.conversation_id
    AND c.visitor_id = current_setting('request.headers', true)::json->>'x-visitor-id'
  )
);

-- Anyone can insert messages (needed for chat functionality)
CREATE POLICY "Anyone can send messages"
ON public.chat_messages
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- 5. Fix event_reminders - add tenant isolation
DROP POLICY IF EXISTS "Allow all operations on event_reminders" ON public.event_reminders;

-- Create proper policy that checks tenant through events table
CREATE POLICY "Users can view their tenant event reminders"
ON public.event_reminders
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id = event_reminders.event_id
    AND e.tenant_id = public.get_user_tenant_id(auth.uid())
  )
);

CREATE POLICY "Users can manage their tenant event reminders"
ON public.event_reminders
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id = event_reminders.event_id
    AND e.tenant_id = public.get_user_tenant_id(auth.uid())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id = event_reminders.event_id
    AND e.tenant_id = public.get_user_tenant_id(auth.uid())
  )
);

-- Allow system/edge functions to manage reminders
CREATE POLICY "Service role can manage all reminders"
ON public.event_reminders
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);