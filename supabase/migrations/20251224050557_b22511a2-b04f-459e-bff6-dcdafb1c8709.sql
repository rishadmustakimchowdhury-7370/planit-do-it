-- Delete user roles for info@recruitifycrm.com
DELETE FROM public.user_roles 
WHERE user_id = '258e55f2-92c5-4a6c-9559-a76c86607a32';

-- Delete profile for info@recruitifycrm.com
DELETE FROM public.profiles 
WHERE id = '258e55f2-92c5-4a6c-9559-a76c86607a32';

-- Note: The auth.users record needs to be deleted via Supabase Admin API
-- This migration handles the public schema tables