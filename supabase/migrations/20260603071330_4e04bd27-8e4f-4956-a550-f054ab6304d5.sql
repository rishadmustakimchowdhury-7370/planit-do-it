-- Enable required extensions for scheduling
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Unschedule any prior version so this is idempotent.
DO $$
DECLARE
  v_jobid bigint;
BEGIN
  SELECT jobid INTO v_jobid FROM cron.job WHERE jobname = 'process-validation-queue-every-minute';
  IF v_jobid IS NOT NULL THEN
    PERFORM cron.unschedule(v_jobid);
  END IF;
END $$;

-- Schedule: invoke process-validation-queue every minute.
SELECT cron.schedule(
  'process-validation-queue-every-minute',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://efdvolifacsnmiinifiq.supabase.co/functions/v1/process-validation-queue',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVmZHZvbGlmYWNzbm1paW5pZmlxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMTg1OTAsImV4cCI6MjA4MDY5NDU5MH0.NLnoyML1XPDxRQtU7gy9XyFR0bgmXRSCi_3mJRkWflA'
    ),
    body := jsonb_build_object('batch_size', 20)
  );
  $$
);

-- Helpful index for queue draining and dedup lookups.
CREATE INDEX IF NOT EXISTS idx_validation_queue_status_priority
  ON public.validation_queue (status, priority DESC, enqueued_at ASC);

CREATE INDEX IF NOT EXISTS idx_validation_queue_job_candidate_status
  ON public.validation_queue (job_id, candidate_id, status);