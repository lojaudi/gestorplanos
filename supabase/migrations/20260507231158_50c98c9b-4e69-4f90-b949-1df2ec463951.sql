
-- Remove the overly permissive policies we just added
DROP POLICY IF EXISTS "Authenticated can view platform settings" ON public.platform_settings;
DROP POLICY IF EXISTS "Anon can view platform settings" ON public.platform_settings;

-- Recreate the view as SECURITY DEFINER so it can read the table
-- even though the table itself is restricted to admins only
DROP VIEW IF EXISTS public.platform_settings_public;

CREATE VIEW public.platform_settings_public
WITH (security_barrier = true)
AS
SELECT
  id,
  system_name,
  logo_url,
  favicon_url,
  login_bg_url,
  primary_color,
  secondary_color,
  accent_color,
  whatsapp_verification_enabled,
  email_verification_enabled,
  landing_dark_mode,
  football_banners_enabled
FROM public.platform_settings;

-- Grant read access on the view
GRANT SELECT ON public.platform_settings_public TO anon, authenticated;
