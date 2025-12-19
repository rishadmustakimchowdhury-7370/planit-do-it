
-- Fix the handle_new_user trigger to properly handle invited users
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
BEGIN
  -- Get user's full name from metadata
  v_user_full_name := COALESCE(
    NEW.raw_user_meta_data ->> 'full_name',
    split_part(NEW.email, '@', 1)
  );

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
    INSERT INTO public.user_roles (user_id, role, tenant_id)
    VALUES (NEW.id, v_invitation.role::app_role, v_tenant_id)
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
    -- Regular signup - create new tenant for owner
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
    
    -- Assign owner role for their tenant
    INSERT INTO public.user_roles (user_id, role, tenant_id)
    VALUES (NEW.id, 'owner'::app_role, v_tenant_id);
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Now fix the existing mustakimchy21@gmail.com user by manually creating their profile
-- First get the user_id from auth.users via the invitation
DO $$
DECLARE
  v_user_id uuid;
  v_invitation record;
BEGIN
  -- Get the most recent pending invitation
  SELECT * INTO v_invitation
  FROM public.team_invitations
  WHERE email = 'mustakimchy21@gmail.com'
    AND status = 'pending'
  ORDER BY created_at DESC
  LIMIT 1;

  -- The user_id from the auth logs
  v_user_id := 'd2a4f294-c95d-44d3-b3fb-6d6c79fa3895'::uuid;

  IF v_invitation IS NOT NULL THEN
    -- Create the missing profile
    INSERT INTO public.profiles (id, email, full_name, tenant_id, is_active)
    VALUES (
      v_user_id,
      'mustakimchy21@gmail.com',
      'Rishad',
      v_invitation.tenant_id,
      true
    )
    ON CONFLICT (id) DO UPDATE
    SET 
      tenant_id = v_invitation.tenant_id,
      is_active = true;
    
    -- Assign the role
    INSERT INTO public.user_roles (user_id, role, tenant_id)
    VALUES (v_user_id, v_invitation.role::app_role, v_invitation.tenant_id)
    ON CONFLICT (user_id, role) DO NOTHING;
    
    -- Mark invitation as accepted
    UPDATE public.team_invitations
    SET 
      status = 'accepted',
      accepted_at = now(),
      accepted_by = v_user_id
    WHERE email = 'mustakimchy21@gmail.com'
      AND status = 'pending';
  END IF;
END $$;
