
-- Add football config columns to platform_settings
ALTER TABLE public.platform_settings
ADD COLUMN football_api_key text DEFAULT '',
ADD COLUMN football_api_provider text DEFAULT 'api-football',
ADD COLUMN football_timezone text DEFAULT 'America/Sao_Paulo',
ADD COLUMN football_date_format text DEFAULT 'DD/MM HH:mm',
ADD COLUMN football_default_font text DEFAULT 'Inter',
ADD COLUMN football_primary_color text DEFAULT '#1e3a5f',
ADD COLUMN football_secondary_color text DEFAULT '#ffffff',
ADD COLUMN football_accent_color text DEFAULT '#f59e0b',
ADD COLUMN football_default_logo_url text,
ADD COLUMN football_banners_enabled boolean DEFAULT false;

-- Create football_user_config table
CREATE TABLE public.football_user_config (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  logo_url text,
  whatsapp_number text,
  custom_title text DEFAULT 'Jogos de Hoje',
  primary_color text,
  secondary_color text,
  accent_color text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.football_user_config ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own football config"
ON public.football_user_config FOR SELECT
USING (auth.uid() = user_id OR is_admin());

CREATE POLICY "Users can insert own football config"
ON public.football_user_config FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own football config"
ON public.football_user_config FOR UPDATE
USING (auth.uid() = user_id);

-- Timestamp trigger
CREATE TRIGGER update_football_user_config_updated_at
BEFORE UPDATE ON public.football_user_config
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
