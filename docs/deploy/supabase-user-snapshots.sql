create table if not exists public.user_snapshots (
  user_id uuid primary key references auth.users(id) on delete cascade,
  snapshot jsonb not null,
  schema_version integer not null default 5,
  content_hash text not null,
  updated_at timestamptz not null default now(),
  device_id text,
  app_version text
);

alter table public.user_snapshots enable row level security;

drop policy if exists "read own snapshot" on public.user_snapshots;
create policy "read own snapshot"
on public.user_snapshots
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "insert own snapshot" on public.user_snapshots;
create policy "insert own snapshot"
on public.user_snapshots
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "update own snapshot" on public.user_snapshots;
create policy "update own snapshot"
on public.user_snapshots
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "delete own snapshot" on public.user_snapshots;
create policy "delete own snapshot"
on public.user_snapshots
for delete
to authenticated
using (auth.uid() = user_id);
