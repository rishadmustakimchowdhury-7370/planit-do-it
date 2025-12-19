-- Phase 1B: Migrate role data (without unique constraint due to existing duplicates)

-- Step 1: Clean up duplicates - keep only one role per user (prioritize owner > admin > recruiter)
DELETE FROM public.user_roles a
WHERE a.id NOT IN (
  SELECT id FROM (
    SELECT DISTINCT ON (user_id) id, user_id, role,
      CASE 
        WHEN role::text = 'super_admin' THEN 1
        WHEN role::text = 'admin' THEN 2
        WHEN role::text = 'manager' THEN 3
        WHEN role::text = 'recruiter' THEN 4
        ELSE 5
      END as priority
    FROM public.user_roles
    ORDER BY user_id, priority, created_at
  ) sub
);

-- Step 2: Migrate existing roles in user_roles table
-- super_admin → owner
UPDATE public.user_roles
SET role = 'owner'
WHERE role::text = 'super_admin';

-- admin → owner (consolidating to single owner role as per PRD)
UPDATE public.user_roles
SET role = 'owner'
WHERE role::text = 'admin';

-- Step 3: Migrate roles in team_invitations table
UPDATE public.team_invitations
SET role = 'owner'
WHERE role::text = 'super_admin' OR role::text = 'admin';

-- Step 4: Create/update helper functions

CREATE OR REPLACE FUNCTION public.is_owner(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'owner'
  )
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'owner'
  )
$$;

CREATE OR REPLACE FUNCTION public.is_manager(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'manager'
  )
$$;

CREATE OR REPLACE FUNCTION public.is_recruiter(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'recruiter'
  )
$$;

CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid)
RETURNS app_role
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT role FROM public.user_roles
  WHERE user_id = _user_id
  LIMIT 1
$$;

-- Add documentation
COMMENT ON TYPE public.app_role IS 'Application roles: owner (full system access), manager (oversight without billing), recruiter (execution only)';