-- Add source and status fields to testimonials for customer submissions
ALTER TABLE public.testimonials 
ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'admin',
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'approved',
ADD COLUMN IF NOT EXISTS submitted_email TEXT,
ADD COLUMN IF NOT EXISTS submitted_company TEXT;

-- Add index for faster filtering
CREATE INDEX IF NOT EXISTS idx_testimonials_status ON public.testimonials(status);
CREATE INDEX IF NOT EXISTS idx_testimonials_source ON public.testimonials(source);

-- Update RLS policy to allow anonymous users to insert testimonials (for customer submissions)
DROP POLICY IF EXISTS "Anyone can submit testimonials" ON public.testimonials;
CREATE POLICY "Anyone can submit testimonials" ON public.testimonials
FOR INSERT WITH CHECK (true);

-- Keep existing select policy for active testimonials
DROP POLICY IF EXISTS "Anyone can view active testimonials" ON public.testimonials;
CREATE POLICY "Anyone can view active testimonials" ON public.testimonials
FOR SELECT USING (is_active = true AND status = 'approved');