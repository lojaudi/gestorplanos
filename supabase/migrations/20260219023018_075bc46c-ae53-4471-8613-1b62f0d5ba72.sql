ALTER TABLE public.platform_settings 
ADD COLUMN IF NOT EXISTS football_apisport_leagues jsonb DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.platform_settings.football_apisport_leagues IS 'Selected league IDs for apisport.online provider';