-- Allow authenticated users to upload their own TMDB logo
CREATE POLICY "Users can upload own tmdb logo"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'platform-assets'
  AND (storage.foldername(name))[1] = 'tmdb-logo'
  AND auth.role() = 'authenticated'
);

-- Allow authenticated users to update their own TMDB logo
CREATE POLICY "Users can update own tmdb logo"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'platform-assets'
  AND (storage.foldername(name))[1] = 'tmdb-logo'
  AND auth.role() = 'authenticated'
);

-- Allow authenticated users to delete their own TMDB logo
CREATE POLICY "Users can delete own tmdb logo"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'platform-assets'
  AND (storage.foldername(name))[1] = 'tmdb-logo'
  AND auth.role() = 'authenticated'
);