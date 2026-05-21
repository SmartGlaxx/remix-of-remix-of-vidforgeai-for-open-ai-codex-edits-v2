
INSERT INTO storage.buckets (id, name, public)
VALUES ('soundtracks', 'soundtracks', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read soundtracks"
ON storage.objects FOR SELECT
USING (bucket_id = 'soundtracks');
