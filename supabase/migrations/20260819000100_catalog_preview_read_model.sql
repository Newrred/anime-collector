create extension if not exists pg_trgm with schema extensions;

create table if not exists public.catalog_releases (
  id text primary key,
  profile text not null,
  schema_version integer not null check (schema_version = 2),
  policy_version text not null,
  release_hash text not null unique check (release_hash ~ '^[a-f0-9]{64}$'),
  target_count integer not null check (target_count >= 0),
  people_page_count integer not null check (people_page_count >= 0),
  status text not null default 'STAGING' check (status in ('STAGING', 'ACTIVE', 'RETIRED')),
  created_at timestamptz not null default now(),
  activated_at timestamptz
);

create table if not exists public.catalog_active_release (
  singleton boolean primary key default true check (singleton),
  release_id text not null references public.catalog_releases(id) on delete restrict,
  updated_at timestamptz not null default now()
);

create table if not exists public.catalog_assets (
  release_id text not null references public.catalog_releases(id) on delete cascade,
  asset_id text not null,
  anime_id text not null,
  kind text not null check (kind = 'SYSTEM_DESIGN'),
  availability text not null check (availability = 'SERVICE_GENERATED'),
  rights_basis text not null check (rights_basis = 'SYSTEM_GENERATED'),
  row_hash text not null check (row_hash ~ '^[a-f0-9]{64}$'),
  primary key (release_id, asset_id),
  unique (release_id, anime_id)
);

create table if not exists public.catalog_anime_search (
  release_id text not null references public.catalog_releases(id) on delete cascade,
  anime_id text not null,
  anilist_id bigint,
  preferred_title text not null,
  preferred_locale text not null,
  search_aliases jsonb not null default '[]'::jsonb,
  search_text text not null,
  format text,
  status text,
  episode_count integer,
  source_material_type text,
  release_year integer,
  season text,
  studios jsonb not null default '[]'::jsonb,
  genres jsonb not null default '[]'::jsonb,
  readiness text not null,
  cover_asset_id text not null,
  row_hash text not null check (row_hash ~ '^[a-f0-9]{64}$'),
  primary key (release_id, anime_id),
  unique (release_id, anilist_id),
  foreign key (release_id, cover_asset_id) references public.catalog_assets(release_id, asset_id)
);

create table if not exists public.catalog_anime_details (
  release_id text not null references public.catalog_releases(id) on delete cascade,
  anime_id text not null,
  payload jsonb not null,
  row_hash text not null check (row_hash ~ '^[a-f0-9]{64}$'),
  primary key (release_id, anime_id),
  foreign key (release_id, anime_id) references public.catalog_anime_search(release_id, anime_id)
);

create table if not exists public.catalog_anime_people (
  release_id text not null references public.catalog_releases(id) on delete cascade,
  anime_id text not null,
  page integer not null check (page >= 1),
  payload jsonb not null,
  row_hash text not null check (row_hash ~ '^[a-f0-9]{64}$'),
  primary key (release_id, anime_id, page),
  foreign key (release_id, anime_id) references public.catalog_anime_search(release_id, anime_id)
);

create index if not exists catalog_anime_search_text_trgm_idx
  on public.catalog_anime_search using gin (search_text extensions.gin_trgm_ops);
create index if not exists catalog_anime_search_release_idx
  on public.catalog_anime_search (release_id, release_year desc, preferred_title);
create index if not exists catalog_anime_people_lookup_idx
  on public.catalog_anime_people (release_id, anime_id, page);

alter table public.catalog_releases enable row level security;
alter table public.catalog_active_release enable row level security;
alter table public.catalog_assets enable row level security;
alter table public.catalog_anime_search enable row level security;
alter table public.catalog_anime_details enable row level security;
alter table public.catalog_anime_people enable row level security;

drop policy if exists "read active catalog release" on public.catalog_releases;
create policy "read active catalog release" on public.catalog_releases for select to anon, authenticated
using (id = (select release_id from public.catalog_active_release where singleton));

drop policy if exists "read active release pointer" on public.catalog_active_release;
create policy "read active release pointer" on public.catalog_active_release for select to anon, authenticated
using (singleton);

drop policy if exists "read active catalog assets" on public.catalog_assets;
create policy "read active catalog assets" on public.catalog_assets for select to anon, authenticated
using (release_id = (select release_id from public.catalog_active_release where singleton));

drop policy if exists "read active catalog search" on public.catalog_anime_search;
create policy "read active catalog search" on public.catalog_anime_search for select to anon, authenticated
using (release_id = (select release_id from public.catalog_active_release where singleton));

drop policy if exists "read active catalog details" on public.catalog_anime_details;
create policy "read active catalog details" on public.catalog_anime_details for select to anon, authenticated
using (release_id = (select release_id from public.catalog_active_release where singleton));

drop policy if exists "read active catalog people" on public.catalog_anime_people;
create policy "read active catalog people" on public.catalog_anime_people for select to anon, authenticated
using (release_id = (select release_id from public.catalog_active_release where singleton));

create or replace function public.search_catalog_anime(search_query text, result_limit integer default 8)
returns table (
  anime_id text,
  anilist_id bigint,
  preferred_title text,
  preferred_locale text,
  search_aliases jsonb,
  format text,
  status text,
  episode_count integer,
  source_material_type text,
  release_year integer,
  season text,
  studios jsonb,
  genres jsonb,
  readiness text,
  cover_asset_id text
)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  with input as (
    select lower(trim(search_query)) as query, greatest(1, least(coalesce(result_limit, 8), 12)) as row_limit
  )
  select
    row.anime_id, row.anilist_id, row.preferred_title, row.preferred_locale,
    row.search_aliases, row.format, row.status, row.episode_count,
    row.source_material_type, row.release_year, row.season, row.studios,
    row.genres, row.readiness, row.cover_asset_id
  from public.catalog_anime_search row, input
  where length(input.query) between 2 and 120
    and (row.search_text ilike '%' || input.query || '%' or row.search_text % input.query)
  order by
    case
      when lower(row.preferred_title) = input.query then 0
      when lower(row.preferred_title) like input.query || '%' then 1
      else 2
    end,
    similarity(row.search_text, input.query) desc,
    row.preferred_title,
    row.anime_id
  limit (select row_limit from input);
$$;

create or replace function public.activate_catalog_release(requested_release_id text, requested_release_hash text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  expected_count integer;
  actual_search integer;
  actual_detail integer;
  actual_asset integer;
  actual_people integer;
  expected_people integer;
begin
  if auth.role() <> 'service_role' then
    raise exception 'CATALOG_RELEASE_ACTIVATION_FORBIDDEN';
  end if;
  select target_count, people_page_count into expected_count, expected_people
  from public.catalog_releases
  where id = requested_release_id and release_hash = requested_release_hash and status = 'STAGING';
  if expected_count is null then raise exception 'CATALOG_RELEASE_INVALID'; end if;
  select count(*) into actual_search from public.catalog_anime_search where release_id = requested_release_id;
  select count(*) into actual_detail from public.catalog_anime_details where release_id = requested_release_id;
  select count(*) into actual_asset from public.catalog_assets where release_id = requested_release_id;
  select count(*) into actual_people from public.catalog_anime_people where release_id = requested_release_id;
  if actual_search <> expected_count or actual_detail <> expected_count or actual_asset <> expected_count then
    raise exception 'CATALOG_RELEASE_INCOMPLETE';
  end if;
  if actual_people <> expected_people then raise exception 'CATALOG_RELEASE_PEOPLE_INCOMPLETE'; end if;
  update public.catalog_releases set status = 'RETIRED' where status = 'ACTIVE' and id <> requested_release_id;
  update public.catalog_releases set status = 'ACTIVE', activated_at = now() where id = requested_release_id;
  insert into public.catalog_active_release(singleton, release_id, updated_at)
  values (true, requested_release_id, now())
  on conflict (singleton) do update set release_id = excluded.release_id, updated_at = excluded.updated_at;
end;
$$;

revoke all on function public.activate_catalog_release(text, text) from public, anon, authenticated;
grant execute on function public.activate_catalog_release(text, text) to service_role;
grant execute on function public.search_catalog_anime(text, integer) to anon, authenticated;
