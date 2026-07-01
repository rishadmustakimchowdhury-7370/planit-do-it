
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS is_internal boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.tenants.is_internal IS
  'True for internal QA / regression / demo workspaces. Exclude from analytics, marketing stats, and customer reporting.';

-- Tenant + auth (no triggers on tenants/auth get in the way)
DO $$
DECLARE
  v_tenant_id uuid := 'aa000000-0000-4000-8000-000000000001';
  v_owner_id  uuid := 'aa000000-0000-4000-8000-0000000000a1';
  v_rec_id    uuid := 'aa000000-0000-4000-8000-0000000000a2';
  v_starter   uuid;
  v_pw        text := crypt('HireMetrics-QA-2026!', gen_salt('bf'));
BEGIN
  SELECT id INTO v_starter FROM public.subscription_plans WHERE name='Starter' LIMIT 1;

  INSERT INTO public.tenants
    (id, name, slug, subscription_status, subscription_plan_id, is_internal, is_suspended, is_paused)
  VALUES (v_tenant_id, 'HireMetrics Internal QA', 'hiremetrics-internal-qa',
          'active', v_starter, true, false, false)
  ON CONFLICT (id) DO UPDATE
    SET name='HireMetrics Internal QA', is_internal=true,
        subscription_status='active', subscription_plan_id=EXCLUDED.subscription_plan_id,
        is_suspended=false, is_paused=false, updated_at=now();

  INSERT INTO auth.users
    (instance_id, id, aud, role, email, encrypted_password,
     email_confirmed_at, created_at, updated_at,
     raw_app_meta_data, raw_user_meta_data, is_super_admin)
  VALUES
    ('00000000-0000-0000-0000-000000000000', v_owner_id, 'authenticated', 'authenticated',
     'qa-owner@hiremetrics.internal', v_pw, now(), now(), now(),
     '{"provider":"email","providers":["email"]}'::jsonb,
     '{"full_name":"QA Owner","internal":true}'::jsonb, false),
    ('00000000-0000-0000-0000-000000000000', v_rec_id, 'authenticated', 'authenticated',
     'qa-recruiter@hiremetrics.internal', v_pw, now(), now(), now(),
     '{"provider":"email","providers":["email"]}'::jsonb,
     '{"full_name":"QA Recruiter","internal":true}'::jsonb, false)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO auth.identities
    (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  VALUES
    (gen_random_uuid(), v_owner_id, v_owner_id::text,
     jsonb_build_object('sub', v_owner_id::text, 'email', 'qa-owner@hiremetrics.internal', 'email_verified', true),
     'email', now(), now(), now()),
    (gen_random_uuid(), v_rec_id, v_rec_id::text,
     jsonb_build_object('sub', v_rec_id::text, 'email', 'qa-recruiter@hiremetrics.internal', 'email_verified', true),
     'email', now(), now(), now())
  ON CONFLICT DO NOTHING;
END $$;

-- Profiles + roles (profiles may have signup triggers; run outside DO)
ALTER TABLE public.profiles DISABLE TRIGGER USER;
INSERT INTO public.profiles (id, email, full_name, tenant_id)
VALUES
  ('aa000000-0000-4000-8000-0000000000a1', 'qa-owner@hiremetrics.internal',     'QA Owner',     'aa000000-0000-4000-8000-000000000001'),
  ('aa000000-0000-4000-8000-0000000000a2', 'qa-recruiter@hiremetrics.internal', 'QA Recruiter', 'aa000000-0000-4000-8000-000000000001')
ON CONFLICT (id) DO UPDATE SET tenant_id = EXCLUDED.tenant_id, email = EXCLUDED.email, full_name = EXCLUDED.full_name;
ALTER TABLE public.profiles ENABLE TRIGGER USER;

INSERT INTO public.user_roles (user_id, role, tenant_id)
VALUES
  ('aa000000-0000-4000-8000-0000000000a1', 'owner',     'aa000000-0000-4000-8000-000000000001'),
  ('aa000000-0000-4000-8000-0000000000a2', 'recruiter', 'aa000000-0000-4000-8000-000000000001')
ON CONFLICT DO NOTHING;

-- Seed clients / jobs / candidates with legacy triggers suspended
ALTER TABLE public.clients    DISABLE TRIGGER USER;
ALTER TABLE public.jobs       DISABLE TRIGGER USER;
ALTER TABLE public.candidates DISABLE TRIGGER USER;

INSERT INTO public.clients (tenant_id, name)
SELECT 'aa000000-0000-4000-8000-000000000001', x FROM (VALUES
  ('QA Client Alpha'), ('QA Client Beta'), ('QA Client Gamma'),
  ('QA Client Delta'), ('QA Client Epsilon')
) v(x)
WHERE NOT EXISTS (
  SELECT 1 FROM public.clients
  WHERE tenant_id = 'aa000000-0000-4000-8000-000000000001' AND name = v.x
);

INSERT INTO public.jobs (tenant_id, title)
SELECT 'aa000000-0000-4000-8000-000000000001', x FROM (VALUES
  ('QA Job — Senior Engineer'),
  ('QA Job — Product Manager'),
  ('QA Job — Account Executive')
) v(x)
WHERE NOT EXISTS (
  SELECT 1 FROM public.jobs
  WHERE tenant_id = 'aa000000-0000-4000-8000-000000000001' AND title = v.x
);

INSERT INTO public.candidates (tenant_id, full_name)
SELECT 'aa000000-0000-4000-8000-000000000001', 'QA Candidate ' || n
FROM generate_series(1,10) n
WHERE NOT EXISTS (
  SELECT 1 FROM public.candidates
  WHERE tenant_id = 'aa000000-0000-4000-8000-000000000001' AND full_name = 'QA Candidate ' || n
);

ALTER TABLE public.clients    ENABLE TRIGGER USER;
ALTER TABLE public.jobs       ENABLE TRIGGER USER;
ALTER TABLE public.candidates ENABLE TRIGGER USER;

-- Usage counters
INSERT INTO public.subscription_usage_counters
  (tenant_id, feature_key, period_start, period_end, used)
VALUES
  ('aa000000-0000-4000-8000-000000000001', 'ai_candidate_discovery', date_trunc('month', now()), date_trunc('month', now()) + interval '1 month', 5),
  ('aa000000-0000-4000-8000-000000000001', 'ai_prospect_search',     date_trunc('month', now()), date_trunc('month', now()) + interval '1 month', 3),
  ('aa000000-0000-4000-8000-000000000001', 'ai_matches_monthly',     date_trunc('month', now()), date_trunc('month', now()) + interval '1 month', 2),
  ('aa000000-0000-4000-8000-000000000001', 'ai_email_generation',    date_trunc('month', now()), date_trunc('month', now()) + interval '1 month', 4),
  ('aa000000-0000-4000-8000-000000000001', 'open_web_discovery',     date_trunc('month', now()), date_trunc('month', now()) + interval '1 month', 1)
ON CONFLICT (tenant_id, feature_key, period_start) DO NOTHING;

-- Add ONLY this workspace to the enforcement allowlist
UPDATE public.platform_settings
SET value = (
      SELECT COALESCE(jsonb_agg(DISTINCT t), '[]'::jsonb)
      FROM jsonb_array_elements_text(value || to_jsonb('aa000000-0000-4000-8000-000000000001'::text)) t
    ),
    updated_at = now()
WHERE key = 'enforcement_allowlist_tenants';
