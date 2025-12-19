-- Add per-user AI credit assignment system
-- Owners can assign specific AI testing credits to individual recruiters

-- Add ai_credits_allocated column to user_roles
ALTER TABLE public.user_roles 
ADD COLUMN IF NOT EXISTS ai_credits_allocated integer DEFAULT 0;

-- Add ai_credits_used column to user_roles  
ALTER TABLE public.user_roles 
ADD COLUMN IF NOT EXISTS ai_credits_used integer DEFAULT 0;

-- Add comment
COMMENT ON COLUMN public.user_roles.ai_credits_allocated IS 'AI testing credits allocated by owner to this user';
COMMENT ON COLUMN public.user_roles.ai_credits_used IS 'AI testing credits used by this user';

-- Update ai_usage table to track which user used the credits
ALTER TABLE public.ai_usage 
ADD COLUMN IF NOT EXISTS allocated_from_user_credits boolean DEFAULT false;

-- Function to check if user has sufficient allocated AI credits
CREATE OR REPLACE FUNCTION public.has_user_ai_credits(_user_id uuid, _credits_needed integer)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND (ai_credits_allocated - ai_credits_used) >= _credits_needed
  );
$$;

-- Function to deduct AI credits from user allocation
CREATE OR REPLACE FUNCTION public.deduct_user_ai_credits(
  _user_id uuid,
  _credits integer,
  _tenant_id uuid,
  _action_type text,
  _metadata jsonb DEFAULT '{}'
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_allocated integer;
  v_current_used integer;
BEGIN
  -- Get current credits
  SELECT ai_credits_allocated, ai_credits_used 
  INTO v_current_allocated, v_current_used
  FROM public.user_roles
  WHERE user_id = _user_id
  LIMIT 1;
  
  -- Check if user has enough allocated credits
  IF v_current_allocated - v_current_used < _credits THEN
    RETURN false;
  END IF;
  
  -- Deduct from user allocation
  UPDATE public.user_roles
  SET ai_credits_used = ai_credits_used + _credits
  WHERE user_id = _user_id;
  
  -- Log usage
  INSERT INTO public.ai_usage (
    tenant_id,
    user_id,
    action_type,
    credits_used,
    allocated_from_user_credits,
    metadata
  ) VALUES (
    _tenant_id,
    _user_id,
    _action_type,
    _credits,
    true,
    _metadata
  );
  
  RETURN true;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.has_user_ai_credits TO authenticated;
GRANT EXECUTE ON FUNCTION public.deduct_user_ai_credits TO authenticated;