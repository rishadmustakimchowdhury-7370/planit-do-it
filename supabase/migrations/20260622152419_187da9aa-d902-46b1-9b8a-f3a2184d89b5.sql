
-- Templates for saved Discovery search filters
CREATE TABLE public.discovery_search_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  user_id uuid NOT NULL,
  name text NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.discovery_search_templates TO authenticated;
GRANT ALL ON public.discovery_search_templates TO service_role;
ALTER TABLE public.discovery_search_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant members can read templates"
  ON public.discovery_search_templates FOR SELECT
  TO authenticated
  USING (
    tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "owner can insert templates"
  ON public.discovery_search_templates FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "owner can update templates"
  ON public.discovery_search_templates FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "owner can delete templates"
  ON public.discovery_search_templates FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

CREATE TRIGGER update_discovery_search_templates_updated_at
  BEFORE UPDATE ON public.discovery_search_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Synonym cache (shared across tenants — generic recruiter terminology)
CREATE TABLE public.discovery_synonym_cache (
  term text PRIMARY KEY,
  synonyms text[] NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.discovery_synonym_cache TO authenticated;
GRANT ALL ON public.discovery_synonym_cache TO service_role;
ALTER TABLE public.discovery_synonym_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated can read synonyms"
  ON public.discovery_synonym_cache FOR SELECT
  TO authenticated
  USING (true);
