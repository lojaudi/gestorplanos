
ALTER TABLE public.platform_settings
ADD COLUMN football_api_key_secondary text DEFAULT NULL;

COMMENT ON COLUMN public.platform_settings.football_api_key_secondary IS 'API Key for football-data.org as secondary provider';
