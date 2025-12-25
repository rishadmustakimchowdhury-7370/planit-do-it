-- Fix existing trial users: set trial_expires_at based on created_at + 7 days
UPDATE tenants 
SET 
  trial_expires_at = created_at + interval '7 days', 
  trial_days = 7,
  subscription_plan_id = (SELECT id FROM subscription_plans WHERE slug = 'starter' AND is_active = true LIMIT 1)
WHERE subscription_status = 'trial' 
  AND trial_expires_at IS NULL;