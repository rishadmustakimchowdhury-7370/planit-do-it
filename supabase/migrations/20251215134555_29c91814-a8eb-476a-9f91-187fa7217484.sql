-- Fix email_accounts RLS policy - users should only see their own accounts
DROP POLICY IF EXISTS "Users can view email accounts in their tenant" ON email_accounts;

CREATE POLICY "Users can view their own email accounts"
ON email_accounts
FOR SELECT
USING (user_id = auth.uid() OR is_super_admin(auth.uid()));