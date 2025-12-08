-- Promote info@recruitsy.net to super_admin
INSERT INTO public.user_roles (user_id, role, tenant_id)
SELECT id, 'super_admin', NULL 
FROM public.profiles 
WHERE email = 'info@recruitsy.net'
ON CONFLICT DO NOTHING;