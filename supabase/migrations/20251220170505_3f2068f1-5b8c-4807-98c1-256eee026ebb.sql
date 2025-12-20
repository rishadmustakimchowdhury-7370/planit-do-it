-- Fix user_permissions foreign key to reference profiles instead of auth.users
-- Drop the existing foreign key constraints
ALTER TABLE public.user_permissions 
DROP CONSTRAINT IF EXISTS user_permissions_user_id_fkey;

ALTER TABLE public.user_permissions 
DROP CONSTRAINT IF EXISTS user_permissions_granted_by_fkey;

-- Add new foreign key constraints referencing profiles table
ALTER TABLE public.user_permissions 
ADD CONSTRAINT user_permissions_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.user_permissions 
ADD CONSTRAINT user_permissions_granted_by_fkey 
FOREIGN KEY (granted_by) REFERENCES public.profiles(id) ON DELETE SET NULL;