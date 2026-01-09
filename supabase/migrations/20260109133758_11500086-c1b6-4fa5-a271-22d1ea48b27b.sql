-- PHASE 4: Fix remaining policies (excluding non-existent tables)

-- Fix jobs policies
DROP POLICY IF EXISTS "Users can manage jobs in their tenant" ON public.jobs;
DROP POLICY IF EXISTS "Users can view jobs in their tenant" ON public.jobs;

CREATE POLICY "Authenticated users can view jobs in their tenant" 
ON public.jobs FOR SELECT 
USING (auth.uid() IS NOT NULL AND ((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())));

CREATE POLICY "Authenticated users can manage jobs in their tenant" 
ON public.jobs FOR ALL 
USING (auth.uid() IS NOT NULL AND ((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())));

-- Fix job_candidates policies
DROP POLICY IF EXISTS "Users can manage job candidates in their tenant" ON public.job_candidates;
DROP POLICY IF EXISTS "Users can view job candidates in their tenant" ON public.job_candidates;

CREATE POLICY "Authenticated users can view job candidates in their tenant" 
ON public.job_candidates FOR SELECT 
USING (auth.uid() IS NOT NULL AND ((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())));

CREATE POLICY "Authenticated users can manage job candidates in their tenant" 
ON public.job_candidates FOR ALL 
USING (auth.uid() IS NOT NULL AND ((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid())));

-- Fix linkedin_connections policies
DROP POLICY IF EXISTS "Users can delete own LinkedIn connection" ON public.linkedin_connections;
DROP POLICY IF EXISTS "Users can update own LinkedIn connection" ON public.linkedin_connections;
DROP POLICY IF EXISTS "Users can view own LinkedIn connection" ON public.linkedin_connections;
DROP POLICY IF EXISTS "Users can insert own LinkedIn connection" ON public.linkedin_connections;

CREATE POLICY "Authenticated users can view own LinkedIn connection" 
ON public.linkedin_connections FOR SELECT 
USING (auth.uid() IS NOT NULL AND auth.uid() = user_id);

CREATE POLICY "Authenticated users can insert own LinkedIn connection" 
ON public.linkedin_connections FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id);

CREATE POLICY "Authenticated users can update own LinkedIn connection" 
ON public.linkedin_connections FOR UPDATE 
USING (auth.uid() IS NOT NULL AND auth.uid() = user_id);

CREATE POLICY "Authenticated users can delete own LinkedIn connection" 
ON public.linkedin_connections FOR DELETE 
USING (auth.uid() IS NOT NULL AND auth.uid() = user_id);

-- Fix work_sessions policies
DROP POLICY IF EXISTS "Users can manage their own sessions" ON public.work_sessions;
DROP POLICY IF EXISTS "Users can view sessions in their tenant" ON public.work_sessions;

CREATE POLICY "Authenticated users can view sessions in their tenant" 
ON public.work_sessions FOR SELECT 
USING (auth.uid() IS NOT NULL AND (
  (user_id = auth.uid()) OR 
  ((tenant_id = get_user_tenant_id(auth.uid())) AND (is_owner(auth.uid()) OR is_manager(auth.uid()))) OR 
  is_super_admin(auth.uid())
));

CREATE POLICY "Authenticated users can manage their own sessions" 
ON public.work_sessions FOR ALL 
USING (auth.uid() IS NOT NULL AND user_id = auth.uid())
WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());