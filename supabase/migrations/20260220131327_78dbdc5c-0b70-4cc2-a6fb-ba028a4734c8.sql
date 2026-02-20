
-- Create table to cache daily football matches
CREATE TABLE public.football_daily_cache (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cache_date date NOT NULL DEFAULT CURRENT_DATE,
  provider text NOT NULL DEFAULT 'api-football',
  matches jsonb NOT NULL DEFAULT '[]'::jsonb,
  channels jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Only one row per date+provider
CREATE UNIQUE INDEX idx_football_daily_cache_date_provider ON public.football_daily_cache (cache_date, provider);

-- Enable RLS
ALTER TABLE public.football_daily_cache ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read cached matches
CREATE POLICY "Anyone authenticated can view cached matches"
ON public.football_daily_cache
FOR SELECT
USING (true);

-- Only service role inserts/updates (via edge function)
CREATE POLICY "Service role can insert cache"
ON public.football_daily_cache
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Service role can update cache"
ON public.football_daily_cache
FOR UPDATE
USING (true);

CREATE POLICY "Service role can delete cache"
ON public.football_daily_cache
FOR DELETE
USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_football_daily_cache_updated_at
BEFORE UPDATE ON public.football_daily_cache
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
