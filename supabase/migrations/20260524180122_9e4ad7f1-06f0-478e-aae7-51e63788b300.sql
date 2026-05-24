
ALTER TABLE public.candidate_client_shares
  ADD COLUMN IF NOT EXISTS public_share_token text UNIQUE,
  ADD COLUMN IF NOT EXISTS public_share_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS public_share_view_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS public_share_last_viewed_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_candidate_client_shares_pubtoken
  ON public.candidate_client_shares(public_share_token)
  WHERE public_share_token IS NOT NULL;

-- Public RPC: anonymous-safe candidate fetch by token
CREATE OR REPLACE FUNCTION public.get_public_candidate_share(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_share record;
  v_cand record;
  v_job record;
  v_org record;
  v_brand record;
BEGIN
  SELECT s.*, jc.candidate_id, jc.job_id
    INTO v_share
  FROM candidate_client_shares s
  JOIN job_candidates jc ON jc.id = s.job_candidate_id
  WHERE s.public_share_token = p_token
    AND s.status = 'shared'
  LIMIT 1;

  IF v_share IS NULL THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;

  IF v_share.public_share_expires_at IS NOT NULL AND v_share.public_share_expires_at < now() THEN
    RETURN jsonb_build_object('error', 'expired');
  END IF;

  SELECT id, full_name, current_title, current_company, location, summary,
         skills, experience_years, education, work_history, avatar_url,
         tags, linkedin_url
    INTO v_cand
  FROM candidates WHERE id = v_share.candidate_id;

  SELECT id, title, location, employment_type, experience_level INTO v_job
  FROM jobs WHERE id = v_share.job_id;

  SELECT id, name, logo_url, primary_color INTO v_org
  FROM client_organizations WHERE id = v_share.client_org_id;

  SELECT company_name, logo_url, primary_color, footer_text INTO v_brand
  FROM branding_settings WHERE tenant_id = v_share.tenant_id LIMIT 1;

  -- Increment view counter (best-effort)
  UPDATE candidate_client_shares
     SET public_share_view_count = public_share_view_count + 1,
         public_share_last_viewed_at = now()
   WHERE id = v_share.id;

  RETURN jsonb_build_object(
    'share', jsonb_build_object(
      'id', v_share.id,
      'shared_at', v_share.shared_at,
      'recruiter_summary', v_share.recruiter_summary,
      'ai_insights', v_share.ai_insights_snapshot,
      'branded_cv_url', v_share.branded_cv_url,
      'expires_at', v_share.public_share_expires_at
    ),
    'candidate', to_jsonb(v_cand),
    'job', to_jsonb(v_job),
    'client_org', to_jsonb(v_org),
    'brand', to_jsonb(v_brand)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_candidate_share(text) FROM public;
GRANT EXECUTE ON FUNCTION public.get_public_candidate_share(text) TO anon, authenticated;
