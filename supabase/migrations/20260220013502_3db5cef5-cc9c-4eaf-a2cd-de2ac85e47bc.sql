
-- Table to cache daily AI-generated player images per user
CREATE TABLE public.player_image_cache (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  team_name text NOT NULL,
  image_url text NOT NULL,
  generated_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Unique constraint: one image per user per day
ALTER TABLE public.player_image_cache ADD CONSTRAINT unique_user_date UNIQUE (user_id, generated_date);

-- Index for fast lookups
CREATE INDEX idx_player_image_cache_user_date ON public.player_image_cache (user_id, generated_date);

-- Enable RLS
ALTER TABLE public.player_image_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own cached images"
  ON public.player_image_cache FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert cached images"
  ON public.player_image_cache FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service role can delete old cached images"
  ON public.player_image_cache FOR DELETE
  USING (true);
