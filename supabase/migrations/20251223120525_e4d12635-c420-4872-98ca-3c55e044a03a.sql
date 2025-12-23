-- Update is_super_admin to properly check for super admin status
-- A super admin is identified by having the 'super_admin' role in user_roles table
-- We also treat 'owner' role as a super admin for backward compatibility

CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id 
      AND (role = 'super_admin' OR role = 'owner')
  )
$function$;