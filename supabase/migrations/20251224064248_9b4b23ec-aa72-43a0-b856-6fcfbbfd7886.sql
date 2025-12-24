
-- Promote admin@hiremetrics.co.uk to super_admin
INSERT INTO public.user_roles (user_id, role, tenant_id)
SELECT id, 'super_admin'::app_role, NULL
FROM public.profiles
WHERE email = 'admin@hiremetrics.co.uk'
ON CONFLICT ON CONSTRAINT user_roles_user_id_role_tenant_id_key DO NOTHING;
