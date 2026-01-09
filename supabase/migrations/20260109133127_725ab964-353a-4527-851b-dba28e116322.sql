-- =====================================================
-- PHASE 1: CREATE SECURITY FOUNDATION FUNCTIONS
-- These must exist before any policies reference them
-- =====================================================

-- Helper function to check if user belongs to a tenant
CREATE OR REPLACE FUNCTION public.user_belongs_to_tenant(_user_id uuid, _tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = _user_id 
      AND tenant_id = _tenant_id 
      AND is_active = true
      AND deleted_at IS NULL
  )
$$;

-- Helper function to check if user is owner or manager in their tenant
CREATE OR REPLACE FUNCTION public.is_owner_or_manager_in_tenant(_user_id uuid, _tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.profiles p ON p.id = ur.user_id
    WHERE ur.user_id = _user_id 
      AND ur.tenant_id = _tenant_id
      AND ur.role IN ('owner', 'manager')
      AND p.is_active = true
      AND p.deleted_at IS NULL
  )
$$;

-- Helper function to check if user is owner in their tenant
CREATE OR REPLACE FUNCTION public.is_owner_in_tenant(_user_id uuid, _tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.profiles p ON p.id = ur.user_id
    WHERE ur.user_id = _user_id 
      AND ur.tenant_id = _tenant_id
      AND ur.role = 'owner'
      AND p.is_active = true
      AND p.deleted_at IS NULL
  )
$$;