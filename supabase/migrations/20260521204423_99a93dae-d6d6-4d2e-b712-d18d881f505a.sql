INSERT INTO storage.buckets (id, name, public)
VALUES ('thumbnails', 'thumbnails', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read thumbnails"
ON storage.objects FOR SELECT
USING (bucket_id = 'thumbnails');