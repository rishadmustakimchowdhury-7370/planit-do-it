-- Fix handle_new_user trigger to update ALL pending invitations for the email
-- This prevents duplicate invitations from staying in pending status

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_tenant_id uuid;
  v_invitation record;
BEGIN
  -- Check if user was invited to a team (get the most recent one)
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
    INSERT INTO public.profiles (id, email, full_name, tenant_id)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data ->> 'full_name', split_part(NEW.email, '@', 1)),
      v_tenant_id
    );
    
    -- Assign the invited role (not admin)
    INSERT INTO public.user_roles (user_id, role, tenant_id)
    VALUES (NEW.id, v_invitation.role, v_tenant_id);
    
    -- Mark ALL pending invitations for this email as accepted (not just one)
    UPDATE public.team_invitations
    SET status = 'accepted',
        accepted_at = now()
    WHERE email = NEW.email
      AND status = 'pending';
  ELSE
    -- Regular signup - create new tenant
    INSERT INTO public.tenants (name, slug)
    VALUES (
      COALESCE(NEW.raw_user_meta_data ->> 'full_name', split_part(NEW.email, '@', 1)) || '''s Workspace',
      gen_random_uuid()::text
    )
    RETURNING id INTO v_tenant_id;
    
    -- Create profile
    INSERT INTO public.profiles (id, email, full_name, tenant_id)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data ->> 'full_name', split_part(NEW.email, '@', 1)),
      v_tenant_id
    );
    
    -- Assign admin role for their tenant
    INSERT INTO public.user_roles (user_id, role, tenant_id)
    VALUES (NEW.id, 'admin', v_tenant_id);
  END IF;
  
  RETURN NEW;
END;
$function$;