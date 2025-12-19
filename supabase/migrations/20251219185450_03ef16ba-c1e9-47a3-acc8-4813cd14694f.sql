
-- Create a security definer function to fix the user profile and invitation
CREATE OR REPLACE FUNCTION public.fix_invited_user_profile(
  p_user_id uuid,
  p_email text,
  p_invitation_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
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
    ON CONFLICT (user_id, role) DO UPDATE
    SET tenant_id = v_invitation.tenant_id;
    
    -- Mark invitation as accepted
    UPDATE public.team_invitations
    SET 
      status = 'accepted',
      accepted_at = now(),
      accepted_by = p_user_id
    WHERE id = p_invitation_id;
  END IF;
END;
$$;

-- Now call the function to fix the mustakimchy21@gmail.com user
SELECT public.fix_invited_user_profile(
  'd2a4f294-c95d-44d3-b3fb-6d6c79fa3895'::uuid,
  'mustakimchy21@gmail.com',
  '47dd4f59-7944-4cdb-b2fd-48e98dfe20a2'::uuid
);
