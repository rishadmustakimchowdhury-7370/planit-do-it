
-- Phase 4: Contextual discussions + structured client feedback

-- 1. candidate_discussions: threaded messages between internal staff and a client org about a specific candidate
CREATE TABLE public.candidate_discussions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  client_org_id uuid NOT NULL REFERENCES public.client_organizations(id) ON DELETE CASCADE,
  job_candidate_id uuid NOT NULL REFERENCES public.job_candidates(id) ON DELETE CASCADE,
  author_user_id uuid NOT NULL,
  author_type text NOT NULL CHECK (author_type IN ('internal','client')),
  body text NOT NULL,
  parent_id uuid REFERENCES public.candidate_discussions(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_cand_disc_jc ON public.candidate_discussions(job_candidate_id, created_at);
CREATE INDEX idx_cand_disc_org ON public.candidate_discussions(client_org_id, created_at);

ALTER TABLE public.candidate_discussions ENABLE ROW LEVEL SECURITY;

-- Internal staff (same tenant + super admin) can view & write
CREATE POLICY "internal_view_discussions" ON public.candidate_discussions
  FOR SELECT TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR public.user_belongs_to_tenant(auth.uid(), tenant_id)
  );

CREATE POLICY "internal_insert_discussions" ON public.candidate_discussions
  FOR INSERT TO authenticated
  WITH CHECK (
    author_user_id = auth.uid()
    AND author_type = 'internal'
    AND public.user_belongs_to_tenant(auth.uid(), tenant_id)
  );

-- Client users can view & write within their own org if the candidate is shared
CREATE POLICY "client_view_discussions" ON public.candidate_discussions
  FOR SELECT TO authenticated
  USING (
    public.is_client_user(auth.uid())
    AND client_org_id = public.client_org_for_user(auth.uid())
    AND public.client_can_see_candidate(auth.uid(), job_candidate_id)
  );

CREATE POLICY "client_insert_discussions" ON public.candidate_discussions
  FOR INSERT TO authenticated
  WITH CHECK (
    author_user_id = auth.uid()
    AND author_type = 'client'
    AND public.is_client_user(auth.uid())
    AND client_org_id = public.client_org_for_user(auth.uid())
    AND public.client_can_see_candidate(auth.uid(), job_candidate_id)
  );

-- Authors can edit/delete their own messages
CREATE POLICY "author_update_discussions" ON public.candidate_discussions
  FOR UPDATE TO authenticated
  USING (author_user_id = auth.uid())
  WITH CHECK (author_user_id = auth.uid());

CREATE POLICY "author_delete_discussions" ON public.candidate_discussions
  FOR DELETE TO authenticated
  USING (author_user_id = auth.uid());

CREATE TRIGGER trg_cand_disc_updated
  BEFORE UPDATE ON public.candidate_discussions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- 2. candidate_feedback: structured rating + decision from a client about a candidate
CREATE TABLE public.candidate_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  client_org_id uuid NOT NULL REFERENCES public.client_organizations(id) ON DELETE CASCADE,
  job_candidate_id uuid NOT NULL REFERENCES public.job_candidates(id) ON DELETE CASCADE,
  author_user_id uuid NOT NULL,
  author_type text NOT NULL CHECK (author_type IN ('internal','client')),
  rating int CHECK (rating BETWEEN 1 AND 5),
  decision text CHECK (decision IN ('advance','hold','reject','interview','offer')),
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_cand_fb_jc ON public.candidate_feedback(job_candidate_id, created_at);
CREATE INDEX idx_cand_fb_org ON public.candidate_feedback(client_org_id, created_at);

ALTER TABLE public.candidate_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "internal_view_feedback" ON public.candidate_feedback
  FOR SELECT TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR public.user_belongs_to_tenant(auth.uid(), tenant_id)
  );

CREATE POLICY "internal_insert_feedback" ON public.candidate_feedback
  FOR INSERT TO authenticated
  WITH CHECK (
    author_user_id = auth.uid()
    AND author_type = 'internal'
    AND public.user_belongs_to_tenant(auth.uid(), tenant_id)
  );

CREATE POLICY "client_view_feedback" ON public.candidate_feedback
  FOR SELECT TO authenticated
  USING (
    public.is_client_user(auth.uid())
    AND client_org_id = public.client_org_for_user(auth.uid())
    AND public.client_can_see_candidate(auth.uid(), job_candidate_id)
  );

CREATE POLICY "client_insert_feedback" ON public.candidate_feedback
  FOR INSERT TO authenticated
  WITH CHECK (
    author_user_id = auth.uid()
    AND author_type = 'client'
    AND public.is_client_user(auth.uid())
    AND client_org_id = public.client_org_for_user(auth.uid())
    AND public.client_can_see_candidate(auth.uid(), job_candidate_id)
  );

CREATE POLICY "author_update_feedback" ON public.candidate_feedback
  FOR UPDATE TO authenticated
  USING (author_user_id = auth.uid())
  WITH CHECK (author_user_id = auth.uid());

CREATE POLICY "author_delete_feedback" ON public.candidate_feedback
  FOR DELETE TO authenticated
  USING (author_user_id = auth.uid());

CREATE TRIGGER trg_cand_fb_updated
  BEFORE UPDATE ON public.candidate_feedback
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
