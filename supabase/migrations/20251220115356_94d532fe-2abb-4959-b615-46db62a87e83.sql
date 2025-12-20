-- Add unique constraint on email + tenant_id to prevent duplicate candidates
CREATE UNIQUE INDEX IF NOT EXISTS candidates_tenant_email_unique 
ON public.candidates (tenant_id, LOWER(email));

-- Add a check that created_by is set when inserting candidates
COMMENT ON COLUMN public.candidates.created_by IS 'User ID of who uploaded/created this candidate';