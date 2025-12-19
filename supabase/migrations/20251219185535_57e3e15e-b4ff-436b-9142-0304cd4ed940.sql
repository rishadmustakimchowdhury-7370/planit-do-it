
-- Direct insert into profiles table
INSERT INTO public.profiles (id, email, full_name, tenant_id, is_active, created_at, updated_at)
VALUES (
  'd2a4f294-c95d-44d3-b3fb-6d6c79fa3895'::uuid,
  'mustakimchy21@gmail.com',
  'Rishad',
  '1dada3a7-49fb-4344-b70e-c50885cf3c49'::uuid,
  true,
  now(),
  now()
)
ON CONFLICT (id) DO UPDATE
SET 
  email = 'mustakimchy21@gmail.com',
  tenant_id = '1dada3a7-49fb-4344-b70e-c50885cf3c49'::uuid,
  full_name = 'Rishad',
  is_active = true,
  updated_at = now();

-- Delete old owner role and add recruiter role
DELETE FROM public.user_roles 
WHERE user_id = 'd2a4f294-c95d-44d3-b3fb-6d6c79fa3895'::uuid;

INSERT INTO public.user_roles (user_id, role, tenant_id, ai_credits_allocated, ai_credits_used)
VALUES (
  'd2a4f294-c95d-44d3-b3fb-6d6c79fa3895'::uuid,
  'recruiter'::app_role,
  '1dada3a7-49fb-4344-b70e-c50885cf3c49'::uuid,
  0,
  0
);

-- Mark invitation as accepted
UPDATE public.team_invitations
SET 
  status = 'accepted',
  accepted_at = now(),
  accepted_by = 'd2a4f294-c95d-44d3-b3fb-6d6c79fa3895'::uuid
WHERE id = '47dd4f59-7944-4cdb-b2fd-48e98dfe20a2'::uuid;
