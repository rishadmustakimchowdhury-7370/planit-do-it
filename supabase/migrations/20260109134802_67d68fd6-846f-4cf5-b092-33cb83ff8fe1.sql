
-- =============================================================================
-- FINAL CLEANUP - Remove remaining overly permissive policies
-- =============================================================================

-- Drop old chat_conversations INSERT policies with WITH CHECK (true)
DROP POLICY IF EXISTS "Anyone can create chat conversations" ON public.chat_conversations;
DROP POLICY IF EXISTS "Anyone can create conversations" ON public.chat_conversations;
DROP POLICY IF EXISTS "Visitors can start conversations" ON public.chat_conversations;

-- Drop old chat_messages INSERT policies with WITH CHECK (true)
DROP POLICY IF EXISTS "Anyone can insert chat messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Anyone can send messages" ON public.chat_messages;

-- Drop old team_invitations policy
DROP POLICY IF EXISTS "Anyone can update invitation by token" ON public.team_invitations;
