-- Create testimonials table for dynamic testimonials on landing page
CREATE TABLE public.testimonials (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quote text NOT NULL,
  author_name text NOT NULL,
  author_role text NOT NULL,
  author_avatar text,
  rating integer DEFAULT 5,
  is_featured boolean DEFAULT false,
  is_active boolean DEFAULT true,
  order_index integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.testimonials ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Anyone can view active testimonials" ON public.testimonials FOR SELECT USING (is_active = true);
CREATE POLICY "Super admins can manage testimonials" ON public.testimonials FOR ALL USING (is_super_admin(auth.uid()));

-- Create trigger for updated_at
CREATE TRIGGER update_testimonials_updated_at BEFORE UPDATE ON public.testimonials FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add line_items column to invoices table for invoice preview
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS company_name text;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS company_address text;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS company_phone text;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS company_logo text;

-- Create email_logs table to track sent emails
CREATE TABLE public.email_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  recipient_email text NOT NULL,
  subject text NOT NULL,
  template_name text,
  status text DEFAULT 'sent',
  error_message text,
  metadata jsonb DEFAULT '{}',
  tenant_id uuid REFERENCES public.tenants(id),
  sent_by uuid,
  sent_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view email logs in their tenant" ON public.email_logs FOR SELECT USING (tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()));
CREATE POLICY "Users can insert email logs" ON public.email_logs FOR INSERT WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()));

-- Add signature column to profiles for email/WhatsApp signatures
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email_signature text;

-- Seed some initial testimonials
INSERT INTO public.testimonials (quote, author_name, author_role, author_avatar, is_featured, order_index) VALUES 
('Recruitsy cut our time-to-hire by 60%. The AI matching is incredibly accurate.', 'Sarah Johnson', 'Head of Talent, TechCorp', 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=face', true, 1),
('Finally, a recruitment tool that actually understands what we''re looking for.', 'Michael Chen', 'CEO, Fintech Innovations', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face', true, 2),
('The pipeline visualization changed how our team collaborates on hiring.', 'Emily Davis', 'HR Director, HealthTech Pro', 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop&crop=face', true, 3);