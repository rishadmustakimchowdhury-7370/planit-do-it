-- Create a public storage bucket for branding assets (logos, favicons)
INSERT INTO storage.buckets (id, name, public)
VALUES ('branding-assets', 'branding-assets', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Allow authenticated users to upload branding assets
CREATE POLICY "Authenticated users can upload branding assets"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'branding-assets');

-- Allow public read access for branding assets
CREATE POLICY "Public can view branding assets"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'branding-assets');

-- Allow authenticated users to update their uploads
CREATE POLICY "Authenticated users can update branding assets"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'branding-assets');

-- Allow authenticated users to delete branding assets
CREATE POLICY "Authenticated users can delete branding assets"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'branding-assets');