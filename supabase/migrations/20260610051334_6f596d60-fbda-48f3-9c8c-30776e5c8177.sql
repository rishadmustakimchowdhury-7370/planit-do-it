ALTER TABLE public.placements
  ADD COLUMN IF NOT EXISTS fee_pct numeric,
  ADD COLUMN IF NOT EXISTS guarantee_period_days integer;