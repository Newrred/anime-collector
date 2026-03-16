alter table if exists public.user_snapshots
  alter column schema_version set default 5;

create table if not exists public.user_library_items (
  user_id uuid not null references auth.users(id) on delete cascade,
  anilist_id bigint not null,
  ko_title text,
  status text not null default '미분류',
  score double precision,
  memo text not null default '',
  rewatch_count integer not null default 0,
  last_rewatch_at date,
  sort_order bigint not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, anilist_id)
);

create table if not exists public.user_watch_logs (
  user_id uuid not null references auth.users(id) on delete cascade,
  log_id text not null,
  anilist_id bigint not null,
  event_type text not null default '시작',
  watched_at_value text,
  watched_at_precision text not null default 'unknown',
  cue text not null default '',
  note text not null default '',
  score_at_that_time double precision,
  context_tags jsonb not null default '[]'::jsonb,
  character_refs jsonb not null default '[]'::jsonb,
  created_at bigint not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, log_id)
);

create table if not exists public.user_character_pins (
  user_id uuid not null references auth.users(id) on delete cascade,
  pin_id text not null,
  character_id bigint not null,
  media_id bigint not null,
  name_snapshot text not null,
  image_snapshot text,
  note text not null default '',
  pin_reason text not null default '',
  linked_log_id text,
  sort_order bigint not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, pin_id)
);

create table if not exists public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  cards_per_row_base integer,
  card_view text,
  updated_at timestamptz not null default now()
);

alter table public.user_library_items enable row level security;
alter table public.user_watch_logs enable row level security;
alter table public.user_character_pins enable row level security;
alter table public.user_preferences enable row level security;

drop policy if exists "read own library items" on public.user_library_items;
create policy "read own library items"
on public.user_library_items
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "insert own library items" on public.user_library_items;
create policy "insert own library items"
on public.user_library_items
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "update own library items" on public.user_library_items;
create policy "update own library items"
on public.user_library_items
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "delete own library items" on public.user_library_items;
create policy "delete own library items"
on public.user_library_items
for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists "read own watch logs" on public.user_watch_logs;
create policy "read own watch logs"
on public.user_watch_logs
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "insert own watch logs" on public.user_watch_logs;
create policy "insert own watch logs"
on public.user_watch_logs
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "update own watch logs" on public.user_watch_logs;
create policy "update own watch logs"
on public.user_watch_logs
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "delete own watch logs" on public.user_watch_logs;
create policy "delete own watch logs"
on public.user_watch_logs
for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists "read own character pins" on public.user_character_pins;
create policy "read own character pins"
on public.user_character_pins
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "insert own character pins" on public.user_character_pins;
create policy "insert own character pins"
on public.user_character_pins
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "update own character pins" on public.user_character_pins;
create policy "update own character pins"
on public.user_character_pins
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "delete own character pins" on public.user_character_pins;
create policy "delete own character pins"
on public.user_character_pins
for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists "read own preferences" on public.user_preferences;
create policy "read own preferences"
on public.user_preferences
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "insert own preferences" on public.user_preferences;
create policy "insert own preferences"
on public.user_preferences
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "update own preferences" on public.user_preferences;
create policy "update own preferences"
on public.user_preferences
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "delete own preferences" on public.user_preferences;
create policy "delete own preferences"
on public.user_preferences
for delete
to authenticated
using (auth.uid() = user_id);
