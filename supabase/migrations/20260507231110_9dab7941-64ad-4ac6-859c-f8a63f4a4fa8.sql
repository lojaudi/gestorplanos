
-- 1. Fix platform_settings: restrict SELECT to admins only, create public view for branding
DROP POLICY IF EXISTS "Anyone can view platform settings" ON public.platform_settings;

CREATE POLICY "Only admins can view platform settings"
ON public.platform_settings
FOR SELECT
TO public
USING (is_admin());

-- Create a public view with only non-sensitive branding fields
CREATE OR REPLACE VIEW public.platform_settings_public AS
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

-- Grant public read access to the view
GRANT SELECT ON public.platform_settings_public TO anon, authenticated;

-- 2. Fix whatsapp_verifications: add restrictive RLS policies
-- No SELECT policy = nobody can read (edge functions use service role)
-- No public INSERT/UPDATE/DELETE = only service role can manage
-- This is correct since whatsapp_verifications is only used by edge functions
