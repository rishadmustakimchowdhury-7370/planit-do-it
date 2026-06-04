
ALTER TABLE public.scoring_weights_profiles DROP CONSTRAINT IF EXISTS scoring_weights_sum_100;
ALTER TABLE public.scoring_weights_profiles
  ADD CONSTRAINT scoring_weights_sum_100
  CHECK ((role_similarity + mandatory_skills + industry + domain + title + experience + location + education) = 100);

UPDATE public.scoring_weights_profiles SET is_active = false WHERE is_active = true;

INSERT INTO public.scoring_weights_profiles (
  tenant_id, name, is_default, is_active,
  role_similarity, mandatory_skills, domain, experience, industry, location, education, title,
  tier_highly_recommended, tier_recommended, tier_consider
)
SELECT DISTINCT t.tenant_id, 'role_first_v1', true, true,
       35, 25, 15, 10, 5, 5, 5, 0,
       85, 70, 55
FROM (
  SELECT tenant_id FROM public.jobs WHERE tenant_id IS NOT NULL
  UNION
  SELECT tenant_id FROM public.scoring_weights_profiles WHERE tenant_id IS NOT NULL
) t
WHERE NOT EXISTS (
  SELECT 1 FROM public.scoring_weights_profiles p
  WHERE p.tenant_id = t.tenant_id AND p.name = 'role_first_v1'
);

INSERT INTO public.validation_queue (tenant_id, job_id, candidate_id, status, priority, enqueued_at)
SELECT rm.tenant_id, rm.job_id, rm.candidate_id, 'pending', 10, now()
FROM public.rediscovered_matches rm
JOIN public.jobs j ON j.id = rm.job_id
WHERE j.status = 'open'
  AND rm.dismissed = false
  AND NOT EXISTS (
    SELECT 1 FROM public.validation_queue q
    WHERE q.job_id = rm.job_id AND q.candidate_id = rm.candidate_id AND q.status = 'pending'
  );
