-- Create whatsapp_templates table
CREATE TABLE public.whatsapp_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  message TEXT NOT NULL,
  variables JSONB DEFAULT '[]'::jsonb,
  category TEXT DEFAULT 'general',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create whatsapp_logs table
CREATE TABLE public.whatsapp_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES public.tenants(id),
  candidate_id UUID REFERENCES public.candidates(id),
  template_id UUID REFERENCES public.whatsapp_templates(id),
  phone_number TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  error_message TEXT,
  sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create whatsapp_settings table for API credentials
CREATE TABLE public.whatsapp_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  api_provider TEXT DEFAULT 'twilio',
  api_key TEXT,
  api_secret TEXT,
  phone_number_id TEXT,
  business_account_id TEXT,
  is_configured BOOLEAN DEFAULT false,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_by UUID
);

-- Enable RLS
ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_settings ENABLE ROW LEVEL SECURITY;

-- RLS policies for whatsapp_templates (super admin can manage, all can view active)
CREATE POLICY "Super admins can manage whatsapp templates" 
ON public.whatsapp_templates 
FOR ALL 
USING (is_super_admin(auth.uid()));

CREATE POLICY "Anyone can view active templates" 
ON public.whatsapp_templates 
FOR SELECT 
USING (is_active = true);

-- RLS policies for whatsapp_logs
CREATE POLICY "Users can view logs in their tenant" 
ON public.whatsapp_logs 
FOR SELECT 
USING ((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()));

CREATE POLICY "Users can insert logs in their tenant" 
ON public.whatsapp_logs 
FOR INSERT 
WITH CHECK ((tenant_id = get_user_tenant_id(auth.uid())) OR is_super_admin(auth.uid()));

-- RLS policies for whatsapp_settings (super admin only)
CREATE POLICY "Super admins can manage whatsapp settings" 
ON public.whatsapp_settings 
FOR ALL 
USING (is_super_admin(auth.uid()));

-- Add trigger for updated_at
CREATE TRIGGER update_whatsapp_templates_updated_at
BEFORE UPDATE ON public.whatsapp_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_whatsapp_settings_updated_at
BEFORE UPDATE ON public.whatsapp_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();