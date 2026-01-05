-- Update all email template subjects to use HireMetrics branding
UPDATE email_templates SET subject = 'Your HireMetrics account has been paused' WHERE name = 'account_paused';
UPDATE email_templates SET subject = 'Verify Your Email - HireMetrics' WHERE name = 'account_verification';
UPDATE email_templates SET subject = 'Reset Your Password - HireMetrics' WHERE name = 'forgot_password';
UPDATE email_templates SET subject = 'Your Invoice from HireMetrics' WHERE name = 'invoice';
UPDATE email_templates SET subject = 'Reset your HireMetrics password' WHERE name = 'password_reset';
UPDATE email_templates SET subject = 'Your HireMetrics subscription expires soon' WHERE name = 'renewal_reminder';
UPDATE email_templates SET subject = 'Your HireMetrics Subscription Has Expired' WHERE name = 'subscription_expired';
UPDATE email_templates SET subject = 'You''ve been invited to join {{tenant_name}} on HireMetrics' WHERE name = 'team_invitation';
UPDATE email_templates SET subject = 'Your temporary login link for HireMetrics' WHERE name = 'temp_login';
UPDATE email_templates SET subject = 'You Have Been Invited to HireMetrics' WHERE name = 'user_invite';
UPDATE email_templates SET subject = 'Welcome to HireMetrics!' WHERE name = 'welcome';

-- Also update html_content to replace old branding references
UPDATE email_templates SET html_content = REPLACE(html_content, 'RecruitifyCRM', 'HireMetrics') WHERE html_content LIKE '%RecruitifyCRM%';
UPDATE email_templates SET html_content = REPLACE(html_content, 'Recruitsy', 'HireMetrics') WHERE html_content LIKE '%Recruitsy%';
UPDATE email_templates SET html_content = REPLACE(html_content, 'recruitifycrm', 'hiremetrics') WHERE html_content LIKE '%recruitifycrm%';