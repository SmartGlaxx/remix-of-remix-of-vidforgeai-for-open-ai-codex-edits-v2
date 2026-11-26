create table public.explainer_exports (
 id uuid primary key, owner_id uuid not null default auth.uid() references auth.users on delete cascade,
 format text not null check(format in ('illustrated','whiteboard','comic')),
 topic text not null check(length(trim(topic)) between 1 and 300),
 seconds integer not null check(seconds in (30,60,180,300,600,900,1800)),
 host text not null check(host in ('studio','finance','none')),
 state text not null default 'queued', progress text not null default 'Queued',
 scenes jsonb not null default '[]', output_path text, error text, operation text,
 lease uuid, lease_until timestamptz, created_at timestamptz not null default now()
);
alter table public.explainer_exports enable row level security;
revoke all on public.explainer_exports from anon, authenticated;
grant select, insert(id,format,topic,seconds,host) on public.explainer_exports to authenticated;
create policy own_reads on public.explainer_exports for select to authenticated using(owner_id=auth.uid());
create policy own_creates on public.explainer_exports for insert to authenticated with check(owner_id=auth.uid());
grant all on public.explainer_exports to service_role;
create function public.claim_explainer_export(token uuid) returns setof public.explainer_exports
language sql security invoker set search_path=public as $$
 update explainer_exports set lease=token, lease_until=now()+interval '5 minutes',state='running'
 where id=(select id from explainer_exports where state in ('queued','running') and (lease_until is null or lease_until<now())
 order by created_at for update skip locked limit 1) returning *
$$;
revoke all on function public.claim_explainer_export(uuid) from public,anon,authenticated;
grant execute on function public.claim_explainer_export(uuid) to service_role;
