-- Phase 3: Work Tracking System Enhancement (Fixed v2)
-- Add timezone and make logs immutable

-- Add timezone column to work_sessions if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'work_sessions' 
    AND column_name = 'timezone'
  ) THEN
    ALTER TABLE public.work_sessions 
    ADD COLUMN timezone text NOT NULL DEFAULT 'UTC';
  END IF;
END $$;

-- Add timezone column to work_status_logs if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'work_status_logs' 
    AND column_name = 'timezone'
  ) THEN
    ALTER TABLE public.work_status_logs 
    ADD COLUMN timezone text NOT NULL DEFAULT 'UTC';
  END IF;
END $$;

-- Add user_role column to work_status_logs for audit trail
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'work_status_logs' 
    AND column_name = 'user_role'
  ) THEN
    ALTER TABLE public.work_status_logs 
    ADD COLUMN user_role app_role;
  END IF;
END $$;

-- Make work_status_logs immutable (no updates or deletes allowed)
DROP POLICY IF EXISTS "Users can update their own logs" ON public.work_status_logs;
DROP POLICY IF EXISTS "Users can delete their own logs" ON public.work_status_logs;

-- Only allow SELECT and INSERT on work_status_logs
CREATE POLICY "Users can view their own logs" 
ON public.work_status_logs 
FOR SELECT 
USING (user_id = auth.uid() OR is_owner(auth.uid()) OR is_manager(auth.uid()));

CREATE POLICY "Users can insert their own logs" 
ON public.work_status_logs 
FOR INSERT 
WITH CHECK (user_id = auth.uid());

-- Add indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_work_status_logs_user_timestamp 
ON public.work_status_logs(user_id, timestamp);

CREATE INDEX IF NOT EXISTS idx_work_status_logs_timezone 
ON public.work_status_logs(timezone);

CREATE INDEX IF NOT EXISTS idx_work_sessions_user_date 
ON public.work_sessions(user_id, date);