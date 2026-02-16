
-- Platform settings table (single row, admin-managed)
CREATE TABLE public.platform_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  system_name text NOT NULL DEFAULT 'CobrançaZap',
  logo_url text,
  favicon_url text,
  primary_color text NOT NULL DEFAULT '#3b82f6',
  secondary_color text NOT NULL DEFAULT '#1e40af',
  accent_color text NOT NULL DEFAULT '#f59e0b',
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view platform settings"
ON public.platform_settings FOR SELECT
USING (true);

CREATE POLICY "Only admins can insert platform settings"
ON public.platform_settings FOR INSERT
WITH CHECK (is_admin());

CREATE POLICY "Only admins can update platform settings"
ON public.platform_settings FOR UPDATE
USING (is_admin());

-- Insert default row
INSERT INTO public.platform_settings (system_name) VALUES ('CobrançaZap');

-- Tutorials table
CREATE TABLE public.tutorials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  video_url text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_published boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.tutorials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view published tutorials"
ON public.tutorials FOR SELECT
USING (is_published = true OR is_admin());

CREATE POLICY "Only admins can insert tutorials"
ON public.tutorials FOR INSERT
WITH CHECK (is_admin());

CREATE POLICY "Only admins can update tutorials"
ON public.tutorials FOR UPDATE
USING (is_admin());

CREATE POLICY "Only admins can delete tutorials"
ON public.tutorials FOR DELETE
USING (is_admin());

-- Storage bucket for platform assets (logo, favicon)
INSERT INTO storage.buckets (id, name, public)
VALUES ('platform-assets', 'platform-assets', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Platform assets are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'platform-assets');

CREATE POLICY "Only admins can upload platform assets"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'platform-assets' AND (SELECT is_admin()));

CREATE POLICY "Only admins can update platform assets"
ON storage.objects FOR UPDATE
USING (bucket_id = 'platform-assets' AND (SELECT is_admin()));

CREATE POLICY "Only admins can delete platform assets"
ON storage.objects FOR DELETE
USING (bucket_id = 'platform-assets' AND (SELECT is_admin()));

-- Trigger for updated_at
CREATE TRIGGER update_platform_settings_updated_at
BEFORE UPDATE ON public.platform_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tutorials_updated_at
BEFORE UPDATE ON public.tutorials
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
