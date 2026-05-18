insert into storage.buckets (id, name, public) values ('tts-audio', 'tts-audio', true) on conflict (id) do nothing;

create policy "Public read tts-audio" on storage.objects for select using (bucket_id = 'tts-audio');
create policy "Service write tts-audio" on storage.objects for insert with check (bucket_id = 'tts-audio');