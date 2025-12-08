-- Upgrade tenant to Agency plan for user rishadmustakim@gmail.com
UPDATE tenants 
SET 
  subscription_plan_id = '92438d61-9cde-432a-9b7c-eac1d51674d6',
  subscription_status = 'active',
  match_credits_limit = 500,
  match_credits_remaining = 500,
  subscription_ends_at = NOW() + INTERVAL '1 year'
WHERE id = 'bd9ffaf5-56e3-474a-b301-f56fa1d37738';