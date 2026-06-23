
DROP POLICY IF EXISTS "Authenticated users can view chatbot config" ON public.chatbot_config;
CREATE POLICY "Tenant scoped chatbot config read"
ON public.chatbot_config FOR SELECT TO authenticated
USING (
  tenant_id = public.get_user_tenant_id(auth.uid())
  OR public.is_super_admin(auth.uid())
);
