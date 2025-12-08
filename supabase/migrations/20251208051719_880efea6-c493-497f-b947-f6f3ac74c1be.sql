-- Create a function to seed super admin user after signup
-- Note: The actual user must be created through Supabase Auth signup
-- This function will be called via trigger to assign super_admin role

-- First, let's create a function that can be called to promote a user to super_admin
CREATE OR REPLACE FUNCTION public.promote_to_super_admin(user_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  ON CONFLICT (user_id, role) DO NOTHING;
END;
$$;