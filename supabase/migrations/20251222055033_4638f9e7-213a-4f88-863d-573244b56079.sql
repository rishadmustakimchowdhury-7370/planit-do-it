-- Create linkedin_message_templates table
CREATE TABLE public.linkedin_message_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  subject TEXT,
  body TEXT NOT NULL,
  category TEXT DEFAULT 'general',
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create linkedin_message_logs table
CREATE TABLE public.linkedin_message_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  job_id UUID REFERENCES public.jobs(id) ON DELETE SET NULL,
  template_id UUID REFERENCES public.linkedin_message_templates(id) ON DELETE SET NULL,
  sent_by UUID NOT NULL REFERENCES auth.users(id),
  message_text TEXT NOT NULL,
  status TEXT DEFAULT 'sent',
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on both tables
ALTER TABLE public.linkedin_message_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.linkedin_message_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies for linkedin_message_templates
CREATE POLICY "Users can view templates in their tenant"
  ON public.linkedin_message_templates FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can create templates in their tenant"
  ON public.linkedin_message_templates FOR INSERT
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update templates in their tenant"
  ON public.linkedin_message_templates FOR UPDATE
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can delete templates in their tenant"
  ON public.linkedin_message_templates FOR DELETE
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

-- RLS policies for linkedin_message_logs
CREATE POLICY "Users can view message logs in their tenant"
  ON public.linkedin_message_logs FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can create message logs in their tenant"
  ON public.linkedin_message_logs FOR INSERT
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

-- Create indexes for performance
CREATE INDEX idx_linkedin_templates_tenant ON public.linkedin_message_templates(tenant_id);
CREATE INDEX idx_linkedin_logs_tenant ON public.linkedin_message_logs(tenant_id);
CREATE INDEX idx_linkedin_logs_candidate ON public.linkedin_message_logs(candidate_id);
CREATE INDEX idx_linkedin_logs_sent_by ON public.linkedin_message_logs(sent_by);
CREATE INDEX idx_linkedin_logs_sent_at ON public.linkedin_message_logs(sent_at);

-- Add trigger for updated_at on templates
CREATE TRIGGER update_linkedin_templates_updated_at
  BEFORE UPDATE ON public.linkedin_message_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();