-- Update site branding to use the new admin email
UPDATE public.site_branding 
SET 
  site_title = 'RecruitifyCRM',
  meta_description = 'AI-Powered Recruitment CRM - Streamline your hiring process with RecruitifyCRM',
  updated_at = now()
WHERE id = (SELECT id FROM public.site_branding LIMIT 1);

-- Update email templates to use the new branding (fixed syntax)
UPDATE public.email_templates
SET 
  html_content = REPLACE(REPLACE(html_content, 'Recruitsy', 'RecruitifyCRM'), 'recruitsy', 'recruitifycrm'),
  updated_at = now()
WHERE html_content LIKE '%Recruitsy%' OR html_content LIKE '%recruitsy%';