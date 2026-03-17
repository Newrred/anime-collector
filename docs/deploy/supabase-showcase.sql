create table if not exists public.user_showcase_layouts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  layout jsonb not null default '{"version":1,"widgets":[]}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.user_showcase_public (
  user_id uuid primary key references auth.users(id) on delete cascade,
  snapshot jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.user_showcase_layouts enable row level security;
alter table public.user_showcase_public enable row level security;

drop policy if exists "own showcase layout read" on public.user_showcase_layouts;
create policy "own showcase layout read"
on public.user_showcase_layouts
for select
using (auth.uid() = user_id);

drop policy if exists "own showcase layout write" on public.user_showcase_layouts;
create policy "own showcase layout write"
on public.user_showcase_layouts
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "own showcase public write" on public.user_showcase_public;
create policy "own showcase public write"
on public.user_showcase_public
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "public showcase readable when profile is public" on public.user_showcase_public;
create policy "public showcase readable when profile is public"
on public.user_showcase_public
for select
using (
  exists (
    select 1
    from public.user_profiles p
    where p.user_id = user_showcase_public.user_id
      and p.profile_public = true
  )
);
