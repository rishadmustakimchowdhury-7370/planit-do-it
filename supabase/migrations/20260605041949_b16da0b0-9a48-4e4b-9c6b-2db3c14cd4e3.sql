
CREATE TABLE IF NOT EXISTS public.structuring_backfill_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  triggered_by uuid,
  scope text NOT NULL CHECK (scope IN ('jobs','candidates','both')),
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running','success','failed','partial')),
  total int NOT NULL DEFAULT 0,
  succeeded int NOT NULL DEFAULT 0,
  failed int NOT NULL DEFAULT 0,
  skipped int NOT NULL DEFAULT 0,
  error text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.structuring_backfill_runs TO authenticated;
GRANT ALL ON public.structuring_backfill_runs TO service_role;

ALTER TABLE public.structuring_backfill_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owners_managers_can_read_backfill_runs"
ON public.structuring_backfill_runs FOR SELECT
TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR (tenant_id IS NOT NULL AND public.is_owner_or_manager_in_tenant(auth.uid(), tenant_id))
);

CREATE INDEX IF NOT EXISTS idx_structuring_backfill_runs_tenant_started
  ON public.structuring_backfill_runs (tenant_id, started_at DESC);

CREATE OR REPLACE VIEW public.structuring_backfill_progress AS
SELECT
  t.id AS tenant_id,
  (SELECT count(*) FROM public.jobs j WHERE j.tenant_id = t.id) AS total_jobs,
  (SELECT count(*) FROM public.jobs j WHERE j.tenant_id = t.id AND j.structured_jd IS NOT NULL) AS structured_jobs,
  (SELECT count(*) FROM public.jobs j WHERE j.tenant_id = t.id AND j.structured_jd IS NULL AND j.status IN ('open','draft')) AS missing_jobs,
  (SELECT count(*) FROM public.candidates c WHERE c.tenant_id = t.id) AS total_candidates,
  (SELECT count(*) FROM public.candidates c WHERE c.tenant_id = t.id AND c.structured_profile IS NOT NULL) AS structured_candidates,
  (SELECT count(*) FROM public.candidates c WHERE c.tenant_id = t.id AND c.structured_profile IS NULL) AS missing_candidates
FROM public.tenants t;

GRANT SELECT ON public.structuring_backfill_progress TO authenticated;
GRANT SELECT ON public.structuring_backfill_progress TO service_role;
