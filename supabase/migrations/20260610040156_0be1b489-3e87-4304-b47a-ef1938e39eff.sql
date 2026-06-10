ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS signature_agency TEXT,
  ADD COLUMN IF NOT EXISTS signature_website TEXT,
  ADD COLUMN IF NOT EXISTS signature_linkedin TEXT;