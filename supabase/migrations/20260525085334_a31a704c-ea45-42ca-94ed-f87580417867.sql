-- 1) Backfill client_organizations from existing clients
INSERT INTO public.client_organizations (tenant_id, client_id, name, is_active, created_by)
SELECT c.tenant_id, c.id, c.name, COALESCE(c.is_active, true), c.created_by
FROM public.clients c
WHERE NOT EXISTS (
  SELECT 1 FROM public.client_organizations o WHERE o.client_id = c.id
);

-- 2) Trigger function to keep them in sync
CREATE OR REPLACE FUNCTION public.sync_client_to_organization()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.client_organizations (tenant_id, client_id, name, is_active, created_by)
    VALUES (NEW.tenant_id, NEW.id, NEW.name, COALESCE(NEW.is_active, true), NEW.created_by)
    ON CONFLICT DO NOTHING;
  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE public.client_organizations
       SET name = NEW.name,
           is_active = COALESCE(NEW.is_active, true),
           updated_at = now()
     WHERE client_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_client_to_organization ON public.clients;
CREATE TRIGGER trg_sync_client_to_organization
AFTER INSERT OR UPDATE OF name, is_active ON public.clients
FOR EACH ROW EXECUTE FUNCTION public.sync_client_to_organization();