-- Private, per-entity title and watch-log sync. Existing local and legacy remote data are untouched.
create table if not exists public.user_title_sync_entities (
  user_id uuid not null references auth.users(id) on delete cascade,
  entity_kind text not null check (entity_kind in ('title', 'watch_log', 'bookshelf')),
  entity_key text not null check (length(entity_key) between 1 and 160),
  payload jsonb not null default '{}'::jsonb,
  version bigint not null default 1 check (version > 0),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  last_request_id uuid not null,
  primary key (user_id, entity_kind, entity_key),
  constraint user_title_sync_entity_key_shape check (
    (entity_kind = 'title' and entity_key ~ '^(anime:[0-9a-f-]{36}|anilist:[1-9][0-9]*)$')
    or (entity_kind = 'watch_log' and entity_key ~ '^log:.{1,156}$')
    or (entity_kind = 'bookshelf' and entity_key = 'default')
  ),
  constraint user_title_sync_payload_limit check (octet_length(payload::text) <= 65536)
);

create index if not exists user_title_sync_entities_updated_idx
  on public.user_title_sync_entities (user_id, updated_at);

alter table public.user_title_sync_entities enable row level security;
revoke all on public.user_title_sync_entities from anon, authenticated;
grant select on public.user_title_sync_entities to authenticated;

create policy user_title_sync_select_own
  on public.user_title_sync_entities for select to authenticated
  using (user_id = (select auth.uid()));

create or replace function public.apply_title_sync_entity(
  p_kind text,
  p_key text,
  p_payload jsonb,
  p_expected_version bigint,
  p_deleted boolean,
  p_request_id uuid
)
returns public.user_title_sync_entities
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_row public.user_title_sync_entities;
begin
  if v_user_id is null then
    raise exception 'TITLE_SYNC_UNAUTHORIZED' using errcode = '42501';
  end if;
  if p_request_id is null or p_kind not in ('title', 'watch_log', 'bookshelf')
     or p_key is null or length(p_key) > 160 or p_payload is null
     or jsonb_typeof(p_payload) <> 'object' or octet_length(p_payload::text) > 65536
     or p_expected_version is null or p_expected_version < 0 then
    raise exception 'TITLE_SYNC_INVALID_INPUT' using errcode = '22023';
  end if;

  select * into v_row from public.user_title_sync_entities
   where user_id = v_user_id and entity_kind = p_kind and entity_key = p_key
   for update;
  if not found then
    if p_expected_version <> 0 then
      raise exception 'TITLE_SYNC_CONFLICT' using errcode = 'P0001';
    end if;
    insert into public.user_title_sync_entities
      (user_id, entity_kind, entity_key, payload, version, updated_at, deleted_at, last_request_id)
    values
      (v_user_id, p_kind, p_key, case when p_deleted then '{}'::jsonb else p_payload end,
       1, clock_timestamp(), case when p_deleted then clock_timestamp() else null end, p_request_id)
    on conflict do nothing
    returning * into v_row;
    if found then return v_row; end if;
    select * into v_row from public.user_title_sync_entities
     where user_id = v_user_id and entity_kind = p_kind and entity_key = p_key;
    if v_row.last_request_id = p_request_id then return v_row; end if;
    raise exception 'TITLE_SYNC_CONFLICT' using errcode = 'P0001';
  end if;
  if v_row.last_request_id = p_request_id then return v_row; end if;
  if v_row.version <> p_expected_version then
    raise exception 'TITLE_SYNC_CONFLICT' using errcode = 'P0001';
  end if;

  update public.user_title_sync_entities
     set payload = case when p_deleted then '{}'::jsonb else p_payload end,
         version = version + 1,
         updated_at = clock_timestamp(),
         deleted_at = case when p_deleted then clock_timestamp() else null end,
         last_request_id = p_request_id
   where user_id = v_user_id and entity_kind = p_kind and entity_key = p_key
   returning * into v_row;
  return v_row;
end;
$$;

revoke all on function public.apply_title_sync_entity(text, text, jsonb, bigint, boolean, uuid) from public, anon;
grant execute on function public.apply_title_sync_entity(text, text, jsonb, bigint, boolean, uuid) to authenticated;
