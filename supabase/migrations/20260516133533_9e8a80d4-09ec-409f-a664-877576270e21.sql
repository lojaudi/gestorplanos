
-- 1. payment_links: drop public SELECT policy
DROP POLICY IF EXISTS "Anyone can view payment link by id" ON public.payment_links;

-- 2. player_image_cache: drop overly permissive write/delete policies
DROP POLICY IF EXISTS "Service role can insert cached images" ON public.player_image_cache;
DROP POLICY IF EXISTS "Service role can delete old cached images" ON public.player_image_cache;

-- 3. football_daily_cache: drop overly permissive write/update/delete policies
DROP POLICY IF EXISTS "Service role can insert cache" ON public.football_daily_cache;
DROP POLICY IF EXISTS "Service role can update cache" ON public.football_daily_cache;
DROP POLICY IF EXISTS "Service role can delete cache" ON public.football_daily_cache;

-- 4. Storage tmdb-logo: scope to user folder (path: tmdb-logo/{user_id}/...)
DROP POLICY IF EXISTS "Users can upload own tmdb logo" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own tmdb logo" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own tmdb logo" ON storage.objects;

CREATE POLICY "Users can upload own tmdb logo"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'platform-assets'
  AND (storage.foldername(name))[1] = 'tmdb-logo'
  AND (storage.foldername(name))[2] = (auth.uid())::text
);

CREATE POLICY "Users can update own tmdb logo"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'platform-assets'
  AND (storage.foldername(name))[1] = 'tmdb-logo'
  AND (storage.foldername(name))[2] = (auth.uid())::text
);

CREATE POLICY "Users can delete own tmdb logo"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'platform-assets'
  AND (storage.foldername(name))[1] = 'tmdb-logo'
  AND (storage.foldername(name))[2] = (auth.uid())::text
);

-- 5. Remove invoices from realtime publication (not subscribed by app)
ALTER PUBLICATION supabase_realtime DROP TABLE public.invoices;
