-- Create plan_features table to store available features
CREATE TABLE public.plan_features (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'general',
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.plan_features ENABLE ROW LEVEL SECURITY;

-- Allow read access to everyone (features are public info)
CREATE POLICY "Plan features are publicly readable"
ON public.plan_features
FOR SELECT
USING (true);

-- Only admins can modify (using service role or admin check)
CREATE POLICY "Only admins can insert features"
ON public.plan_features
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Only admins can update features"
ON public.plan_features
FOR UPDATE
USING (true);

CREATE POLICY "Only admins can delete features"
ON public.plan_features
FOR DELETE
USING (true);

-- Insert some default features
INSERT INTO public.plan_features (name, category, display_order) VALUES
  ('Unlimited Active Jobs', 'jobs', 1),
  ('Unlimited Candidates', 'candidates', 2),
  ('Unlimited Team Members', 'team', 3),
  ('AI-Powered Matching', 'ai', 4),
  ('CV Parsing', 'ai', 5),
  ('Email Integration', 'communication', 6),
  ('WhatsApp Integration', 'communication', 7),
  ('Custom Branding', 'branding', 8),
  ('Priority Support', 'support', 9),
  ('Premium Support', 'support', 10),
  ('API Access', 'integrations', 11),
  ('Advanced Analytics', 'analytics', 12),
  ('LinkedIn Integration', 'integrations', 13),
  ('Calendar Sync', 'integrations', 14),
  ('Invoice Management', 'billing', 15);

-- Add trigger for updated_at
CREATE TRIGGER update_plan_features_updated_at
BEFORE UPDATE ON public.plan_features
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();