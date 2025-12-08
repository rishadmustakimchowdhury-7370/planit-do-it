-- Create temp_login_links table for secure single-use login
CREATE TABLE public.temp_login_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token_hash text NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  created_by uuid REFERENCES auth.users(id),
  used_at timestamp with time zone,
  reason text,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.temp_login_links ENABLE ROW LEVEL SECURITY;

-- Only super admins can manage temp login links
CREATE POLICY "Super admins can manage temp login links"
ON public.temp_login_links FOR ALL
USING (is_super_admin(auth.uid()));

-- Create email_templates table
CREATE TABLE public.email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  subject text NOT NULL,
  html_content text NOT NULL,
  variables jsonb DEFAULT '[]'::jsonb,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

-- Super admins can manage email templates
CREATE POLICY "Super admins can manage email templates"
ON public.email_templates FOR ALL
USING (is_super_admin(auth.uid()));

-- Anyone can view active templates (for edge function use)
CREATE POLICY "Anyone can view active templates"
ON public.email_templates FOR SELECT
USING (is_active = true);

-- Create site_branding table for platform-level settings
CREATE TABLE public.site_branding (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  logo_url text,
  favicon_url text,
  primary_color text DEFAULT '#0ea5e9',
  secondary_color text DEFAULT '#6366f1',
  site_title text DEFAULT 'Recruitsy',
  meta_description text,
  social_links jsonb DEFAULT '{}'::jsonb,
  chat_widget_script text,
  updated_by uuid REFERENCES auth.users(id),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.site_branding ENABLE ROW LEVEL SECURITY;

-- Anyone can view site branding
CREATE POLICY "Anyone can view site branding"
ON public.site_branding FOR SELECT
USING (true);

-- Super admins can manage site branding
CREATE POLICY "Super admins can manage site branding"
ON public.site_branding FOR ALL
USING (is_super_admin(auth.uid()));

-- Create videos table for tutorials
CREATE TABLE public.videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  youtube_id text NOT NULL,
  description text,
  order_index integer DEFAULT 0,
  is_visible boolean DEFAULT true,
  is_featured boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;

-- Anyone can view visible videos
CREATE POLICY "Anyone can view visible videos"
ON public.videos FOR SELECT
USING (is_visible = true);

-- Super admins can manage videos
CREATE POLICY "Super admins can manage videos"
ON public.videos FOR ALL
USING (is_super_admin(auth.uid()));

-- Add grace_until column to tenants if not exists
ALTER TABLE public.tenants 
ADD COLUMN IF NOT EXISTS grace_until timestamp with time zone,
ADD COLUMN IF NOT EXISTS is_paused boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS paused_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS paused_reason text;

-- Create indexes
CREATE INDEX idx_temp_login_links_token ON public.temp_login_links(token_hash);
CREATE INDEX idx_temp_login_links_user ON public.temp_login_links(user_id);
CREATE INDEX idx_videos_order ON public.videos(order_index);

-- Insert default email templates
INSERT INTO public.email_templates (name, subject, html_content, variables) VALUES
('team_invitation', 'You''ve been invited to join {{tenant_name}} on Recruitsy', 
'<h1>Welcome to Recruitsy!</h1><p>Hi {{invitee_name}},</p><p>You''ve been invited by {{inviter_name}} to join {{tenant_name}} as a {{role}}.</p><p><a href="{{accept_link}}" style="background:#0ea5e9;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;">Accept Invitation</a></p><p>This invitation expires on {{expires_at}}.</p>',
'["invitee_name", "inviter_name", "tenant_name", "role", "accept_link", "expires_at"]'::jsonb),

('password_reset', 'Reset your Recruitsy password', 
'<h1>Password Reset</h1><p>Hi {{name}},</p><p>Click the button below to reset your password:</p><p><a href="{{reset_link}}" style="background:#0ea5e9;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;">Reset Password</a></p><p>This link expires in 1 hour.</p>',
'["name", "reset_link"]'::jsonb),

('renewal_reminder', 'Your Recruitsy subscription expires soon', 
'<h1>Subscription Reminder</h1><p>Hi {{name}},</p><p>Your {{plan_name}} subscription will expire on {{expiry_date}}.</p><p>Renew now to continue using Recruitsy without interruption.</p><p><a href="{{renewal_link}}" style="background:#0ea5e9;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;">Renew Now</a></p>',
'["name", "plan_name", "expiry_date", "renewal_link"]'::jsonb),

('account_paused', 'Your Recruitsy account has been paused', 
'<h1>Account Paused</h1><p>Hi {{name}},</p><p>Your Recruitsy account has been paused.</p><p>Reason: {{reason}}</p><p>Please contact support if you have questions.</p>',
'["name", "reason"]'::jsonb),

('temp_login', 'Your temporary login link for Recruitsy', 
'<h1>Temporary Login</h1><p>Hi {{name}},</p><p>Here is your single-use login link:</p><p><a href="{{login_link}}" style="background:#0ea5e9;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;">Login Now</a></p><p>This link expires in {{expires_in}} minutes and can only be used once.</p>',
'["name", "login_link", "expires_in"]'::jsonb);

-- Insert default site branding
INSERT INTO public.site_branding (site_title, meta_description) 
VALUES ('Recruitsy', 'AI-Powered Recruitment CRM Platform')
ON CONFLICT DO NOTHING;