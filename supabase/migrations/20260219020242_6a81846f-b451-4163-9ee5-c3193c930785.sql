
ALTER TABLE public.platform_settings 
ADD COLUMN IF NOT EXISTS football_api_key_tertiary text DEFAULT NULL;

COMMENT ON COLUMN public.platform_settings.football_api_key_tertiary IS 'API key for apisport.online (SportData)';
