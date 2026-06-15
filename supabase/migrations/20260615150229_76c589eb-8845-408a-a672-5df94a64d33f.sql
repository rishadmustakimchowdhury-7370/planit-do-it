
DO $$ BEGIN
  CREATE TYPE public.lead_status AS ENUM ('new','contacted','follow_up','meeting_booked','proposal_sent','negotiation','client_won','lost');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.lead_contacts
  ADD COLUMN IF NOT EXISTS status public.lead_status NOT NULL DEFAULT 'new',
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS position integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_lead_contacts_status ON public.lead_contacts(tenant_id, status) WHERE deleted_at IS NULL;
