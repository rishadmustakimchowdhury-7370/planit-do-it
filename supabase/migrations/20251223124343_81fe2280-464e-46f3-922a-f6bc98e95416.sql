-- Fix user creation errors by matching ON CONFLICT targets to the existing unique constraint
-- user_roles has UNIQUE (user_id, role, tenant_id) via constraint: user_roles_user_id_role_tenant_id_key

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
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
    ON CONFLICT ON CONSTRAINT user_roles_user_id_role_tenant_id_key DO NOTHING;

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
    ON CONFLICT ON CONSTRAINT user_roles_user_id_role_tenant_id_key DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;


CREATE OR REPLACE FUNCTION public.fix_invited_user_profile(p_user_id uuid, p_email text, p_invitation_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_invitation record;
BEGIN
  -- Get the invitation
  SELECT * INTO v_invitation
  FROM public.team_invitations
  WHERE id = p_invitation_id;

  IF v_invitation IS NOT NULL THEN
    -- Create or update the profile
    INSERT INTO public.profiles (id, email, full_name, tenant_id, is_active)
    VALUES (
      p_user_id,
      p_email,
      split_part(p_email, '@', 1),
      v_invitation.tenant_id,
      true
    )
    ON CONFLICT (id) DO UPDATE
    SET
      email = p_email,
      tenant_id = v_invitation.tenant_id,
      is_active = true;

    -- Delete any old roles from wrong tenants
    DELETE FROM public.user_roles
    WHERE user_id = p_user_id
      AND tenant_id != v_invitation.tenant_id;

    -- Add the invited role
    INSERT INTO public.user_roles (user_id, role, tenant_id)
    VALUES (p_user_id, v_invitation.role::app_role, v_invitation.tenant_id)
    ON CONFLICT ON CONSTRAINT user_roles_user_id_role_tenant_id_key DO UPDATE
    SET tenant_id = EXCLUDED.tenant_id;

    -- Mark invitation as accepted
    UPDATE public.team_invitations
    SET
      status = 'accepted',
      accepted_at = now(),
      accepted_by = p_user_id
    WHERE id = p_invitation_id;
  END IF;
END;
$function$;


CREATE OR REPLACE FUNCTION public.promote_to_super_admin(user_email text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid;
BEGIN
  -- Get user ID from profiles by email
  SELECT id INTO v_user_id FROM public.profiles WHERE email = user_email;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User with email % not found', user_email;
  END IF;

  -- Insert super_admin role if not exists
  INSERT INTO public.user_roles (user_id, role, tenant_id)
  VALUES (v_user_id, 'super_admin', NULL)
  ON CONFLICT ON CONSTRAINT user_roles_user_id_role_tenant_id_key DO NOTHING;
END;
$function$;