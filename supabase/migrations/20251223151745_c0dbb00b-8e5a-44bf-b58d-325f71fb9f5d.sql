-- Fix is_super_admin function to NOT treat 'owner' as super_admin
-- Owner role is for agency owners, super_admin is only for platform administrators

CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id 
      AND role = 'super_admin'
  )
$function$;