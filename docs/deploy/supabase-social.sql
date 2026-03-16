create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  handle text not null,
  display_name text not null default '',
  bio text not null default '',
  avatar_url text,
  profile_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_profiles_handle_format
    check (handle ~ '^[a-z0-9][a-z0-9-]{1,22}[a-z0-9]$')
);

create unique index if not exists user_profiles_handle_key
  on public.user_profiles (handle);

create table if not exists public.user_follows (
  follower_user_id uuid not null references auth.users(id) on delete cascade,
  followed_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_user_id, followed_user_id),
  constraint user_follows_not_self check (follower_user_id <> followed_user_id)
);

create index if not exists user_follows_followed_idx
  on public.user_follows (followed_user_id, created_at desc);

create index if not exists user_follows_follower_idx
  on public.user_follows (follower_user_id, created_at desc);

grant select on public.user_profiles to anon;
grant select, insert, update on public.user_profiles to authenticated;
grant select on public.user_follows to anon;
grant select, insert, delete on public.user_follows to authenticated;

revoke select (avatar_url) on public.user_profiles from anon, authenticated;
revoke insert (avatar_url), update (avatar_url) on public.user_profiles from authenticated;

alter table public.user_profiles enable row level security;
alter table public.user_follows enable row level security;

drop policy if exists "read public or own profiles" on public.user_profiles;
create policy "read public or own profiles"
on public.user_profiles
for select
to anon, authenticated
using (profile_public = true or auth.uid() = user_id);

drop policy if exists "insert own profile" on public.user_profiles;
create policy "insert own profile"
on public.user_profiles
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "update own profile" on public.user_profiles;
create policy "update own profile"
on public.user_profiles
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

update public.user_profiles
set avatar_url = null
where avatar_url is not null;

drop policy if exists "read follows" on public.user_follows;
create policy "read follows"
on public.user_follows
for select
to anon, authenticated
using (true);

drop policy if exists "insert own follows" on public.user_follows;
create policy "insert own follows"
on public.user_follows
for insert
to authenticated
with check (auth.uid() = follower_user_id and follower_user_id <> followed_user_id);

drop policy if exists "delete own follows" on public.user_follows;
create policy "delete own follows"
on public.user_follows
for delete
to authenticated
using (auth.uid() = follower_user_id);
