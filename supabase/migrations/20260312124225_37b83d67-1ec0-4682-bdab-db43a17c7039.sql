-- Update provider to apisportmax
UPDATE platform_settings SET football_api_provider = 'apisportmax';

-- Remove duplicate cron job (keep only the 00:01 one)
SELECT cron.unschedule('cache-football-matches-daily');