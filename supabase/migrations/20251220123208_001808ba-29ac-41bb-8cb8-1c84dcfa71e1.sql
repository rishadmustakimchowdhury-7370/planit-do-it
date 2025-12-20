-- Create job_assignees junction table for multiple recruiter assignments
CREATE TABLE public.job_assignees (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  assigned_by UUID,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  UNIQUE(job_id, user_id)
);

-- Enable RLS
ALTER TABLE public.job_assignees ENABLE ROW LEVEL SECURITY;

-- Create policies for job_assignees
CREATE POLICY "Users can view job assignees in their tenant" 
ON public.job_assignees 
FOR SELECT 
USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Owners and managers can manage job assignees" 
ON public.job_assignees 
FOR ALL 
USING (tenant_id = get_user_tenant_id(auth.uid()) AND (is_owner(auth.uid()) OR is_manager(auth.uid())))
WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()) AND (is_owner(auth.uid()) OR is_manager(auth.uid())));

-- Create index for performance
CREATE INDEX idx_job_assignees_job_id ON public.job_assignees(job_id);
CREATE INDEX idx_job_assignees_user_id ON public.job_assignees(user_id);
CREATE INDEX idx_job_assignees_tenant_id ON public.job_assignees(tenant_id);

-- Migrate existing assignments from jobs.assigned_to to job_assignees
INSERT INTO public.job_assignees (job_id, user_id, tenant_id, assigned_at)
SELECT id, assigned_to, tenant_id, COALESCE(updated_at, created_at)
FROM public.jobs 
WHERE assigned_to IS NOT NULL;