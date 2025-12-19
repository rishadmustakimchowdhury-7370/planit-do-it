
-- Fix the handle_new_user trigger to:
-- 1. Make new signups owners by default
-- 2. Handle repeated signups properly (when user already exists in auth but not in profiles)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_tenant_id uuid;
  v_invitation record;
  v_user_full_name text;
  v_existing_profile record;
BEGIN
  -- Get user's full name from metadata
  v_user_full_name := COALESCE(
    NEW.raw_user_meta_data ->> 'full_name',
    split_part(NEW.email, '@', 1)
  );

  -- Check if user already has a profile (repeated signup case)
  SELECT * INTO v_existing_profile
  FROM public.profiles
  WHERE id = NEW.id;

  -- If profile already exists, just return (don't create duplicate)
  IF v_existing_profile IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Check if user was invited to a team (get the most recent valid one)
  SELECT * INTO v_invitation
  FROM public.team_invitations
  WHERE email = NEW.email
    AND status = 'pending'
    AND expires_at > now()
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_invitation IS NOT NULL THEN
    -- User was invited - use the invitation's tenant
    v_tenant_id := v_invitation.tenant_id;
    
    -- Create profile with invited tenant
    INSERT INTO public.profiles (id, email, full_name, tenant_id, is_active)
    VALUES (
      NEW.id,
      NEW.email,
      v_user_full_name,
      v_tenant_id,
      true
    )
    ON CONFLICT (id) DO UPDATE
    SET 
      tenant_id = v_tenant_id,
      full_name = v_user_full_name,
      is_active = true;
    
    -- Assign the invited role with proper user_id binding
    INSERT INTO public.user_roles (user_id, role, tenant_id, ai_credits_allocated, ai_credits_used)
    VALUES (NEW.id, v_invitation.role::app_role, v_tenant_id, 0, 0)
    ON CONFLICT (user_id, role) DO NOTHING;
    
    -- Mark ALL pending invitations for this email as accepted
    UPDATE public.team_invitations
    SET 
      status = 'accepted',
      accepted_at = now(),
      accepted_by = NEW.id
    WHERE email = NEW.email
      AND status = 'pending';
      
  ELSE
    -- Regular signup - create new tenant and make user OWNER
    INSERT INTO public.tenants (name, slug)
    VALUES (
      v_user_full_name || '''s Workspace',
      gen_random_uuid()::text
    )
    RETURNING id INTO v_tenant_id;
    
    -- Create profile
    INSERT INTO public.profiles (id, email, full_name, tenant_id, is_active)
    VALUES (
      NEW.id,
      NEW.email,
      v_user_full_name,
      v_tenant_id,
      true
    )
    ON CONFLICT (id) DO UPDATE
    SET 
      tenant_id = v_tenant_id,
      full_name = v_user_full_name,
      is_active = true;
    
    -- Assign OWNER role for their tenant (DEFAULT FOR NEW SIGNUPS)
    INSERT INTO public.user_roles (user_id, role, tenant_id, ai_credits_allocated, ai_credits_used)
    VALUES (NEW.id, 'owner'::app_role, v_tenant_id, 0, 0)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Send password reset email to mustakimchy21@gmail.com
-- They need to use the password reset flow to set a new password
-- This is the safest way to ensure they can login
