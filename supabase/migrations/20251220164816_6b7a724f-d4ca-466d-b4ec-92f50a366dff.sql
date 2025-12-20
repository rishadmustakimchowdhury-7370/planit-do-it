-- Fix user_roles records with NULL tenant_id by copying from profiles
UPDATE public.user_roles ur
SET tenant_id = p.tenant_id
FROM public.profiles p
WHERE ur.user_id = p.id
  AND ur.tenant_id IS NULL
  AND p.tenant_id IS NOT NULL;