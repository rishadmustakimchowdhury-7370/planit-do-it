-- Create demo_bookings table
CREATE TABLE public.demo_bookings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  whatsapp_number TEXT,
  preferred_date DATE NOT NULL,
  preferred_time TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.demo_bookings ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can insert demo bookings (public form)
CREATE POLICY "Anyone can submit demo booking"
ON public.demo_bookings
FOR INSERT
WITH CHECK (true);

-- Policy: Super admins can view/manage all demo bookings
CREATE POLICY "Super admins can manage demo bookings"
ON public.demo_bookings
FOR ALL
USING (is_super_admin(auth.uid()));

-- Insert demo video URL setting if not exists
INSERT INTO public.platform_settings (key, value, description)
VALUES ('demo_video_url', '""', 'YouTube demo video URL for landing page Watch Demo button')
ON CONFLICT (key) DO NOTHING;