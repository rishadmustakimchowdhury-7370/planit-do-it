
-- ============================================
-- FIX CHAT_CONVERSATIONS SECURITY ISSUES
-- ============================================

-- Drop ALL problematic policies on chat_conversations
DROP POLICY IF EXISTS "Visitors can view their own conversations" ON public.chat_conversations;
DROP POLICY IF EXISTS "Visitors can update their own conversations" ON public.chat_conversations;
DROP POLICY IF EXISTS "Visitors can view their own conversation" ON public.chat_conversations;
DROP POLICY IF EXISTS "Visitors can view own conversations" ON public.chat_conversations;
DROP POLICY IF EXISTS "Visitors can update their own conversation" ON public.chat_conversations;
DROP POLICY IF EXISTS "Visitors can create chat conversations" ON public.chat_conversations;
DROP POLICY IF EXISTS "Authenticated staff can view tenant conversations" ON public.chat_conversations;
DROP POLICY IF EXISTS "Authenticated staff can update tenant conversations" ON public.chat_conversations;
DROP POLICY IF EXISTS "Authenticated users can view chat conversations in their tenant" ON public.chat_conversations;
DROP POLICY IF EXISTS "Authenticated users can update chat conversations in their tena" ON public.chat_conversations;

-- IMPORTANT: For anonymous chat, we need to use RPC functions ONLY
-- No direct table access for anonymous users - they must use secure functions

-- Policy: Only authenticated users (staff/admins) can view conversations in their tenant
CREATE POLICY "Staff can view tenant conversations"
ON public.chat_conversations FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL 
  AND (
    is_super_admin(auth.uid()) 
    OR EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.id = auth.uid() 
        AND p.tenant_id = chat_conversations.tenant_id 
        AND p.is_active = true
    )
  )
);

-- Policy: Only authenticated users can update conversations
CREATE POLICY "Staff can update tenant conversations"
ON public.chat_conversations FOR UPDATE
TO authenticated
USING (
  auth.uid() IS NOT NULL 
  AND (
    is_super_admin(auth.uid()) 
    OR EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.id = auth.uid() 
        AND p.tenant_id = chat_conversations.tenant_id 
        AND p.is_active = true
    )
  )
);

-- ============================================
-- FIX EMAIL_ACCOUNTS - Exclude sensitive columns from SELECT
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Authenticated users can view their own email accounts" ON public.email_accounts;
DROP POLICY IF EXISTS "Authenticated users can manage their own email accounts" ON public.email_accounts;

-- Recreate with proper security - SELECT only non-sensitive columns conceptually
-- (RLS can't filter columns, but we ensure only owner/super_admin access)
CREATE POLICY "Users can view own email accounts"
ON public.email_accounts FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL 
  AND (user_id = auth.uid() OR is_super_admin(auth.uid()))
);

-- Separate policies for INSERT, UPDATE, DELETE
CREATE POLICY "Users can insert own email accounts"
ON public.email_accounts FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND user_id = auth.uid()
);

CREATE POLICY "Users can update own email accounts"
ON public.email_accounts FOR UPDATE
TO authenticated
USING (
  auth.uid() IS NOT NULL 
  AND (user_id = auth.uid() OR is_super_admin(auth.uid()))
);

CREATE POLICY "Users can delete own email accounts"
ON public.email_accounts FOR DELETE
TO authenticated
USING (
  auth.uid() IS NOT NULL 
  AND (user_id = auth.uid() OR is_super_admin(auth.uid()))
);
