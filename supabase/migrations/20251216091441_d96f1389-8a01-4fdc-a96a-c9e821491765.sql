-- Update site branding to Recruitify CRM
UPDATE public.site_branding 
SET 
  site_title = 'Recruitify CRM',
  meta_description = 'AI-Powered Recruitment CRM - Streamline your hiring process with Recruitify CRM',
  updated_at = now()
WHERE id = (SELECT id FROM public.site_branding LIMIT 1);

-- Update platform settings for the new branding
UPDATE public.platform_settings 
SET value = '"Recruitify CRM"', updated_at = now()
WHERE key = 'site_name';

UPDATE public.platform_settings 
SET value = '"info@recruitifycrm.com"', updated_at = now()
WHERE key = 'contact_email';

-- Update email templates to use new branding
UPDATE public.email_templates
SET 
  html_content = REPLACE(REPLACE(html_content, 'Recruitsy', 'Recruitify CRM'), 'recruitsy', 'recruitifycrm'),
  updated_at = now()
WHERE html_content LIKE '%Recruitsy%' OR html_content LIKE '%recruitsy%';

-- Promote info@recruitifycrm.com to super_admin if they exist
INSERT INTO public.user_roles (user_id, role, tenant_id)
SELECT id, 'super_admin', NULL 
FROM public.profiles 
WHERE email = 'info@recruitifycrm.com'
ON CONFLICT DO NOTHING;

-- Update testimonials to use new branding
UPDATE public.testimonials
SET quote = REPLACE(quote, 'Recruitsy', 'Recruitify CRM')
WHERE quote LIKE '%Recruitsy%';