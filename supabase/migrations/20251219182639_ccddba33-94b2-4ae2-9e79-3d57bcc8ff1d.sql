-- Phase 6: Team Management Enhancements
-- Add soft delete capability and access control

-- Add deleted_at column to profiles for soft delete
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE public.profiles 
    ADD COLUMN deleted_at timestamptz DEFAULT NULL;
  END IF;
END $$;

-- Add deleted_by column to track who deleted
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'deleted_by'
  ) THEN
    ALTER TABLE public.profiles 
    ADD COLUMN deleted_by uuid REFERENCES auth.users(id);
  END IF;
END $$;

-- Update RLS policies to exclude deleted users from normal views
DROP POLICY IF EXISTS "Users can view profiles in their tenant" ON public.profiles;

CREATE POLICY "Users can view active profiles in their tenant"
ON public.profiles FOR SELECT
USING (
  (tenant_id = get_user_tenant_id(auth.uid()) AND deleted_at IS NULL)
  OR is_owner(auth.uid())
);

-- Allow owners to see deleted profiles too
CREATE POLICY "Owners can view all profiles including deleted"
ON public.profiles FOR SELECT
USING (
  is_owner(auth.uid()) AND tenant_id = get_user_tenant_id(auth.uid())
);

-- Function to soft delete a user
CREATE OR REPLACE FUNCTION public.soft_delete_user(
  p_user_id uuid,
  p_deleted_by uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if the deleter is an owner
  IF NOT is_owner(p_deleted_by) THEN
    RAISE EXCEPTION 'Only owners can delete users';
  END IF;
  
  -- Soft delete the profile
  UPDATE public.profiles
  SET 
    deleted_at = now(),
    deleted_by = p_deleted_by,
    is_active = false
  WHERE id = p_user_id;
  
  -- Deactivate all user roles (don't delete)
  UPDATE public.user_roles
  SET tenant_id = NULL  -- Revoke access immediately
  WHERE user_id = p_user_id;
  
  RETURN true;
END;
$$;

-- Function to restore a soft-deleted user
CREATE OR REPLACE FUNCTION public.restore_user(
  p_user_id uuid,
  p_restored_by uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid;
BEGIN
  -- Check if the restorer is an owner
  IF NOT is_owner(p_restored_by) THEN
    RAISE EXCEPTION 'Only owners can restore users';
  END IF;
  
  -- Get tenant_id from profiles
  SELECT tenant_id INTO v_tenant_id
  FROM public.profiles
  WHERE id = p_user_id;
  
  -- Restore the profile
  UPDATE public.profiles
  SET 
    deleted_at = NULL,
    deleted_by = NULL,
    is_active = true
  WHERE id = p_user_id;
  
  -- Restore user roles
  UPDATE public.user_roles
  SET tenant_id = v_tenant_id
  WHERE user_id = p_user_id AND tenant_id IS NULL;
  
  RETURN true;
END;
$$;

-- Function to permanently delete a user (owner only)
CREATE OR REPLACE FUNCTION public.hard_delete_user(
  p_user_id uuid,
  p_deleted_by uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if the deleter is an owner
  IF NOT is_owner(p_deleted_by) THEN
    RAISE EXCEPTION 'Only owners can permanently delete users';
  END IF;
  
  -- Delete from user_roles first (foreign key)
  DELETE FROM public.user_roles WHERE user_id = p_user_id;
  
  -- Delete profile
  DELETE FROM public.profiles WHERE id = p_user_id;
  
  -- Note: auth.users deletion should be done via Supabase Admin API
  -- This function only handles our public schema tables
  
  RETURN true;
END;
$$;

-- Create index for soft delete queries
CREATE INDEX IF NOT EXISTS idx_profiles_deleted_at 
ON public.profiles(deleted_at) 
WHERE deleted_at IS NOT NULL;