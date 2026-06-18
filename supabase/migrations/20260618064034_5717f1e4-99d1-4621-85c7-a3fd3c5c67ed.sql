CREATE TABLE public.candidate_source_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  provider text NOT NULL CHECK (provider IN ('lusha','viral_prospect')),
  api_key_encrypted text,
  api_key_iv text,
  api_key_last_four text,
  status text NOT NULL DEFAULT 'disconnected',
  last_tested_at timestamptz,
  last_sync_at timestamptz,
  last_error text,
  capabilities jsonb NOT NULL DEFAULT '{}'::jsonb,
  connected_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, provider)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.candidate_source_integrations TO authenticated;
GRANT ALL ON public.candidate_source_integrations TO service_role;

ALTER TABLE public.candidate_source_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view candidate source integrations"
ON public.candidate_source_integrations
FOR SELECT
TO authenticated
USING (
  tenant_id IN (
    SELECT profiles.tenant_id FROM public.profiles WHERE profiles.id = auth.uid()
  )
  AND (
    public.has_role(auth.uid(), 'owner')
    OR public.has_role(auth.uid(), 'manager')
    OR public.has_role(auth.uid(), 'recruiter')
    OR public.has_role(auth.uid(), 'super_admin')
  )
);

CREATE POLICY "Owners and managers can insert candidate source integrations"
ON public.candidate_source_integrations
FOR INSERT
TO authenticated
WITH CHECK (
  tenant_id IN (
    SELECT profiles.tenant_id FROM public.profiles WHERE profiles.id = auth.uid()
  )
  AND (
    public.has_role(auth.uid(), 'owner')
    OR public.has_role(auth.uid(), 'manager')
  )
);

CREATE POLICY "Owners and managers can update candidate source integrations"
ON public.candidate_source_integrations
FOR UPDATE
TO authenticated
USING (
  tenant_id IN (
    SELECT profiles.tenant_id FROM public.profiles WHERE profiles.id = auth.uid()
  )
  AND (
    public.has_role(auth.uid(), 'owner')
    OR public.has_role(auth.uid(), 'manager')
  )
);

CREATE POLICY "Owners and managers can delete candidate source integrations"
ON public.candidate_source_integrations
FOR DELETE
TO authenticated
USING (
  tenant_id IN (
    SELECT profiles.tenant_id FROM public.profiles WHERE profiles.id = auth.uid()
  )
  AND (
    public.has_role(auth.uid(), 'owner')
    OR public.has_role(auth.uid(), 'manager')
  )
);

CREATE TRIGGER update_candidate_source_integrations_updated_at
BEFORE UPDATE ON public.candidate_source_integrations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();