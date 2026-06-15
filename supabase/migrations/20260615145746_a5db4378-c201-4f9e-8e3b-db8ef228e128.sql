
-- Companies: unique by domain (lower), fallback to name
CREATE UNIQUE INDEX IF NOT EXISTS lead_companies_tenant_domain_uidx
  ON public.lead_companies (tenant_id, lower(domain))
  WHERE deleted_at IS NULL AND domain IS NOT NULL AND domain <> '';

CREATE UNIQUE INDEX IF NOT EXISTS lead_companies_tenant_name_uidx
  ON public.lead_companies (tenant_id, lower(name))
  WHERE deleted_at IS NULL AND (domain IS NULL OR domain = '');

-- Contacts: unique by linkedin_url, fallback to email
CREATE UNIQUE INDEX IF NOT EXISTS lead_contacts_tenant_linkedin_uidx
  ON public.lead_contacts (tenant_id, linkedin_url)
  WHERE deleted_at IS NULL AND linkedin_url IS NOT NULL AND linkedin_url <> '';

CREATE UNIQUE INDEX IF NOT EXISTS lead_contacts_tenant_email_uidx
  ON public.lead_contacts (tenant_id, lower(email))
  WHERE deleted_at IS NULL AND (linkedin_url IS NULL OR linkedin_url = '') AND email IS NOT NULL AND email <> '';
