-- Add timezone column to candidate_emails for proper scheduled email handling
ALTER TABLE public.candidate_emails 
ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'UTC';

-- Add retry tracking for scheduled emails
ALTER TABLE public.candidate_emails 
ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0;

-- Add index for efficient scheduled email queries
CREATE INDEX IF NOT EXISTS idx_candidate_emails_scheduled 
ON public.candidate_emails (status, scheduled_at) 
WHERE status = 'scheduled';

-- Add index for timezone-aware scheduling
CREATE INDEX IF NOT EXISTS idx_candidate_emails_timezone 
ON public.candidate_emails (scheduled_at, timezone) 
WHERE status = 'scheduled';