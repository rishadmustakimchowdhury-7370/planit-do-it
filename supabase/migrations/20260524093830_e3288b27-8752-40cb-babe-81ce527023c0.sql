
-- Tighten storage.objects policies on the 'documents' bucket to enforce tenant isolation.
-- File convention: '{tenant_id}/...' for tenant data, 'avatars/{user_id}.ext' for personal avatars.

DROP POLICY IF EXISTS "Users can view documents in their tenant" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload documents to their tenant folder" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own documents" ON storage.objects;

-- SELECT: only files in user's own tenant folder, own avatar, or super admin
CREATE POLICY "Tenant-scoped read on documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'documents'
  AND (
    is_super_admin(auth.uid())
    OR (storage.foldername(name))[1] = get_user_tenant_id(auth.uid())::text
    OR (
      (storage.foldername(name))[1] = 'avatars'
      AND split_part(split_part(name, '/', 2), '.', 1) = auth.uid()::text
    )
  )
);

-- INSERT: only into user's own tenant folder or own avatar
CREATE POLICY "Tenant-scoped insert on documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'documents'
  AND (
    is_super_admin(auth.uid())
    OR (storage.foldername(name))[1] = get_user_tenant_id(auth.uid())::text
    OR (
      (storage.foldername(name))[1] = 'avatars'
      AND split_part(split_part(name, '/', 2), '.', 1) = auth.uid()::text
    )
  )
);

-- UPDATE: same scope
CREATE POLICY "Tenant-scoped update on documents"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'documents'
  AND (
    is_super_admin(auth.uid())
    OR (storage.foldername(name))[1] = get_user_tenant_id(auth.uid())::text
    OR (
      (storage.foldername(name))[1] = 'avatars'
      AND split_part(split_part(name, '/', 2), '.', 1) = auth.uid()::text
    )
  )
);

-- DELETE: same scope
CREATE POLICY "Tenant-scoped delete on documents"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'documents'
  AND (
    is_super_admin(auth.uid())
    OR (storage.foldername(name))[1] = get_user_tenant_id(auth.uid())::text
    OR (
      (storage.foldername(name))[1] = 'avatars'
      AND split_part(split_part(name, '/', 2), '.', 1) = auth.uid()::text
    )
  )
);
