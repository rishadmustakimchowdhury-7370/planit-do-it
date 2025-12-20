-- First, drop the existing check constraint and add a new one that includes job_assigned
ALTER TABLE public.recruiter_activities DROP CONSTRAINT IF EXISTS recruiter_activities_action_type_check;

ALTER TABLE public.recruiter_activities 
ADD CONSTRAINT recruiter_activities_action_type_check 
CHECK (action_type IN (
  'cv_uploaded', 
  'cv_submitted', 
  'cv_deleted',
  'cv_parsed',
  'screening_completed', 
  'interview_scheduled', 
  'interview_completed',
  'offer_sent',
  'candidate_hired',
  'candidate_rejected',
  'job_activated',
  'job_closed',
  'job_assigned',
  'ai_match_run',
  'ai_cv_parse',
  'ai_email_compose',
  'ai_brand_cv'
));

-- Now backfill job_assigned activities from job_assignees table
INSERT INTO public.recruiter_activities (tenant_id, user_id, action_type, job_id, metadata, created_at)
SELECT 
  ja.tenant_id,
  COALESCE(ja.assigned_by, ja.user_id) as user_id,
  'job_assigned' as action_type,
  ja.job_id,
  jsonb_build_object(
    'assigned_to_user_id', ja.user_id::text,
    'assigned_to_name', p.full_name,
    'job_title', j.title,
    'backfilled', true
  ) as metadata,
  ja.assigned_at as created_at
FROM job_assignees ja
JOIN jobs j ON ja.job_id = j.id
JOIN profiles p ON ja.user_id = p.id
WHERE NOT EXISTS (
  SELECT 1 FROM recruiter_activities ra 
  WHERE ra.job_id = ja.job_id 
  AND ra.action_type = 'job_assigned'
  AND (ra.metadata->>'assigned_to_user_id')::text = ja.user_id::text
);