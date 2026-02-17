
-- Table to store TMDB configuration per user
CREATE TABLE public.tmdb_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  api_key TEXT NOT NULL DEFAULT '',
  logo_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.tmdb_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tmdb config" ON public.tmdb_config
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own tmdb config" ON public.tmdb_config
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tmdb config" ON public.tmdb_config
  FOR UPDATE USING (auth.uid() = user_id);

CREATE TRIGGER update_tmdb_config_updated_at
  BEFORE UPDATE ON public.tmdb_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
