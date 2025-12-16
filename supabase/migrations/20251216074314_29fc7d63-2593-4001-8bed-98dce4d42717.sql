-- Update Starter plan with Stripe price ID
UPDATE subscription_plans 
SET stripe_price_id_monthly = 'price_1SepWTBCm829b1DrvmfyXdUd'
WHERE slug = 'starter';

-- Update Pro plan with Stripe price ID
UPDATE subscription_plans 
SET stripe_price_id_monthly = 'price_1SepWxBCm829b1DrOMV8ZyaW'
WHERE slug = 'pro';

-- Update Agency plan with Stripe price ID
UPDATE subscription_plans 
SET stripe_price_id_monthly = 'price_1SepXJBCm829b1Dr3okFI2ae'
WHERE slug = 'agency';