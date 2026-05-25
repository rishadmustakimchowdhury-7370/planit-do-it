
-- Private bucket for branded submission packs
INSERT INTO storage.buckets (id, name, public)
VALUES ('submission-packs', 'submission-packs', false)
ON CONFLICT (id) DO NOTHING;

-- Agency members: read/write within their own tenant folder
CREATE POLICY "sub_packs_agency_read"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'submission-packs'
  AND public.user_belongs_to_tenant(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "sub_packs_agency_write"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'submission-packs'
  AND public.user_belongs_to_tenant(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "sub_packs_agency_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'submission-packs'
  AND public.user_belongs_to_tenant(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "sub_packs_agency_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'submission-packs'
  AND public.user_belongs_to_tenant(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

-- Client recipients: read pack only if they are a recipient on the submission
CREATE POLICY "sub_packs_client_read"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'submission-packs'
  AND EXISTS (
    SELECT 1
    FROM public.submission_recipients sr
    WHERE sr.submission_id::text = (storage.foldername(name))[2]
      AND sr.client_user_id = auth.uid()
  )
);
