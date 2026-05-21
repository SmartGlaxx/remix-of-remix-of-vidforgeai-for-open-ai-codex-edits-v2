insert into storage.buckets (id, name, public)
values ('videos', 'videos', true)
on conflict (id) do nothing;

create policy "Public can read videos"
on storage.objects for select
using (bucket_id = 'videos');
