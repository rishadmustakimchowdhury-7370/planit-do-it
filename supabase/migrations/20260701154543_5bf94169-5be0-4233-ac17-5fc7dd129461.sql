
-- ============================================================
-- FIX 1 (HIGH): Withdrawn job shares must not be visible
-- Root cause: client_can_see_job() did not filter withdrawn_at.
-- Adds AND withdrawn_at IS NULL to match candidate share pattern.
-- Backward compatible: active shares (withdrawn_at IS NULL) still visible.
-- ============================================================
CREATE OR REPLACE FUNCTION public.client_can_see_job(_user_id uuid, _job_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid;
  v_exists boolean := false;
BEGIN
  v_org := public.client_org_for_user(_user_id);
  IF v_org IS NULL THEN RETURN false; END IF;
  IF to_regclass('public.job_client_shares') IS NULL THEN RETURN false; END IF;
  EXECUTE 'SELECT EXISTS (SELECT 1 FROM public.job_client_shares WHERE job_id = $1 AND client_org_id = $2 AND withdrawn_at IS NULL)'
    INTO v_exists USING _job_id, v_org;
  RETURN v_exists;
END;
$function$;

-- ============================================================
-- FIX 2 (MEDIUM): Avatar cross-tenant read leak
-- Root cause: avatars/{user_uuid}.ext readable by any authenticated
-- user who guesses/knows a UUID from another tenant.
-- Fix: constrain SELECT to same-tenant viewers via profiles lookup.
-- Backward compatible: same-tenant viewers, owner, and super admins
-- keep read access; upload/update/delete rules unchanged.
-- ============================================================
DROP POLICY IF EXISTS "Tenant-scoped read on documents" ON storage.objects;
CREATE POLICY "Tenant-scoped read on documents"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'documents'
  AND (
    public.is_super_admin(auth.uid())
    OR (storage.foldername(name))[1] = (public.get_user_tenant_id(auth.uid()))::text
    OR (
      (storage.foldername(name))[1] = 'avatars'
      AND (
        -- Owner can always read their own avatar
        split_part(split_part(name, '/', 2), '.', 1) = auth.uid()::text
        -- Same-tenant viewers can read teammates' avatars
        OR EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id::text = split_part(split_part(name, '/', 2), '.', 1)
            AND p.tenant_id = public.get_user_tenant_id(auth.uid())
        )
      )
    )
  )
);
