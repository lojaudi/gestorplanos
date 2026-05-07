
-- Fix the view to use SECURITY INVOKER
DROP VIEW IF EXISTS public.platform_settings_public;

CREATE VIEW public.platform_settings_public
WITH (security_invoker = true)
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

GRANT SELECT ON public.platform_settings_public TO anon, authenticated;

-- We need a SELECT policy that allows anon/authenticated to read platform_settings
-- but ONLY through the view (which only exposes safe columns).
-- Since security_invoker means the querying user's permissions apply,
-- we need a policy that allows SELECT but the view limits columns.
-- Add a policy for authenticated users to read (view will filter columns):
CREATE POLICY "Authenticated can view platform settings"
ON public.platform_settings
FOR SELECT
TO authenticated
USING (true);

-- Also allow anon for landing page branding:
CREATE POLICY "Anon can view platform settings"
ON public.platform_settings
FOR SELECT
TO anon
USING (true);
