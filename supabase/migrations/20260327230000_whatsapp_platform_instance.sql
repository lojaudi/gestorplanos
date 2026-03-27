CREATE TABLE public.whatsapp_platform_instance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_name text NOT NULL,
  is_connected boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_platform_instance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view whatsapp platform instance" ON public.whatsapp_platform_instance
  FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE POLICY "Admins can insert whatsapp platform instance" ON public.whatsapp_platform_instance
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update whatsapp platform instance" ON public.whatsapp_platform_instance
  FOR UPDATE TO authenticated
  USING (public.is_admin());

CREATE POLICY "Admins can delete whatsapp platform instance" ON public.whatsapp_platform_instance
  FOR DELETE TO authenticated
  USING (public.is_admin());

CREATE TRIGGER update_whatsapp_platform_instance_updated_at
  BEFORE UPDATE ON public.whatsapp_platform_instance
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

