
-- Invoice email tracking logs (sent, opened, reminder_sent, payment_received, viewed_pdf)
CREATE TABLE IF NOT EXISTS public.invoice_email_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  event_type text NOT NULL, -- 'sent' | 'opened' | 'reminder_sent' | 'payment_received' | 'bounced'
  recipient_email text,
  subject text,
  reminder_kind text, -- 'pre_due_3d' | 'due_today' | 'overdue_7d' | null
  performed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoice_email_logs TO authenticated;
GRANT ALL ON public.invoice_email_logs TO service_role;

ALTER TABLE public.invoice_email_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners/managers read invoice email logs"
  ON public.invoice_email_logs FOR SELECT
  USING (public.is_owner_or_manager_in_tenant(auth.uid(), tenant_id));

CREATE POLICY "Owners/managers manage invoice email logs"
  ON public.invoice_email_logs FOR ALL
  USING (public.is_owner_or_manager_in_tenant(auth.uid(), tenant_id))
  WITH CHECK (public.is_owner_or_manager_in_tenant(auth.uid(), tenant_id));

CREATE INDEX IF NOT EXISTS idx_invoice_email_logs_invoice ON public.invoice_email_logs(invoice_id, created_at DESC);

-- Reminder tracking on invoices
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS last_reminder_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_reminder_kind text,
  ADD COLUMN IF NOT EXISTS first_opened_at timestamptz,
  ADD COLUMN IF NOT EXISTS open_count int NOT NULL DEFAULT 0;
