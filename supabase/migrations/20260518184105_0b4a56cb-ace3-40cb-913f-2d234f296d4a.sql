insert into storage.buckets (id, name, public) values ('visuals', 'visuals', true) on conflict (id) do nothing;

create policy "Public read visuals"
on storage.objects for select
using (bucket_id = 'visuals');

create policy "Service can upload visuals"
on storage.objects for insert
with check (bucket_id = 'visuals');