-- Create table for trusted client logos
CREATE TABLE public.trusted_clients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  logo_url TEXT NOT NULL,
  website_url TEXT,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.trusted_clients ENABLE ROW LEVEL SECURITY;

-- Create policy for public read access (logos are public on landing page)
CREATE POLICY "Trusted clients are publicly readable" 
ON public.trusted_clients 
FOR SELECT 
USING (is_active = true);

-- Create policy for admin management
CREATE POLICY "Admins can manage trusted clients" 
ON public.trusted_clients 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin'
  )
);

-- Create trigger for updated_at
CREATE TRIGGER update_trusted_clients_updated_at
BEFORE UPDATE ON public.trusted_clients
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();