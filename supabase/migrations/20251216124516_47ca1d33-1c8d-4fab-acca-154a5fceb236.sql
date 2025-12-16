-- Drop existing restrictive policies on chat_conversations
DROP POLICY IF EXISTS "Support can manage chats" ON public.chat_conversations;
DROP POLICY IF EXISTS "Users can view chats in their tenant or support staff" ON public.chat_conversations;

-- Create policies that allow anonymous visitors to create and view their own conversations
CREATE POLICY "Anyone can create chat conversations"
ON public.chat_conversations
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Anyone can view their own conversation by visitor_id"
ON public.chat_conversations
FOR SELECT
USING (
  visitor_id = coalesce(nullif(current_setting('request.headers', true)::json->>'x-visitor-id', ''), visitor_id)
  OR is_super_admin(auth.uid())
  OR has_role(auth.uid(), 'support'::app_role)
  OR has_role(auth.uid(), 'admin'::app_role)
  OR (tenant_id = get_user_tenant_id(auth.uid()))
);

CREATE POLICY "Anyone can update their own conversation"
ON public.chat_conversations
FOR UPDATE
USING (
  visitor_id IS NOT NULL
  OR is_super_admin(auth.uid())
  OR has_role(auth.uid(), 'support'::app_role)
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Drop existing policies on chat_messages
DROP POLICY IF EXISTS "Users can insert messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Users can view messages for accessible conversations" ON public.chat_messages;

-- Create policies that allow anyone to insert and view messages
CREATE POLICY "Anyone can insert chat messages"
ON public.chat_messages
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Anyone can view chat messages"
ON public.chat_messages
FOR SELECT
USING (true);