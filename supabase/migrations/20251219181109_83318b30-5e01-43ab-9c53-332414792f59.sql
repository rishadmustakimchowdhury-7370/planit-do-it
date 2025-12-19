-- Phase 1A: Add new role values to app_role enum
-- Must be in separate migration from usage due to PostgreSQL enum constraints

-- Add 'manager' role
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'app_role' AND e.enumlabel = 'manager') THEN
    ALTER TYPE public.app_role ADD VALUE 'manager';
  END IF;
END $$;

-- Add 'owner' role
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'app_role' AND e.enumlabel = 'owner') THEN
    ALTER TYPE public.app_role ADD VALUE 'owner';
  END IF;
END $$;