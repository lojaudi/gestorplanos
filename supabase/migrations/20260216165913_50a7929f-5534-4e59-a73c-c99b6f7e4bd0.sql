
-- Global WhatsApp config (admin-only, single row per admin or global)
CREATE TABLE public.whatsapp_global_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_url text NOT NULL,
  api_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_global_config ENABLE ROW LEVEL SECURITY;

-- Only admins can manage global config
CREATE POLICY "Admins can view global whatsapp config"
  ON public.whatsapp_global_config FOR SELECT
  USING (public.is_admin());

CREATE POLICY "Admins can insert global whatsapp config"
  ON public.whatsapp_global_config FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update global whatsapp config"
  ON public.whatsapp_global_config FOR UPDATE
  USING (public.is_admin());

CREATE POLICY "Admins can delete global whatsapp config"
  ON public.whatsapp_global_config FOR DELETE
  USING (public.is_admin());

-- Users need to read global config to use the API (via edge function with service role, so no policy needed for regular users)

-- Add trigger for updated_at
CREATE TRIGGER update_whatsapp_global_config_updated_at
  BEFORE UPDATE ON public.whatsapp_global_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
