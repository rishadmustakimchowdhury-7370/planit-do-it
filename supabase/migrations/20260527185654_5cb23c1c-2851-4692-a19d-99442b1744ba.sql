-- ============================================================================
-- Placement Outcome Intelligence — schema
-- ============================================================================

CREATE TABLE public.placement_outcomes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  job_id uuid NOT NULL,
  candidate_id uuid NOT NULL,
  client_org_id uuid NULL,
  ai_validation_id uuid NULL,
  submission_id uuid NULL,
  outcome_type text NOT NULL CHECK (outcome_type IN (
    'shortlist_accepted','shortlist_rejected',
    'interview_scheduled','interview_rejected',
    'offer_extended','offer_accepted','offer_rejected',
    'placement_succeeded','placement_failed',
    'candidate_withdrew'
  )),
  outcome_reason text NULL,
  outcome_reason_category text NULL CHECK (
    outcome_reason_category IS NULL OR outcome_reason_category IN (
      'compensation','culture_fit','experience_gap','tenure',
      'ecosystem_mismatch','overqualified','timing','client_silence','other'
    )
  ),
  source text NOT NULL DEFAULT 'manual' CHECK (source IN (
    'manual','submission_event','client_portal','recruiter_override','stage_change'
  )),
  recorded_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_placement_outcomes_tenant ON public.placement_outcomes(tenant_id, created_at DESC);
CREATE INDEX idx_placement_outcomes_jc ON public.placement_outcomes(job_id, candidate_id);
CREATE INDEX idx_placement_outcomes_client ON public.placement_outcomes(client_org_id) WHERE client_org_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.placement_outcomes TO authenticated;
GRANT ALL ON public.placement_outcomes TO service_role;

ALTER TABLE public.placement_outcomes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant members read outcomes" ON public.placement_outcomes
  FOR SELECT TO authenticated
  USING (public.user_belongs_to_tenant(auth.uid(), tenant_id) OR public.is_super_admin(auth.uid()));

CREATE POLICY "tenant members write outcomes" ON public.placement_outcomes
  FOR INSERT TO authenticated
  WITH CHECK (public.user_belongs_to_tenant(auth.uid(), tenant_id));

CREATE POLICY "tenant managers update outcomes" ON public.placement_outcomes
  FOR UPDATE TO authenticated
  USING (public.is_owner_or_manager_in_tenant(auth.uid(), tenant_id) OR recorded_by = auth.uid());

CREATE POLICY "tenant managers delete outcomes" ON public.placement_outcomes
  FOR DELETE TO authenticated
  USING (public.is_owner_or_manager_in_tenant(auth.uid(), tenant_id));


CREATE TABLE public.outcome_learning_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  scope text NOT NULL CHECK (scope IN ('tenant','client','recruiter')),
  client_org_id uuid NULL,
  recruiter_id uuid NULL,
  signal_type text NOT NULL CHECK (signal_type IN (
    'ecosystem_uplift','ecosystem_penalty','tenure_pattern',
    'adjacent_path_winning','adjacent_path_losing',
    'recruiter_strategy_wins','client_prefers','client_rejects'
  )),
  signal_key text NOT NULL,
  weight numeric(5,3) NOT NULL DEFAULT 0,
  sample_size integer NOT NULL DEFAULT 0,
  confidence text NOT NULL DEFAULT 'low' CHECK (confidence IN ('low','medium','high')),
  human_basis text NULL,
  last_observed_at timestamptz NOT NULL DEFAULT now(),
  refreshed_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_outcome_signals ON public.outcome_learning_signals (
  tenant_id, scope,
  COALESCE(client_org_id, '00000000-0000-0000-0000-000000000000'::uuid),
  COALESCE(recruiter_id, '00000000-0000-0000-0000-000000000000'::uuid),
  signal_type, signal_key
);
CREATE INDEX idx_outcome_signals_lookup ON public.outcome_learning_signals(tenant_id, scope, signal_type);

GRANT SELECT ON public.outcome_learning_signals TO authenticated;
GRANT ALL ON public.outcome_learning_signals TO service_role;

ALTER TABLE public.outcome_learning_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant members read signals" ON public.outcome_learning_signals
  FOR SELECT TO authenticated
  USING (public.user_belongs_to_tenant(auth.uid(), tenant_id) OR public.is_super_admin(auth.uid()));


CREATE TABLE public.client_preference_profile (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  client_org_id uuid NOT NULL,
  preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
  sample_size integer NOT NULL DEFAULT 0,
  confidence text NOT NULL DEFAULT 'low' CHECK (confidence IN ('low','medium','high')),
  refreshed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, client_org_id)
);

GRANT SELECT ON public.client_preference_profile TO authenticated;
GRANT ALL ON public.client_preference_profile TO service_role;

ALTER TABLE public.client_preference_profile ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant members read client prefs" ON public.client_preference_profile
  FOR SELECT TO authenticated
  USING (public.user_belongs_to_tenant(auth.uid(), tenant_id) OR public.is_super_admin(auth.uid()));


ALTER TABLE public.candidate_submissions
  ADD COLUMN IF NOT EXISTS outcome_status text NULL,
  ADD COLUMN IF NOT EXISTS outcome_recorded_at timestamptz NULL;

ALTER TABLE public.ai_candidate_validations
  ADD COLUMN IF NOT EXISTS placement_calibration jsonb NULL;


CREATE OR REPLACE FUNCTION public.recruiter_intelligence_summary(_tenant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_tenant uuid;
  v_funnel jsonb;
  v_ecosystems jsonb;
  v_paths jsonb;
  v_recruiters jsonb;
  v_clients jsonb;
BEGIN
  v_caller_tenant := public.get_user_tenant_id(auth.uid());
  IF NOT (public.is_super_admin(auth.uid()) OR v_caller_tenant = _tenant_id) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  IF NOT (
    public.is_super_admin(auth.uid()) OR
    public.has_role(auth.uid(), 'owner') OR
    public.has_role(auth.uid(), 'manager') OR
    public.has_role(auth.uid(), 'recruiter')
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT jsonb_build_object(
    'shortlist_accepted', COUNT(*) FILTER (WHERE outcome_type = 'shortlist_accepted'),
    'shortlist_rejected', COUNT(*) FILTER (WHERE outcome_type = 'shortlist_rejected'),
    'interview_scheduled', COUNT(*) FILTER (WHERE outcome_type = 'interview_scheduled'),
    'interview_rejected', COUNT(*) FILTER (WHERE outcome_type = 'interview_rejected'),
    'offer_extended', COUNT(*) FILTER (WHERE outcome_type = 'offer_extended'),
    'offer_accepted', COUNT(*) FILTER (WHERE outcome_type = 'offer_accepted'),
    'offer_rejected', COUNT(*) FILTER (WHERE outcome_type = 'offer_rejected'),
    'placement_succeeded', COUNT(*) FILTER (WHERE outcome_type = 'placement_succeeded'),
    'placement_failed', COUNT(*) FILTER (WHERE outcome_type = 'placement_failed'),
    'candidate_withdrew', COUNT(*) FILTER (WHERE outcome_type = 'candidate_withdrew')
  )
  INTO v_funnel
  FROM public.placement_outcomes
  WHERE tenant_id = _tenant_id AND created_at > now() - interval '90 days';

  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY weight DESC), '[]'::jsonb)
  INTO v_ecosystems
  FROM (
    SELECT signal_type, signal_key, weight, sample_size, confidence
    FROM public.outcome_learning_signals
    WHERE tenant_id = _tenant_id
      AND signal_type IN ('ecosystem_uplift','ecosystem_penalty')
    ORDER BY weight DESC
    LIMIT 12
  ) t;

  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY weight DESC), '[]'::jsonb)
  INTO v_paths
  FROM (
    SELECT signal_type, signal_key, weight, sample_size, confidence
    FROM public.outcome_learning_signals
    WHERE tenant_id = _tenant_id
      AND signal_type IN ('adjacent_path_winning','adjacent_path_losing')
    ORDER BY weight DESC
    LIMIT 10
  ) t;

  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb)
  INTO v_recruiters
  FROM (
    SELECT
      recorded_by AS recruiter_id,
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE outcome_type IN ('offer_accepted','placement_succeeded')) AS wins,
      COUNT(*) FILTER (WHERE outcome_type IN ('shortlist_rejected','interview_rejected','offer_rejected','placement_failed')) AS losses
    FROM public.placement_outcomes
    WHERE tenant_id = _tenant_id
      AND recorded_by IS NOT NULL
      AND created_at > now() - interval '180 days'
    GROUP BY recorded_by
    ORDER BY wins DESC
    LIMIT 25
  ) t;

  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb)
  INTO v_clients
  FROM (
    SELECT client_org_id, preferences, sample_size, confidence, refreshed_at
    FROM public.client_preference_profile
    WHERE tenant_id = _tenant_id
    ORDER BY sample_size DESC
    LIMIT 25
  ) t;

  RETURN jsonb_build_object(
    'funnel', COALESCE(v_funnel, '{}'::jsonb),
    'ecosystems', v_ecosystems,
    'paths', v_paths,
    'recruiters', v_recruiters,
    'clients', v_clients,
    'generated_at', now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.recruiter_intelligence_summary(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.recruiter_intelligence_summary(uuid) TO authenticated;