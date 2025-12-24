-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule daily renewal reminders at 9 AM UTC
SELECT cron.schedule(
  'send-renewal-reminders',
  '0 9 * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/send-renewal-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Fix existing trial tenants without trial_expires_at (set to 14 days from created_at)
UPDATE public.tenants
SET trial_expires_at = created_at + INTERVAL '14 days'
WHERE subscription_status = 'trial'
  AND trial_expires_at IS NULL;