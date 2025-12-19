-- Phase 2: Fix Team Invitation Flow
-- This migration fixes the handle_new_user() trigger to properly handle team invitations

-- Drop the existing function and trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Create improved handle_new_user function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
    );
    
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
    );
    
    -- Assign owner role for their tenant
    INSERT INTO public.user_roles (user_id, role, tenant_id)
    VALUES (NEW.id, 'owner'::app_role, v_tenant_id);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Recreate the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Add accepted_by column to team_invitations if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'team_invitations' 
    AND column_name = 'accepted_by'
  ) THEN
    ALTER TABLE public.team_invitations 
    ADD COLUMN accepted_by uuid REFERENCES auth.users(id);
  END IF;
END $$;