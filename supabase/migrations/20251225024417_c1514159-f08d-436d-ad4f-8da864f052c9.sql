-- Update handle_new_user to set 7-day trial with starter package for new signups
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
  v_starter_plan_id uuid;
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

  -- Get starter plan ID for new users
  SELECT id INTO v_starter_plan_id
  FROM public.subscription_plans
  WHERE slug = 'starter' AND is_active = true
  LIMIT 1;

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
    -- Regular signup - create new tenant with 7-day trial and starter package
    INSERT INTO public.tenants (
      name, 
      slug, 
      subscription_status, 
      subscription_plan_id,
      trial_expires_at,
      trial_days
    )
    VALUES (
      v_user_full_name || '''s Workspace',
      gen_random_uuid()::text,
      'trial',
      v_starter_plan_id,
      now() + interval '7 days',
      7
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