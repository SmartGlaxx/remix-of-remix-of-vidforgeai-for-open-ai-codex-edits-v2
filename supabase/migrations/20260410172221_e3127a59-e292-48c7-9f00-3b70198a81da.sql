-- Create generations table
CREATE TABLE public.generations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  text TEXT NOT NULL,
  voice TEXT NOT NULL,
  model TEXT DEFAULT 'kokoro',
  language TEXT,
  speed NUMERIC,
  response_format TEXT,
  audio_url TEXT,
  characters INTEGER DEFAULT 0,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.generations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own generations" ON public.generations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own generations" ON public.generations FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create usage_logs table
CREATE TABLE public.usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  characters INTEGER NOT NULL,
  model TEXT DEFAULT 'kokoro',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.usage_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own usage" ON public.usage_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own usage" ON public.usage_logs FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create audio-outputs storage bucket (public)
INSERT INTO storage.buckets (id, name, public) VALUES ('audio-outputs', 'audio-outputs', true);

CREATE POLICY "Anyone can view audio outputs" ON storage.objects FOR SELECT USING (bucket_id = 'audio-outputs');
CREATE POLICY "Authenticated users can upload audio" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'audio-outputs' AND auth.role() = 'authenticated');