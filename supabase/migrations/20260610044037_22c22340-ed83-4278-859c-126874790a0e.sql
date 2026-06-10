
CREATE TABLE public.placements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  candidate_id uuid NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  job_id uuid REFERENCES public.jobs(id) ON DELETE SET NULL,
  client_org_id uuid REFERENCES public.client_organizations(id) ON DELETE SET NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  recruiter_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  placement_date date NOT NULL DEFAULT CURRENT_DATE,
  start_date date,
  salary numeric(14,2),
  placement_fee numeric(14,2),
  currency text DEFAULT 'USD',
  status text NOT NULL DEFAULT 'confirmed',
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_placements_tenant ON public.placements(tenant_id);
CREATE INDEX idx_placements_candidate ON public.placements(candidate_id);
CREATE INDEX idx_placements_recruiter ON public.placements(recruiter_user_id);
CREATE INDEX idx_placements_date ON public.placements(placement_date);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.placements TO authenticated;
GRANT ALL ON public.placements TO service_role;

ALTER TABLE public.placements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view placements"
  ON public.placements FOR SELECT
  TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_super_admin(auth.uid()));

CREATE POLICY "Tenant members can insert placements"
  ON public.placements FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Owners managers or creator can update placements"
  ON public.placements FOR UPDATE
  TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND (
      public.is_owner_or_manager_in_tenant(auth.uid(), tenant_id)
      OR created_by = auth.uid()
      OR recruiter_user_id = auth.uid()
    )
  );

CREATE POLICY "Owners managers can delete placements"
  ON public.placements FOR DELETE
  TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND public.is_owner_or_manager_in_tenant(auth.uid(), tenant_id)
  );

CREATE TRIGGER update_placements_updated_at
  BEFORE UPDATE ON public.placements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
