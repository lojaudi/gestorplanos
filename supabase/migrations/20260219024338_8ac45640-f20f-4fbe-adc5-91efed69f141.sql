ALTER TABLE public.platform_settings 
ADD COLUMN IF NOT EXISTS football_footballdata_leagues jsonb DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.platform_settings.football_footballdata_leagues IS 'Selected competition codes for football-data.org provider';