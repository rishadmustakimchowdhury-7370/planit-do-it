-- Create storage bucket for trusted client logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('trusted-clients', 'trusted-clients', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access to trusted client logos
CREATE POLICY "Public can view trusted client logos"
ON storage.objects
FOR SELECT
USING (bucket_id = 'trusted-clients');

-- Allow authenticated admins to upload logos
CREATE POLICY "Admins can upload trusted client logos"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'trusted-clients');

-- Allow authenticated admins to update logos
CREATE POLICY "Admins can update trusted client logos"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'trusted-clients');

-- Allow authenticated admins to delete logos
CREATE POLICY "Admins can delete trusted client logos"
ON storage.objects
FOR DELETE
USING (bucket_id = 'trusted-clients');