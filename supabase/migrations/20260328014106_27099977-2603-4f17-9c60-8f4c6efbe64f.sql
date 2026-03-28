CREATE TABLE public.whatsapp_platform_instance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_name text NOT NULL,
  is_connected boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_platform_instance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admins can view platform instance" ON public.whatsapp_platform_instance FOR SELECT USING (public.is_admin());
CREATE POLICY "Only admins can insert platform instance" ON public.whatsapp_platform_instance FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "Only admins can update platform instance" ON public.whatsapp_platform_instance FOR UPDATE USING (public.is_admin());
CREATE POLICY "Only admins can delete platform instance" ON public.whatsapp_platform_instance FOR DELETE USING (public.is_admin());