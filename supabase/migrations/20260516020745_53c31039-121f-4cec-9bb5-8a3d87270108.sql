
CREATE TABLE public.whmcs_global_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_url text NOT NULL DEFAULT '',
  api_identifier text NOT NULL DEFAULT '',
  api_secret text NOT NULL DEFAULT '',
  is_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.whmcs_global_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view whmcs config" ON public.whmcs_global_config
  FOR SELECT USING (is_admin());
CREATE POLICY "Admins can insert whmcs config" ON public.whmcs_global_config
  FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "Admins can update whmcs config" ON public.whmcs_global_config
  FOR UPDATE USING (is_admin());
CREATE POLICY "Admins can delete whmcs config" ON public.whmcs_global_config
  FOR DELETE USING (is_admin());

CREATE TRIGGER update_whmcs_global_config_updated_at
  BEFORE UPDATE ON public.whmcs_global_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
