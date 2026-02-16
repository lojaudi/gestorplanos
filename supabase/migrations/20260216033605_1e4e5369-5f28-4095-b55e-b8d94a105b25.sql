
-- Table for user payment gateway configuration
CREATE TABLE public.payment_gateway_config (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  provider text NOT NULL DEFAULT 'mercado_pago',
  access_token text NOT NULL,
  is_enabled boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_gateway_config ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX idx_payment_gateway_config_user_provider ON public.payment_gateway_config(user_id, provider);

CREATE POLICY "Users can view own gateway config" ON public.payment_gateway_config
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own gateway config" ON public.payment_gateway_config
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own gateway config" ON public.payment_gateway_config
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own gateway config" ON public.payment_gateway_config
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_payment_gateway_config_updated_at
  BEFORE UPDATE ON public.payment_gateway_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Table for payment links
CREATE TABLE public.payment_links (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  description text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending',
  mp_payment_id text,
  qr_code_base64 text,
  pix_copy_paste text,
  expires_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own payment links" ON public.payment_links
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own payment links" ON public.payment_links
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own payment links" ON public.payment_links
  FOR UPDATE USING (auth.uid() = user_id);

-- Public access for payment page (by link id)
CREATE POLICY "Anyone can view payment link by id" ON public.payment_links
  FOR SELECT USING (true);
