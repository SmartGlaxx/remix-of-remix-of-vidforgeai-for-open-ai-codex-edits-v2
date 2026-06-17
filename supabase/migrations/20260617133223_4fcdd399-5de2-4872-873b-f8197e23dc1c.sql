
-- Restrict INSERT to service_role only
DROP POLICY IF EXISTS "Service write tts-audio" ON storage.objects;
CREATE POLICY "Service write tts-audio"
ON storage.objects
FOR INSERT
TO service_role
WITH CHECK (bucket_id = 'tts-audio');

DROP POLICY IF EXISTS "Service can upload visuals" ON storage.objects;
CREATE POLICY "Service can upload visuals"
ON storage.objects
FOR INSERT
TO service_role
WITH CHECK (bucket_id = 'visuals');

-- Add service-role INSERT for the other buckets too (so edge functions can still write)
DROP POLICY IF EXISTS "Service write soundtracks" ON storage.objects;
CREATE POLICY "Service write soundtracks"
ON storage.objects
FOR INSERT
TO service_role
WITH CHECK (bucket_id = 'soundtracks');

DROP POLICY IF EXISTS "Service write videos" ON storage.objects;
CREATE POLICY "Service write videos"
ON storage.objects
FOR INSERT
TO service_role
WITH CHECK (bucket_id = 'videos');

DROP POLICY IF EXISTS "Service write thumbnails" ON storage.objects;
CREATE POLICY "Service write thumbnails"
ON storage.objects
FOR INSERT
TO service_role
WITH CHECK (bucket_id = 'thumbnails');

-- Service-role-only UPDATE and DELETE for all managed buckets
DROP POLICY IF EXISTS "Service update managed buckets" ON storage.objects;
CREATE POLICY "Service update managed buckets"
ON storage.objects
FOR UPDATE
TO service_role
USING (bucket_id IN ('tts-audio','visuals','soundtracks','videos','thumbnails'))
WITH CHECK (bucket_id IN ('tts-audio','visuals','soundtracks','videos','thumbnails'));

DROP POLICY IF EXISTS "Service delete managed buckets" ON storage.objects;
CREATE POLICY "Service delete managed buckets"
ON storage.objects
FOR DELETE
TO service_role
USING (bucket_id IN ('tts-audio','visuals','soundtracks','videos','thumbnails'));

-- Drop broad SELECT policies that allow public listing of bucket contents.
-- Public buckets continue to serve files via direct object URLs without these policies.
DROP POLICY IF EXISTS "Public read tts-audio" ON storage.objects;
DROP POLICY IF EXISTS "Public read visuals" ON storage.objects;
DROP POLICY IF EXISTS "Public read soundtracks" ON storage.objects;
DROP POLICY IF EXISTS "Public can read videos" ON storage.objects;
DROP POLICY IF EXISTS "Public read thumbnails" ON storage.objects;
