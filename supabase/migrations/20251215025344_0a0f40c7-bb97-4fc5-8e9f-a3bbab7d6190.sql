-- Assign super_admin role to info@recruitifycrm.com
INSERT INTO public.user_roles (user_id, role, tenant_id)
SELECT '258e55f2-92c5-4a6c-9559-a76c86607a32', 'super_admin', NULL
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_roles 
  WHERE user_id = '258e55f2-92c5-4a6c-9559-a76c86607a32' AND role = 'super_admin'
);

-- Assign Agency plan to their tenant
UPDATE public.tenants 
SET 
  subscription_plan_id = '92438d61-9cde-432a-9b7c-eac1d51674d6',
  subscription_status = 'active',
  subscription_ends_at = now() + interval '1 year',
  match_credits_limit = 500,
  match_credits_remaining = 500,
  name = 'RecruitifyCRM Admin',
  updated_at = now()
WHERE id = '1dada3a7-49fb-4344-b70e-c50885cf3c49';