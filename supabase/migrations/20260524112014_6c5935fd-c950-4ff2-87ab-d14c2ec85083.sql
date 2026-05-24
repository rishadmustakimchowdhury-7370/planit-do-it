-- AI Candidate Rediscovery System
-- pgvector + embeddings + cached matches + run history

CREATE EXTENSION IF NOT EXISTS vector;

-- =========================
-- candidate_embeddings
-- =========================
CREATE TABLE IF NOT EXISTS public.candidate_embeddings (
  candidate_id uuid PRIMARY KEY REFERENCES public.candidates(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL,
  embedding vector(1536) NOT NULL,
  source_text text NOT NULL,
  model_version text NOT NULL DEFAULT 'text-embedding-3-small',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS candidate_embeddings_tenant_idx
  ON public.candidate_embeddings (tenant_id);

CREATE INDEX IF NOT EXISTS candidate_embeddings_hnsw_idx
  ON public.candidate_embeddings USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

ALTER TABLE public.candidate_embeddings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_select_candidate_embeddings"
  ON public.candidate_embeddings FOR SELECT
  USING (
    auth.uid() IS NOT NULL AND (
      tenant_id = public.get_user_tenant_id(auth.uid())
      OR public.is_super_admin(auth.uid())
    )
  );

CREATE POLICY "tenant_modify_candidate_embeddings"
  ON public.candidate_embeddings FOR ALL
  USING (
    auth.uid() IS NOT NULL AND (
      tenant_id = public.get_user_tenant_id(auth.uid())
      OR public.is_super_admin(auth.uid())
    )
  )
  WITH CHECK (
    auth.uid() IS NOT NULL AND (
      tenant_id = public.get_user_tenant_id(auth.uid())
      OR public.is_super_admin(auth.uid())
    )
  );

-- =========================
-- job_embeddings
-- =========================
CREATE TABLE IF NOT EXISTS public.job_embeddings (
  job_id uuid PRIMARY KEY REFERENCES public.jobs(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL,
  embedding vector(1536) NOT NULL,
  source_text text NOT NULL,
  model_version text NOT NULL DEFAULT 'text-embedding-3-small',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS job_embeddings_tenant_idx
  ON public.job_embeddings (tenant_id);

ALTER TABLE public.job_embeddings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_select_job_embeddings"
  ON public.job_embeddings FOR SELECT
  USING (
    auth.uid() IS NOT NULL AND (
      tenant_id = public.get_user_tenant_id(auth.uid())
      OR public.is_super_admin(auth.uid())
    )
  );

CREATE POLICY "tenant_modify_job_embeddings"
  ON public.job_embeddings FOR ALL
  USING (
    auth.uid() IS NOT NULL AND (
      tenant_id = public.get_user_tenant_id(auth.uid())
      OR public.is_super_admin(auth.uid())
    )
  )
  WITH CHECK (
    auth.uid() IS NOT NULL AND (
      tenant_id = public.get_user_tenant_id(auth.uid())
      OR public.is_super_admin(auth.uid())
    )
  );

-- =========================
-- rediscovered_matches
-- =========================
CREATE TABLE IF NOT EXISTS public.rediscovered_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  candidate_id uuid NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL,
  match_score integer NOT NULL DEFAULT 0,
  semantic_score numeric(5,2),
  ai_score integer,
  ai_summary text,
  strengths jsonb NOT NULL DEFAULT '[]'::jsonb,
  gaps jsonb NOT NULL DEFAULT '[]'::jsonb,
  insights jsonb NOT NULL DEFAULT '[]'::jsonb,
  confidence text NOT NULL DEFAULT 'medium',
  dismissed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (job_id, candidate_id)
);

CREATE INDEX IF NOT EXISTS rediscovered_matches_job_idx
  ON public.rediscovered_matches (job_id, match_score DESC);
CREATE INDEX IF NOT EXISTS rediscovered_matches_tenant_idx
  ON public.rediscovered_matches (tenant_id);

ALTER TABLE public.rediscovered_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_select_rediscovered_matches"
  ON public.rediscovered_matches FOR SELECT
  USING (
    auth.uid() IS NOT NULL AND (
      tenant_id = public.get_user_tenant_id(auth.uid())
      OR public.is_super_admin(auth.uid())
    )
  );

CREATE POLICY "tenant_modify_rediscovered_matches"
  ON public.rediscovered_matches FOR ALL
  USING (
    auth.uid() IS NOT NULL AND (
      tenant_id = public.get_user_tenant_id(auth.uid())
      OR public.is_super_admin(auth.uid())
    )
  )
  WITH CHECK (
    auth.uid() IS NOT NULL AND (
      tenant_id = public.get_user_tenant_id(auth.uid())
      OR public.is_super_admin(auth.uid())
    )
  );

CREATE TRIGGER trg_rediscovered_matches_updated_at
  BEFORE UPDATE ON public.rediscovered_matches
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================
-- rediscovery_runs (audit / history)
-- =========================
CREATE TABLE IF NOT EXISTS public.rediscovery_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL,
  triggered_by uuid,
  candidates_scanned integer NOT NULL DEFAULT 0,
  matches_found integer NOT NULL DEFAULT 0,
  credits_used integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  error text,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS rediscovery_runs_job_idx
  ON public.rediscovery_runs (job_id, started_at DESC);
CREATE INDEX IF NOT EXISTS rediscovery_runs_tenant_idx
  ON public.rediscovery_runs (tenant_id);

ALTER TABLE public.rediscovery_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_select_rediscovery_runs"
  ON public.rediscovery_runs FOR SELECT
  USING (
    auth.uid() IS NOT NULL AND (
      tenant_id = public.get_user_tenant_id(auth.uid())
      OR public.is_super_admin(auth.uid())
    )
  );

CREATE POLICY "tenant_insert_rediscovery_runs"
  ON public.rediscovery_runs FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL AND (
      tenant_id = public.get_user_tenant_id(auth.uid())
      OR public.is_super_admin(auth.uid())
    )
  );

-- =========================
-- RPC: vector similarity search (top-K candidates for a job)
-- =========================
CREATE OR REPLACE FUNCTION public.match_candidates_for_job(
  p_job_id uuid,
  p_match_count integer DEFAULT 25
)
RETURNS TABLE (
  candidate_id uuid,
  similarity numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant uuid;
  v_caller_tenant uuid;
  v_job_embedding vector(1536);
BEGIN
  -- Tenant of the job
  SELECT j.tenant_id INTO v_tenant FROM public.jobs j WHERE j.id = p_job_id;
  IF v_tenant IS NULL THEN
    RAISE EXCEPTION 'Job not found';
  END IF;

  -- Auth check (super admin OR same tenant)
  v_caller_tenant := public.get_user_tenant_id(auth.uid());
  IF NOT public.is_super_admin(auth.uid()) AND v_caller_tenant IS DISTINCT FROM v_tenant THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT je.embedding INTO v_job_embedding
  FROM public.job_embeddings je WHERE je.job_id = p_job_id;

  IF v_job_embedding IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    ce.candidate_id,
    (1 - (ce.embedding <=> v_job_embedding))::numeric AS similarity
  FROM public.candidate_embeddings ce
  WHERE ce.tenant_id = v_tenant
  ORDER BY ce.embedding <=> v_job_embedding
  LIMIT p_match_count;
END;
$$;

-- =========================
-- RPC: backfill list (returns candidate ids without embeddings)
-- =========================
CREATE OR REPLACE FUNCTION public.candidates_missing_embeddings(p_limit integer DEFAULT 50)
RETURNS TABLE (candidate_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id
  FROM public.candidates c
  LEFT JOIN public.candidate_embeddings ce ON ce.candidate_id = c.id
  WHERE ce.candidate_id IS NULL
    AND c.tenant_id = public.get_user_tenant_id(auth.uid())
  ORDER BY c.updated_at DESC NULLS LAST
  LIMIT p_limit;
$$;