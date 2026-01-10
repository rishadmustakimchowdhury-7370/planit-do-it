-- Fix chat tables: Allow anonymous visitors to use chat via secure policies

-- =====================================================
-- 1. CHAT_CONVERSATIONS: Allow visitors to create and view their own
-- =====================================================

-- Drop any remaining problematic policies
DROP POLICY IF EXISTS "Visitors can create conversations" ON public.chat_conversations;
DROP POLICY IF EXISTS "Visitors can view own conversation" ON public.chat_conversations;

-- Allow anonymous users to INSERT new conversations
CREATE POLICY "Visitors can create chat conversations"
ON public.chat_conversations
FOR INSERT
TO anon
WITH CHECK (true);

-- Allow anonymous users to SELECT only their own conversation by visitor_id
CREATE POLICY "Visitors can view their own conversation"
ON public.chat_conversations
FOR SELECT
TO anon
USING (
  visitor_id IS NOT NULL 
  AND visitor_id = current_setting('request.headers', true)::json->>'x-visitor-id'
);

-- Allow anonymous users to UPDATE their own conversation
CREATE POLICY "Visitors can update their own conversation"
ON public.chat_conversations
FOR UPDATE
TO anon
USING (
  visitor_id IS NOT NULL 
  AND visitor_id = current_setting('request.headers', true)::json->>'x-visitor-id'
);

-- =====================================================
-- 2. CHAT_MESSAGES: Allow visitors to use their own conversation
-- =====================================================

-- Drop any remaining problematic policies
DROP POLICY IF EXISTS "Visitors can insert messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Visitors can view messages" ON public.chat_messages;

-- Allow anonymous users to INSERT messages to their own conversation
CREATE POLICY "Visitors can insert chat messages"
ON public.chat_messages
FOR INSERT
TO anon
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.chat_conversations cc
    WHERE cc.id = conversation_id
      AND cc.visitor_id IS NOT NULL
      AND cc.visitor_id = current_setting('request.headers', true)::json->>'x-visitor-id'
  )
);

-- Allow anonymous users to SELECT messages from their own conversation
CREATE POLICY "Visitors can view their chat messages"
ON public.chat_messages
FOR SELECT
TO anon
USING (
  EXISTS (
    SELECT 1 FROM public.chat_conversations cc
    WHERE cc.id = conversation_id
      AND cc.visitor_id IS NOT NULL
      AND cc.visitor_id = current_setting('request.headers', true)::json->>'x-visitor-id'
  )
);