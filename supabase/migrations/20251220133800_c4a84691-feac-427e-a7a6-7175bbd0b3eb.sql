-- Enable replica identity for real-time updates on recruiter_activities
ALTER TABLE public.recruiter_activities REPLICA IDENTITY FULL;

-- Add table to realtime publication if not already added
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'recruiter_activities'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.recruiter_activities;
  END IF;
END $$;

-- Also enable for ai_usage table
ALTER TABLE public.ai_usage REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'ai_usage'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_usage;
  END IF;
END $$;

-- Enable for jobs table as well
ALTER TABLE public.jobs REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'jobs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.jobs;
  END IF;
END $$;