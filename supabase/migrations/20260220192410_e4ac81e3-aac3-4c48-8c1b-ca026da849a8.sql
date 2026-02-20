
-- Add plan expiry date to profiles
ALTER TABLE public.profiles
ADD COLUMN plan_expires_at timestamp with time zone NULL;

COMMENT ON COLUMN public.profiles.plan_expires_at IS 'When the user current plan expires. NULL = no expiry (legacy users)';

-- Create or ensure a "Free" admin plan exists (7 days, all modules, price 0)
INSERT INTO public.admin_plans (name, description, price, max_clients, duration_months, module_campaigns, module_games, module_banners, is_active)
SELECT 'Free', 'Plano gratuito de 7 dias', 0, 50, 1, true, true, true, true
WHERE NOT EXISTS (SELECT 1 FROM public.admin_plans WHERE name = 'Free');

-- Update handle_new_user to auto-assign Free plan with 7-day expiry
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  free_plan_id uuid;
BEGIN
  -- Find the Free plan
  SELECT id INTO free_plan_id FROM public.admin_plans WHERE name = 'Free' AND is_active = true LIMIT 1;

  INSERT INTO public.profiles (user_id, full_name, email, admin_plan_id, plan_expires_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.email,
    free_plan_id,
    now() + interval '7 days'
  );
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');
  
  RETURN NEW;
END;
$function$;
