CREATE TABLE public.character_animation_jobs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL, request_id uuid NOT NULL UNIQUE, image_path text NOT NULL, prompt text NOT NULL CHECK (length(btrim(prompt)) > 0 AND length(prompt) <= 4000), settings jsonb NOT NULL DEFAULT '{"duration":10,"resolution":"720p","fps":24,"draft":true,"prompt_upsampling":false}', prediction_id text UNIQUE, state text NOT NULL DEFAULT 'submitting' CHECK (state IN ('submitting','checking','queued','generating','saving','save_failed','ready','failed')), signed_input_url text, output_url text, video_path text, error text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz, CHECK (state <> 'ready' OR video_path IS NOT NULL)
);
GRANT SELECT ON public.character_animation_jobs TO authenticated;
GRANT ALL ON public.character_animation_jobs TO service_role;
ALTER TABLE public.character_animation_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners read animation jobs" ON public.character_animation_jobs FOR SELECT TO authenticated USING (owner_id = (select auth.uid()));
CREATE INDEX character_animation_owner_created ON public.character_animation_jobs(owner_id, created_at DESC);
CREATE POLICY "Owners upload private character illustrations" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id='character-inputs' AND (storage.foldername(name))[1]=(select auth.uid())::text);
CREATE POLICY "Owners read private character illustrations" ON storage.objects FOR SELECT TO authenticated USING (bucket_id='character-inputs' AND (storage.foldername(name))[1]=(select auth.uid())::text);