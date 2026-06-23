
-- 1. branding-assets bucket: tenant-scoped writes
DROP POLICY IF EXISTS "Authenticated users can upload branding assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update branding assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete branding assets" ON storage.objects;

CREATE POLICY "Branding assets tenant-scoped insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'branding-assets'
  AND (
    public.is_super_admin(auth.uid())
    OR (
      (storage.foldername(name))[1] = 'finance-logos'
      AND (storage.foldername(name))[2] = public.get_user_tenant_id(auth.uid())::text
    )
  )
);

CREATE POLICY "Branding assets tenant-scoped update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'branding-assets'
  AND (
    public.is_super_admin(auth.uid())
    OR (
      (storage.foldername(name))[1] = 'finance-logos'
      AND (storage.foldername(name))[2] = public.get_user_tenant_id(auth.uid())::text
    )
  )
);

CREATE POLICY "Branding assets tenant-scoped delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'branding-assets'
  AND (
    public.is_super_admin(auth.uid())
    OR (
      (storage.foldername(name))[1] = 'finance-logos'
      AND (storage.foldername(name))[2] = public.get_user_tenant_id(auth.uid())::text
    )
  )
);

-- 2. trusted-clients bucket: super admin only writes
DROP POLICY IF EXISTS "Admins can upload trusted client logos" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update trusted client logos" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete trusted client logos" ON storage.objects;

CREATE POLICY "Super admins can upload trusted client logos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'trusted-clients' AND public.is_super_admin(auth.uid()));

CREATE POLICY "Super admins can update trusted client logos"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'trusted-clients' AND public.is_super_admin(auth.uid()));

CREATE POLICY "Super admins can delete trusted client logos"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'trusted-clients' AND public.is_super_admin(auth.uid()));

-- 3. email_templates: authenticated only
DROP POLICY IF EXISTS "Anyone can view active templates" ON public.email_templates;
CREATE POLICY "Authenticated users can view active email templates"
ON public.email_templates FOR SELECT TO authenticated
USING (is_active = true);

-- 4. whatsapp_templates: authenticated only
DROP POLICY IF EXISTS "Anyone can view active templates" ON public.whatsapp_templates;
CREATE POLICY "Authenticated users can view active whatsapp templates"
ON public.whatsapp_templates FOR SELECT TO authenticated
USING (is_active = true);

-- 5. chatbot_config: authenticated only
DROP POLICY IF EXISTS "Authenticated users can view chatbot config" ON public.chatbot_config;
CREATE POLICY "Authenticated users can view chatbot config"
ON public.chatbot_config FOR SELECT TO authenticated
USING (auth.uid() IS NOT NULL);

-- 6. realtime.messages: require authentication for channel subscriptions
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can subscribe to realtime" ON realtime.messages;
CREATE POLICY "Authenticated users can subscribe to realtime"
ON realtime.messages FOR SELECT TO authenticated
USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can broadcast to realtime" ON realtime.messages;
CREATE POLICY "Authenticated users can broadcast to realtime"
ON realtime.messages FOR INSERT TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);
