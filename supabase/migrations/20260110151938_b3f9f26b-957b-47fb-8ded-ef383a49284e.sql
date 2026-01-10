-- Fix Security Issues: Restrict public access to sensitive tables

-- =====================================================
-- 1. FIX TEAM_INVITATIONS: Remove public table scan access
-- =====================================================

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Anyone can view invitation by token" ON public.team_invitations;

-- Create a secure token-based lookup function (prevents table scanning)
CREATE OR REPLACE FUNCTION public.get_invitation_by_token(p_token text)
RETURNS TABLE (
  id uuid,
  email text,
  role text,
  tenant_id uuid,
  status text,
  expires_at timestamptz,
  invited_by uuid
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    ti.id,
    ti.email,
    ti.role,
    ti.tenant_id,
    ti.status,
    ti.expires_at,
    ti.invited_by
  FROM public.team_invitations ti
  WHERE ti.token = p_token
    AND ti.status = 'pending'
    AND ti.expires_at > now()
  LIMIT 1;
$$;

-- Grant execute permission to anonymous users
GRANT EXECUTE ON FUNCTION public.get_invitation_by_token(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_invitation_by_token(text) TO authenticated;

-- =====================================================
-- 2. FIX CHAT_MESSAGES: Require authentication or valid conversation ownership
-- =====================================================

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Anyone can view chat messages in their conversation" ON public.chat_messages;

-- Create secure function to check conversation ownership
CREATE OR REPLACE FUNCTION public.owns_chat_conversation(p_conversation_id uuid, p_visitor_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.chat_conversations
    WHERE id = p_conversation_id
      AND visitor_id = p_visitor_id
  );
$$;

-- Policy: Authenticated users in tenant can view messages
CREATE POLICY "Authenticated users can view chat messages in their tenant"
ON public.chat_messages
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.chat_conversations cc
    JOIN public.profiles p ON p.tenant_id = cc.tenant_id
    WHERE cc.id = chat_messages.conversation_id
      AND p.id = auth.uid()
      AND p.is_active = true
  )
);

-- Policy: Visitors can only view their own conversation messages (using visitor_id header)
-- This is handled server-side via edge functions, not direct table access

-- =====================================================
-- 3. Additional hardening for chat_conversations
-- =====================================================

-- Drop overly permissive policies on chat_conversations
DROP POLICY IF EXISTS "Anyone can create chat conversation" ON public.chat_conversations;
DROP POLICY IF EXISTS "Anyone can view their own chat conversation" ON public.chat_conversations;
DROP POLICY IF EXISTS "Anyone can update their own chat conversation" ON public.chat_conversations;

-- Create secure function for visitor conversation access
CREATE OR REPLACE FUNCTION public.create_chat_conversation(
  p_visitor_id text,
  p_visitor_name text DEFAULT NULL,
  p_visitor_email text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conversation_id uuid;
BEGIN
  INSERT INTO public.chat_conversations (
    visitor_id,
    visitor_name,
    visitor_email,
    status,
    is_bot_handled,
    started_at
  ) VALUES (
    p_visitor_id,
    p_visitor_name,
    p_visitor_email,
    'active',
    true,
    now()
  )
  RETURNING id INTO v_conversation_id;
  
  RETURN v_conversation_id;
END;
$$;

-- Grant execute to anon for creating conversations
GRANT EXECUTE ON FUNCTION public.create_chat_conversation(text, text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.create_chat_conversation(text, text, text) TO authenticated;

-- Secure function to get visitor's conversation
CREATE OR REPLACE FUNCTION public.get_visitor_conversation(p_visitor_id text)
RETURNS TABLE (
  id uuid,
  visitor_id text,
  visitor_name text,
  visitor_email text,
  status text,
  is_bot_handled boolean,
  started_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    cc.id,
    cc.visitor_id,
    cc.visitor_name,
    cc.visitor_email,
    cc.status::text,
    cc.is_bot_handled,
    cc.started_at
  FROM public.chat_conversations cc
  WHERE cc.visitor_id = p_visitor_id
    AND cc.status IN ('active', 'escalated')
  ORDER BY cc.started_at DESC
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_visitor_conversation(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_visitor_conversation(text) TO authenticated;

-- Secure function to add message to conversation (validates ownership)
CREATE OR REPLACE FUNCTION public.add_chat_message(
  p_conversation_id uuid,
  p_visitor_id text,
  p_message text,
  p_sender_type text DEFAULT 'visitor'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_message_id uuid;
  v_valid boolean;
BEGIN
  -- Validate visitor owns this conversation
  SELECT EXISTS (
    SELECT 1 FROM public.chat_conversations
    WHERE id = p_conversation_id
      AND visitor_id = p_visitor_id
  ) INTO v_valid;
  
  IF NOT v_valid THEN
    RAISE EXCEPTION 'Unauthorized: conversation does not belong to visitor';
  END IF;
  
  INSERT INTO public.chat_messages (
    conversation_id,
    message,
    sender_type
  ) VALUES (
    p_conversation_id,
    p_message,
    p_sender_type
  )
  RETURNING id INTO v_message_id;
  
  RETURN v_message_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_chat_message(uuid, text, text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.add_chat_message(uuid, text, text, text) TO authenticated;

-- Secure function to get messages for a conversation (validates ownership)
CREATE OR REPLACE FUNCTION public.get_chat_messages(
  p_conversation_id uuid,
  p_visitor_id text
)
RETURNS TABLE (
  id uuid,
  message text,
  sender_type text,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_valid boolean;
BEGIN
  -- Validate visitor owns this conversation
  SELECT EXISTS (
    SELECT 1 FROM public.chat_conversations
    WHERE id = p_conversation_id
      AND visitor_id = p_visitor_id
  ) INTO v_valid;
  
  IF NOT v_valid THEN
    RAISE EXCEPTION 'Unauthorized: conversation does not belong to visitor';
  END IF;
  
  RETURN QUERY
  SELECT 
    cm.id,
    cm.message,
    cm.sender_type,
    cm.created_at
  FROM public.chat_messages cm
  WHERE cm.conversation_id = p_conversation_id
  ORDER BY cm.created_at ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_chat_messages(uuid, text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_chat_messages(uuid, text) TO authenticated;

-- Authenticated tenant members can manage conversations
CREATE POLICY "Authenticated users can view chat conversations in their tenant"
ON public.chat_conversations
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.tenant_id = chat_conversations.tenant_id
      AND p.is_active = true
  )
  OR tenant_id IS NULL -- Allow viewing unassigned conversations for super admins
);

CREATE POLICY "Authenticated users can update chat conversations in their tenant"
ON public.chat_conversations
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.tenant_id = chat_conversations.tenant_id
      AND p.is_active = true
  )
);

CREATE POLICY "Authenticated users can insert chat messages in their tenant"
ON public.chat_messages
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.chat_conversations cc
    JOIN public.profiles p ON p.tenant_id = cc.tenant_id
    WHERE cc.id = chat_messages.conversation_id
      AND p.id = auth.uid()
      AND p.is_active = true
  )
);