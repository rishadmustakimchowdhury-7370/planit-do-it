
-- Create the missing profile for mustakimchy21@gmail.com user
-- and accept the team invitation
DO $$
DECLARE
  v_user_id uuid := 'd2a4f294-c95d-44d3-b3fb-6d6c79fa3895'::uuid;
  v_invitation record;
BEGIN
  -- Get the most recent pending invitation
  SELECT * INTO v_invitation
  FROM public.team_invitations
  WHERE email = 'mustakimchy21@gmail.com'
    AND status = 'pending'
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_invitation IS NOT NULL THEN
    -- Create the profile pointing to the invited tenant
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
      email = 'mustakimchy21@gmail.com',
      tenant_id = v_invitation.tenant_id,
      is_active = true;
    
    -- Delete the old owner role from wrong tenant and add recruiter role
    DELETE FROM public.user_roles 
    WHERE user_id = v_user_id 
      AND tenant_id != v_invitation.tenant_id;
    
    -- Add the recruiter role for the invited tenant
    INSERT INTO public.user_roles (user_id, role, tenant_id)
    VALUES (v_user_id, v_invitation.role::app_role, v_invitation.tenant_id)
    ON CONFLICT (user_id, role) DO UPDATE
    SET tenant_id = v_invitation.tenant_id;
    
    -- Mark invitation as accepted
    UPDATE public.team_invitations
    SET 
      status = 'accepted',
      accepted_at = now(),
      accepted_by = v_user_id
    WHERE id = v_invitation.id;
    
    RAISE NOTICE 'Successfully created profile and accepted invitation for mustakimchy21@gmail.com';
  ELSE
    RAISE NOTICE 'No pending invitation found for mustakimchy21@gmail.com';
  END IF;
END $$;
