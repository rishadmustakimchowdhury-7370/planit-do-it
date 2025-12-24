-- Create a function to notify admin on new user registration
CREATE OR REPLACE FUNCTION public.notify_admin_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_tenant_name text;
BEGIN
  -- Get tenant name if available
  SELECT name INTO v_tenant_name
  FROM public.tenants
  WHERE id = NEW.tenant_id;

  -- Call the edge function via pg_net (async HTTP call)
  PERFORM net.http_post(
    url := 'https://efdvolifacsnmiinifiq.supabase.co/functions/v1/notify-admin-new-user',
    headers := jsonb_build_object(
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object(
      'user_id', NEW.id,
      'email', NEW.email,
      'full_name', NEW.full_name,
      'tenant_name', v_tenant_name,
      'source', 'direct_signup'
    )
  );

  RETURN NEW;
END;
$$;

-- Create trigger to fire on new profile creation
DROP TRIGGER IF EXISTS on_profile_created_notify_admin ON public.profiles;
CREATE TRIGGER on_profile_created_notify_admin
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_admin_new_user();