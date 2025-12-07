-- Fix function search path mutable warning
CREATE OR REPLACE FUNCTION public.generate_invoice_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year TEXT;
  v_count INTEGER;
BEGIN
  v_year := to_char(now(), 'YYYY');
  SELECT COUNT(*) + 1 INTO v_count FROM public.invoices WHERE invoice_number LIKE 'INV-' || v_year || '-%';
  RETURN 'INV-' || v_year || '-' || LPAD(v_count::TEXT, 5, '0');
END;
$$;

-- Create storage bucket for CVs and documents
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents',
  'documents',
  false,
  10485760,
  ARRAY['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/jpeg', 'image/png']
);

-- Storage policies for documents bucket
CREATE POLICY "Users can upload documents to their tenant folder"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'documents' AND
  auth.uid() IS NOT NULL
);

CREATE POLICY "Users can view documents in their tenant"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'documents' AND
  auth.uid() IS NOT NULL
);

CREATE POLICY "Users can update their own documents"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'documents' AND
  auth.uid() IS NOT NULL
);

CREATE POLICY "Users can delete their own documents"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'documents' AND
  auth.uid() IS NOT NULL
);