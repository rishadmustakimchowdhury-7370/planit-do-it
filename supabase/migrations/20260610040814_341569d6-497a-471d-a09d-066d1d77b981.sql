
CREATE TABLE IF NOT EXISTS public.candidate_voice_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  author_user_id UUID NOT NULL,
  transcript TEXT,
  audio_url TEXT,
  duration_seconds INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.candidate_voice_notes TO authenticated;
GRANT ALL ON public.candidate_voice_notes TO service_role;

ALTER TABLE public.candidate_voice_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view candidate voice notes"
  ON public.candidate_voice_notes FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_super_admin(auth.uid()));

CREATE POLICY "Tenant members can add candidate voice notes"
  ON public.candidate_voice_notes FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()) AND author_user_id = auth.uid());

CREATE POLICY "Author or managers can update candidate voice notes"
  ON public.candidate_voice_notes FOR UPDATE TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid())
         AND (author_user_id = auth.uid() OR public.is_owner_or_manager_in_tenant(auth.uid(), tenant_id)));

CREATE POLICY "Author or managers can delete candidate voice notes"
  ON public.candidate_voice_notes FOR DELETE TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid())
         AND (author_user_id = auth.uid() OR public.is_owner_or_manager_in_tenant(auth.uid(), tenant_id)));

CREATE INDEX IF NOT EXISTS idx_candidate_voice_notes_candidate
  ON public.candidate_voice_notes(candidate_id, created_at DESC);

CREATE TRIGGER update_candidate_voice_notes_updated_at
  BEFORE UPDATE ON public.candidate_voice_notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
