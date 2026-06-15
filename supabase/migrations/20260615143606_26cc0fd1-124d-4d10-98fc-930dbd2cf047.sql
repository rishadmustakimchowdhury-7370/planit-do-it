
-- ============================================================
-- LEAD INTELLIGENCE FOUNDATION
-- ============================================================

-- Helper: assigned-record access check for recruiters
CREATE OR REPLACE FUNCTION public.lead_can_access(_user_id uuid, _tenant_id uuid, _assigned_to uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_owner_or_manager_in_tenant(_user_id, _tenant_id)
    OR (_assigned_to = _user_id AND public.user_belongs_to_tenant(_user_id, _tenant_id));
$$;

-- ============================================================
-- 1. lead_companies
-- ============================================================
CREATE TABLE public.lead_companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  name text NOT NULL,
  domain text,
  website text,
  industry text,
  company_size text,
  employee_count integer,
  revenue_range text,
  location text,
  country text,
  city text,
  linkedin_url text,
  description text,
  logo_url text,
  tags text[] DEFAULT '{}',
  enrichment_data jsonb DEFAULT '{}'::jsonb,
  enrichment_source text,
  enriched_at timestamptz,
  assigned_to uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX idx_lead_companies_tenant ON public.lead_companies(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_lead_companies_assigned ON public.lead_companies(assigned_to) WHERE deleted_at IS NULL;
CREATE INDEX idx_lead_companies_domain ON public.lead_companies(tenant_id, domain) WHERE deleted_at IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_companies TO authenticated;
GRANT ALL ON public.lead_companies TO service_role;
ALTER TABLE public.lead_companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lead_companies_select" ON public.lead_companies FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND public.lead_can_access(auth.uid(), tenant_id, assigned_to));
CREATE POLICY "lead_companies_insert" ON public.lead_companies FOR INSERT TO authenticated
  WITH CHECK (public.user_belongs_to_tenant(auth.uid(), tenant_id));
CREATE POLICY "lead_companies_update" ON public.lead_companies FOR UPDATE TO authenticated
  USING (public.lead_can_access(auth.uid(), tenant_id, assigned_to))
  WITH CHECK (public.lead_can_access(auth.uid(), tenant_id, assigned_to));
CREATE POLICY "lead_companies_delete" ON public.lead_companies FOR DELETE TO authenticated
  USING (public.is_owner_or_manager_in_tenant(auth.uid(), tenant_id));

CREATE TRIGGER trg_lead_companies_updated_at BEFORE UPDATE ON public.lead_companies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 2. lead_contacts
-- ============================================================
CREATE TABLE public.lead_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  company_id uuid REFERENCES public.lead_companies(id) ON DELETE SET NULL,
  first_name text,
  last_name text,
  full_name text,
  email text,
  email_verified boolean DEFAULT false,
  phone text,
  mobile text,
  title text,
  seniority text,
  department text,
  location text,
  country text,
  city text,
  linkedin_url text,
  twitter_url text,
  tags text[] DEFAULT '{}',
  enrichment_data jsonb DEFAULT '{}'::jsonb,
  enrichment_source text,
  enriched_at timestamptz,
  assigned_to uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX idx_lead_contacts_tenant ON public.lead_contacts(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_lead_contacts_company ON public.lead_contacts(company_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_lead_contacts_assigned ON public.lead_contacts(assigned_to) WHERE deleted_at IS NULL;
CREATE INDEX idx_lead_contacts_email ON public.lead_contacts(tenant_id, email) WHERE deleted_at IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_contacts TO authenticated;
GRANT ALL ON public.lead_contacts TO service_role;
ALTER TABLE public.lead_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lead_contacts_select" ON public.lead_contacts FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND public.lead_can_access(auth.uid(), tenant_id, assigned_to));
CREATE POLICY "lead_contacts_insert" ON public.lead_contacts FOR INSERT TO authenticated
  WITH CHECK (public.user_belongs_to_tenant(auth.uid(), tenant_id));
CREATE POLICY "lead_contacts_update" ON public.lead_contacts FOR UPDATE TO authenticated
  USING (public.lead_can_access(auth.uid(), tenant_id, assigned_to))
  WITH CHECK (public.lead_can_access(auth.uid(), tenant_id, assigned_to));
CREATE POLICY "lead_contacts_delete" ON public.lead_contacts FOR DELETE TO authenticated
  USING (public.is_owner_or_manager_in_tenant(auth.uid(), tenant_id));

CREATE TRIGGER trg_lead_contacts_updated_at BEFORE UPDATE ON public.lead_contacts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 3. lead_lists
-- ============================================================
CREATE TABLE public.lead_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  list_type text NOT NULL DEFAULT 'static',
  filter_criteria jsonb DEFAULT '{}'::jsonb,
  member_count integer DEFAULT 0,
  assigned_to uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX idx_lead_lists_tenant ON public.lead_lists(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_lead_lists_assigned ON public.lead_lists(assigned_to) WHERE deleted_at IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_lists TO authenticated;
GRANT ALL ON public.lead_lists TO service_role;
ALTER TABLE public.lead_lists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lead_lists_select" ON public.lead_lists FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND public.lead_can_access(auth.uid(), tenant_id, assigned_to));
CREATE POLICY "lead_lists_insert" ON public.lead_lists FOR INSERT TO authenticated
  WITH CHECK (public.user_belongs_to_tenant(auth.uid(), tenant_id));
CREATE POLICY "lead_lists_update" ON public.lead_lists FOR UPDATE TO authenticated
  USING (public.lead_can_access(auth.uid(), tenant_id, assigned_to))
  WITH CHECK (public.lead_can_access(auth.uid(), tenant_id, assigned_to));
CREATE POLICY "lead_lists_delete" ON public.lead_lists FOR DELETE TO authenticated
  USING (public.is_owner_or_manager_in_tenant(auth.uid(), tenant_id));

CREATE TRIGGER trg_lead_lists_updated_at BEFORE UPDATE ON public.lead_lists
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Junction: lead_list_members (companies/contacts <-> lists)
CREATE TABLE public.lead_list_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  list_id uuid NOT NULL REFERENCES public.lead_lists(id) ON DELETE CASCADE,
  company_id uuid REFERENCES public.lead_companies(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.lead_contacts(id) ON DELETE CASCADE,
  added_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (company_id IS NOT NULL OR contact_id IS NOT NULL)
);
CREATE INDEX idx_lead_list_members_list ON public.lead_list_members(list_id);
CREATE INDEX idx_lead_list_members_tenant ON public.lead_list_members(tenant_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_list_members TO authenticated;
GRANT ALL ON public.lead_list_members TO service_role;
ALTER TABLE public.lead_list_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lead_list_members_all" ON public.lead_list_members FOR ALL TO authenticated
  USING (public.user_belongs_to_tenant(auth.uid(), tenant_id))
  WITH CHECK (public.user_belongs_to_tenant(auth.uid(), tenant_id));

-- ============================================================
-- 4. lead_activities
-- ============================================================
CREATE TABLE public.lead_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  company_id uuid REFERENCES public.lead_companies(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.lead_contacts(id) ON DELETE CASCADE,
  activity_type text NOT NULL,
  subject text,
  notes text,
  outcome text,
  metadata jsonb DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  performed_by uuid,
  assigned_to uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CHECK (company_id IS NOT NULL OR contact_id IS NOT NULL)
);

CREATE INDEX idx_lead_activities_tenant ON public.lead_activities(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_lead_activities_company ON public.lead_activities(company_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_lead_activities_contact ON public.lead_activities(contact_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_lead_activities_performed_by ON public.lead_activities(performed_by) WHERE deleted_at IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_activities TO authenticated;
GRANT ALL ON public.lead_activities TO service_role;
ALTER TABLE public.lead_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lead_activities_select" ON public.lead_activities FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL AND (
      public.is_owner_or_manager_in_tenant(auth.uid(), tenant_id)
      OR performed_by = auth.uid()
      OR assigned_to = auth.uid()
    )
  );
CREATE POLICY "lead_activities_insert" ON public.lead_activities FOR INSERT TO authenticated
  WITH CHECK (public.user_belongs_to_tenant(auth.uid(), tenant_id));
CREATE POLICY "lead_activities_update" ON public.lead_activities FOR UPDATE TO authenticated
  USING (
    public.is_owner_or_manager_in_tenant(auth.uid(), tenant_id)
    OR performed_by = auth.uid()
  )
  WITH CHECK (
    public.is_owner_or_manager_in_tenant(auth.uid(), tenant_id)
    OR performed_by = auth.uid()
  );
CREATE POLICY "lead_activities_delete" ON public.lead_activities FOR DELETE TO authenticated
  USING (public.is_owner_or_manager_in_tenant(auth.uid(), tenant_id));

CREATE TRIGGER trg_lead_activities_updated_at BEFORE UPDATE ON public.lead_activities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 5. lead_search_history
-- ============================================================
CREATE TABLE public.lead_search_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  searched_by uuid NOT NULL,
  query_text text,
  filters jsonb DEFAULT '{}'::jsonb,
  search_type text DEFAULT 'company',
  result_count integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX idx_lead_search_history_tenant ON public.lead_search_history(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_lead_search_history_user ON public.lead_search_history(searched_by) WHERE deleted_at IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_search_history TO authenticated;
GRANT ALL ON public.lead_search_history TO service_role;
ALTER TABLE public.lead_search_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lead_search_history_select" ON public.lead_search_history FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL AND (
      public.is_owner_or_manager_in_tenant(auth.uid(), tenant_id)
      OR searched_by = auth.uid()
    )
  );
CREATE POLICY "lead_search_history_insert" ON public.lead_search_history FOR INSERT TO authenticated
  WITH CHECK (
    public.user_belongs_to_tenant(auth.uid(), tenant_id)
    AND searched_by = auth.uid()
  );
CREATE POLICY "lead_search_history_update" ON public.lead_search_history FOR UPDATE TO authenticated
  USING (searched_by = auth.uid())
  WITH CHECK (searched_by = auth.uid());
CREATE POLICY "lead_search_history_delete" ON public.lead_search_history FOR DELETE TO authenticated
  USING (
    public.is_owner_or_manager_in_tenant(auth.uid(), tenant_id)
    OR searched_by = auth.uid()
  );

CREATE TRIGGER trg_lead_search_history_updated_at BEFORE UPDATE ON public.lead_search_history
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
