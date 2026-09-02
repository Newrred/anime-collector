create schema if not exists private;

revoke all on schema private from public, anon, authenticated;

alter table public.sync_operations
  add column result_payload jsonb not null;

alter table public.sync_operations
  add constraint sync_operations_result_payload_check
  check (
    jsonb_typeof(result_payload) = 'object'
    and octet_length(result_payload::text) <= 1048576
  );

create or replace function private.require_memory_user()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;
  return v_user_id;
end;
$$;

create or replace function private.memory_entity_owner(
  p_entity_type text,
  p_entity_id uuid
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
begin
  case p_entity_type
    when 'PRIVATE_TITLE' then
      select user_id into v_owner from public.memory_private_titles where id = p_entity_id;
    when 'MEMORY_CARD' then
      select user_id into v_owner from public.memory_cards where id = p_entity_id;
    when 'VISUAL_ASSET' then
      select user_id into v_owner from public.memory_visual_assets where id = p_entity_id;
    when 'MEMORY_BOARD' then
      select user_id into v_owner from public.memory_boards where id = p_entity_id;
    when 'MEMORY_BOARD_CARD' then
      select user_id into v_owner from public.memory_board_cards where id = p_entity_id;
    else
      return null;
  end case;
  return v_owner;
end;
$$;

create or replace function private.memory_entity_json(
  p_user_id uuid,
  p_entity_type text,
  p_entity_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_entity jsonb;
begin
  case p_entity_type
    when 'PRIVATE_TITLE' then
      select to_jsonb(t) into v_entity
      from public.memory_private_titles t
      where t.user_id = p_user_id and t.id = p_entity_id;
    when 'MEMORY_CARD' then
      select to_jsonb(t) into v_entity
      from public.memory_cards t
      where t.user_id = p_user_id and t.id = p_entity_id;
    when 'VISUAL_ASSET' then
      select to_jsonb(t) into v_entity
      from public.memory_visual_assets t
      where t.user_id = p_user_id and t.id = p_entity_id;
    when 'MEMORY_BOARD' then
      select to_jsonb(t) into v_entity
      from public.memory_boards t
      where t.user_id = p_user_id and t.id = p_entity_id;
    when 'MEMORY_BOARD_CARD' then
      select to_jsonb(t) into v_entity
      from public.memory_board_cards t
      where t.user_id = p_user_id and t.id = p_entity_id;
    else
      return null;
  end case;
  return v_entity;
end;
$$;

create or replace function private.memory_operation_result(
  p_status text,
  p_entity_version bigint,
  p_sync_seq bigint,
  p_error_code text,
  p_remote_entity jsonb
) returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object(
    'status', p_status,
    'entityVersion', p_entity_version,
    'syncSeq', p_sync_seq,
    'errorCode', p_error_code,
    'remoteEntity', p_remote_entity
  );
$$;

create or replace function private.record_memory_operation(
  p_user_id uuid,
  p_device_id uuid,
  p_operation_id uuid,
  p_entity_type text,
  p_entity_id uuid,
  p_operation_type text,
  p_base_version bigint,
  p_request_hash text,
  p_result_status text,
  p_applied_version bigint,
  p_applied_sync_seq bigint,
  p_error_code text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  v_result := private.memory_operation_result(
    p_result_status,
    p_applied_version,
    p_applied_sync_seq,
    p_error_code,
    private.memory_entity_json(p_user_id, p_entity_type, p_entity_id)
  );

  insert into public.sync_operations (
    operation_id,
    user_id,
    device_id,
    entity_type,
    entity_id,
    operation_type,
    base_version,
    request_hash,
    result_status,
    applied_version,
    applied_sync_seq,
    error_code,
    result_payload
  ) values (
    p_operation_id,
    p_user_id,
    p_device_id,
    p_entity_type,
    p_entity_id,
    p_operation_type,
    p_base_version,
    p_request_hash,
    p_result_status,
    p_applied_version,
    p_applied_sync_seq,
    p_error_code,
    v_result
  );

  return v_result;
end;
$$;

create or replace function private.replay_memory_operation(
  p_operation_id uuid,
  p_user_id uuid,
  p_request_hash text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_operation public.sync_operations%rowtype;
begin
  select * into v_operation
  from public.sync_operations
  where operation_id = p_operation_id;

  if not found then
    return null;
  end if;

  if v_operation.user_id <> p_user_id then
    return private.memory_operation_result(
      'REJECTED', null, null, 'OPERATION_ID_CONFLICT', null
    );
  end if;

  if v_operation.request_hash <> p_request_hash then
    return private.memory_operation_result(
      'REJECTED',
      v_operation.applied_version,
      v_operation.applied_sync_seq,
      'OPERATION_HASH_MISMATCH',
      v_operation.result_payload -> 'remoteEntity'
    );
  end if;

  return v_operation.result_payload;
end;
$$;

create or replace function private.assert_complete_card(
  p_user_id uuid,
  p_card_id uuid
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
  v_deleted_at timestamptz;
  v_asset_count integer;
begin
  select status, deleted_at
  into v_status, v_deleted_at
  from public.memory_cards
  where user_id = p_user_id and id = p_card_id;

  if not found or v_deleted_at is not null or v_status <> 'COMPLETE_PRIVATE' then
    return;
  end if;

  select count(*)::integer
  into v_asset_count
  from public.memory_visual_assets
  where user_id = p_user_id
    and card_id = p_card_id
    and deleted_at is null
    and state = 'READY'
    and is_current;

  if v_asset_count <> 1 then
    raise exception 'COMPLETE_CARD_ASSET_REQUIRED';
  end if;
end;
$$;

create or replace function private.validate_complete_card_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_table_name = 'memory_cards' then
    perform private.assert_complete_card(
      coalesce(new.user_id, old.user_id),
      coalesce(new.id, old.id)
    );
  else
    if tg_op <> 'INSERT' then
      perform private.assert_complete_card(old.user_id, old.card_id);
    end if;
    if tg_op <> 'DELETE'
       and (tg_op = 'INSERT' or new.card_id is distinct from old.card_id) then
      perform private.assert_complete_card(new.user_id, new.card_id);
    elsif tg_op = 'UPDATE' then
      perform private.assert_complete_card(new.user_id, new.card_id);
    end if;
  end if;
  return null;
end;
$$;

create constraint trigger memory_cards_complete_asset_guard
after insert or update or delete on public.memory_cards
deferrable initially deferred
for each row execute function private.validate_complete_card_trigger();

create constraint trigger memory_visual_assets_complete_card_guard
after insert or update or delete on public.memory_visual_assets
deferrable initially deferred
for each row execute function private.validate_complete_card_trigger();

create or replace function private.apply_memory_mutation(
  p_user_id uuid,
  p_operation_id uuid,
  p_device_id uuid,
  p_entity_type text,
  p_entity_id uuid,
  p_operation_type text,
  p_base_version bigint,
  p_request_hash text,
  p_payload jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_replay jsonb;
  v_owner uuid;
  v_entity jsonb;
  v_current_version bigint;
  v_next_version bigint;
  v_deleted_at timestamptz;
  v_sync_seq bigint;
  v_change_type text;
  v_client_updated_at timestamptz;
  v_private_title_id uuid;
  v_card_id uuid;
  v_board_id uuid;
  v_referenced_owner uuid;
begin
  if not exists (
    select 1 from public.user_devices
    where user_id = p_user_id and id = p_device_id
  ) then
    raise exception 'DEVICE_NOT_REGISTERED';
  end if;

  if p_operation_type not in ('UPSERT', 'DELETE', 'RESOLVE_CONFLICT') then
    return private.memory_operation_result(
      'REJECTED', null, null, 'OPERATION_TYPE_INVALID', null
    );
  end if;
  if p_base_version < 0 then
    return private.memory_operation_result(
      'REJECTED', null, null, 'BASE_VERSION_INVALID', null
    );
  end if;
  if p_request_hash !~ '^[0-9a-f]{64}$' then
    return private.memory_operation_result(
      'REJECTED', null, null, 'REQUEST_HASH_INVALID', null
    );
  end if;
  if p_payload is null
     or jsonb_typeof(p_payload) <> 'object'
     or octet_length(p_payload::text) > 1048576 then
    return private.memory_operation_result(
      'REJECTED', null, null, 'PAYLOAD_INVALID', null
    );
  end if;

  v_replay := private.replay_memory_operation(
    p_operation_id,
    p_user_id,
    p_request_hash
  );
  if v_replay is not null then
    return v_replay;
  end if;

  v_owner := private.memory_entity_owner(p_entity_type, p_entity_id);
  if v_owner is not null and v_owner <> p_user_id then
    return private.record_memory_operation(
      p_user_id, p_device_id, p_operation_id, p_entity_type, p_entity_id,
      p_operation_type, p_base_version, p_request_hash,
      'REJECTED', null, null, 'FOREIGN_OWNER_REFERENCE'
    );
  end if;

  v_entity := private.memory_entity_json(p_user_id, p_entity_type, p_entity_id);
  if v_entity is null then
    v_current_version := 0;
    v_deleted_at := null;
  else
    v_current_version := (v_entity ->> 'version')::bigint;
    v_deleted_at := (v_entity ->> 'deleted_at')::timestamptz;
  end if;

  if p_operation_type in ('UPSERT', 'RESOLVE_CONFLICT')
     and v_deleted_at is not null then
    return private.record_memory_operation(
      p_user_id, p_device_id, p_operation_id, p_entity_type, p_entity_id,
      p_operation_type, p_base_version, p_request_hash,
      'REJECTED', v_current_version, null, 'TOMBSTONE_WINS'
    );
  end if;

  if v_current_version <> p_base_version then
    return private.record_memory_operation(
      p_user_id, p_device_id, p_operation_id, p_entity_type, p_entity_id,
      p_operation_type, p_base_version, p_request_hash,
      'CONFLICT', v_current_version, null, 'BASE_VERSION_MISMATCH'
    );
  end if;

  if p_operation_type = 'DELETE' and v_entity is null then
    return private.record_memory_operation(
      p_user_id, p_device_id, p_operation_id, p_entity_type, p_entity_id,
      p_operation_type, p_base_version, p_request_hash,
      'REJECTED', null, null, 'ENTITY_NOT_FOUND'
    );
  end if;

  v_next_version := v_current_version + 1;
  v_client_updated_at := coalesce(
    nullif(p_payload ->> 'clientUpdatedAt', '')::timestamptz,
    now()
  );
  v_change_type := case when p_operation_type = 'DELETE' then 'DELETE' else 'UPSERT' end;

  case p_entity_type
    when 'PRIVATE_TITLE' then
      if p_operation_type = 'DELETE' then
        update public.memory_private_titles
        set version = v_next_version,
            client_updated_at = v_client_updated_at,
            server_updated_at = now(),
            deleted_at = now()
        where user_id = p_user_id and id = p_entity_id;
      elsif v_entity is null then
        insert into public.memory_private_titles (
          id, user_id, display_title, normalized_title, optional_genres,
          version, client_updated_at
        ) values (
          p_entity_id,
          p_user_id,
          p_payload ->> 'displayTitle',
          p_payload ->> 'normalizedTitle',
          coalesce(
            array(select jsonb_array_elements_text(coalesce(p_payload -> 'optionalGenres', '[]'::jsonb))),
            '{}'::text[]
          ),
          v_next_version,
          v_client_updated_at
        );
      else
        update public.memory_private_titles
        set display_title = p_payload ->> 'displayTitle',
            normalized_title = p_payload ->> 'normalizedTitle',
            optional_genres = coalesce(
              array(select jsonb_array_elements_text(coalesce(p_payload -> 'optionalGenres', '[]'::jsonb))),
              '{}'::text[]
            ),
            version = v_next_version,
            client_updated_at = v_client_updated_at,
            server_updated_at = now()
        where user_id = p_user_id and id = p_entity_id;
      end if;

    when 'MEMORY_CARD' then
      if p_operation_type = 'DELETE' then
        update public.memory_cards
        set status = 'DELETED',
            version = v_next_version,
            client_updated_at = v_client_updated_at,
            server_updated_at = now(),
            deleted_at = now()
        where user_id = p_user_id and id = p_entity_id;
      else
        v_private_title_id := nullif(p_payload ->> 'privateTitleId', '')::uuid;
        if v_private_title_id is not null then
          select user_id into v_referenced_owner
          from public.memory_private_titles
          where id = v_private_title_id and deleted_at is null;
          if v_referenced_owner is null or v_referenced_owner <> p_user_id then
            return private.record_memory_operation(
              p_user_id, p_device_id, p_operation_id, p_entity_type, p_entity_id,
              p_operation_type, p_base_version, p_request_hash,
              'REJECTED', nullif(v_current_version, 0), null,
              'FOREIGN_OWNER_REFERENCE'
            );
          end if;
        end if;

        if v_entity is null then
          insert into public.memory_cards (
            id, user_id, catalog_anime_id, private_title_id, title_snapshot,
            status, note, watched_at, watched_at_precision, episode, scene_cue,
            emotion_tags, rewatch_intent, visibility, version, client_updated_at
          ) values (
            p_entity_id,
            p_user_id,
            nullif(p_payload ->> 'catalogAnimeId', ''),
            v_private_title_id,
            p_payload ->> 'titleSnapshot',
            coalesce(p_payload ->> 'status', 'DRAFT'),
            p_payload ->> 'note',
            nullif(p_payload ->> 'watchedAt', '')::date,
            coalesce(p_payload ->> 'watchedAtPrecision', 'UNKNOWN'),
            nullif(p_payload ->> 'episode', '')::integer,
            p_payload ->> 'sceneCue',
            coalesce(
              array(select jsonb_array_elements_text(coalesce(p_payload -> 'emotionTags', '[]'::jsonb))),
              '{}'::text[]
            ),
            p_payload ->> 'rewatchIntent',
            coalesce(p_payload ->> 'visibility', 'PRIVATE'),
            v_next_version,
            v_client_updated_at
          );
        else
          update public.memory_cards
          set catalog_anime_id = nullif(p_payload ->> 'catalogAnimeId', ''),
              private_title_id = v_private_title_id,
              title_snapshot = p_payload ->> 'titleSnapshot',
              status = coalesce(p_payload ->> 'status', 'DRAFT'),
              note = p_payload ->> 'note',
              watched_at = nullif(p_payload ->> 'watchedAt', '')::date,
              watched_at_precision = coalesce(p_payload ->> 'watchedAtPrecision', 'UNKNOWN'),
              episode = nullif(p_payload ->> 'episode', '')::integer,
              scene_cue = p_payload ->> 'sceneCue',
              emotion_tags = coalesce(
                array(select jsonb_array_elements_text(coalesce(p_payload -> 'emotionTags', '[]'::jsonb))),
                '{}'::text[]
              ),
              rewatch_intent = p_payload ->> 'rewatchIntent',
              visibility = coalesce(p_payload ->> 'visibility', 'PRIVATE'),
              version = v_next_version,
              client_updated_at = v_client_updated_at,
              server_updated_at = now()
          where user_id = p_user_id and id = p_entity_id;
        end if;
      end if;

    when 'VISUAL_ASSET' then
      if p_operation_type = 'DELETE' then
        select card_id into v_card_id
        from public.memory_visual_assets
        where user_id = p_user_id and id = p_entity_id;

        update public.memory_visual_assets
        set state = 'DELETED',
            is_current = false,
            version = v_next_version,
            client_updated_at = v_client_updated_at,
            server_updated_at = now(),
            deleted_at = now()
        where user_id = p_user_id and id = p_entity_id;
      else
        v_card_id := (p_payload ->> 'cardId')::uuid;
        select user_id into v_referenced_owner
        from public.memory_cards
        where id = v_card_id and deleted_at is null;
        if v_referenced_owner is null or v_referenced_owner <> p_user_id then
          return private.record_memory_operation(
            p_user_id, p_device_id, p_operation_id, p_entity_type, p_entity_id,
            p_operation_type, p_base_version, p_request_hash,
            'REJECTED', nullif(v_current_version, 0), null,
            'FOREIGN_OWNER_REFERENCE'
          );
        end if;

        if v_entity is null then
          insert into public.memory_visual_assets (
            id, user_id, card_id, asset_type, state, storage_scope, visibility,
            rights_basis, checksum_sha256, mime_type, byte_size, width, height,
            design_spec, is_current, version, client_updated_at
          ) values (
            p_entity_id,
            p_user_id,
            v_card_id,
            p_payload ->> 'assetType',
            p_payload ->> 'state',
            coalesce(p_payload ->> 'storageScope', 'LOCAL_ONLY'),
            coalesce(p_payload ->> 'visibility', 'PRIVATE'),
            coalesce(p_payload ->> 'rightsBasis', 'UNKNOWN'),
            nullif(p_payload ->> 'checksumSha256', ''),
            nullif(p_payload ->> 'mimeType', ''),
            nullif(p_payload ->> 'byteSize', '')::bigint,
            nullif(p_payload ->> 'width', '')::integer,
            nullif(p_payload ->> 'height', '')::integer,
            p_payload -> 'designSpec',
            coalesce((p_payload ->> 'isCurrent')::boolean, false),
            v_next_version,
            v_client_updated_at
          );
        else
          update public.memory_visual_assets
          set card_id = v_card_id,
              asset_type = p_payload ->> 'assetType',
              state = p_payload ->> 'state',
              storage_scope = coalesce(p_payload ->> 'storageScope', 'LOCAL_ONLY'),
              visibility = coalesce(p_payload ->> 'visibility', 'PRIVATE'),
              rights_basis = coalesce(p_payload ->> 'rightsBasis', 'UNKNOWN'),
              checksum_sha256 = nullif(p_payload ->> 'checksumSha256', ''),
              mime_type = nullif(p_payload ->> 'mimeType', ''),
              byte_size = nullif(p_payload ->> 'byteSize', '')::bigint,
              width = nullif(p_payload ->> 'width', '')::integer,
              height = nullif(p_payload ->> 'height', '')::integer,
              design_spec = p_payload -> 'designSpec',
              is_current = coalesce((p_payload ->> 'isCurrent')::boolean, false),
              version = v_next_version,
              client_updated_at = v_client_updated_at,
              server_updated_at = now()
          where user_id = p_user_id and id = p_entity_id;
        end if;
      end if;

    when 'MEMORY_BOARD' then
      if p_operation_type = 'DELETE' then
        update public.memory_boards
        set version = v_next_version,
            client_updated_at = v_client_updated_at,
            server_updated_at = now(),
            deleted_at = now()
        where user_id = p_user_id and id = p_entity_id;
      elsif v_entity is null then
        insert into public.memory_boards (
          id, user_id, title, description, visibility, version, client_updated_at
        ) values (
          p_entity_id,
          p_user_id,
          p_payload ->> 'title',
          coalesce(p_payload ->> 'description', ''),
          coalesce(p_payload ->> 'visibility', 'PRIVATE'),
          v_next_version,
          v_client_updated_at
        );
      else
        update public.memory_boards
        set title = p_payload ->> 'title',
            description = coalesce(p_payload ->> 'description', ''),
            visibility = coalesce(p_payload ->> 'visibility', 'PRIVATE'),
            version = v_next_version,
            client_updated_at = v_client_updated_at,
            server_updated_at = now()
        where user_id = p_user_id and id = p_entity_id;
      end if;

    when 'MEMORY_BOARD_CARD' then
      if p_operation_type = 'DELETE' then
        update public.memory_board_cards
        set version = v_next_version,
            client_updated_at = v_client_updated_at,
            server_updated_at = now(),
            deleted_at = now()
        where user_id = p_user_id and id = p_entity_id;
      else
        v_board_id := (p_payload ->> 'boardId')::uuid;
        v_card_id := (p_payload ->> 'cardId')::uuid;

        select user_id into v_referenced_owner
        from public.memory_boards
        where id = v_board_id and deleted_at is null;
        if v_referenced_owner is null or v_referenced_owner <> p_user_id then
          return private.record_memory_operation(
            p_user_id, p_device_id, p_operation_id, p_entity_type, p_entity_id,
            p_operation_type, p_base_version, p_request_hash,
            'REJECTED', nullif(v_current_version, 0), null,
            'FOREIGN_OWNER_REFERENCE'
          );
        end if;

        select user_id into v_referenced_owner
        from public.memory_cards
        where id = v_card_id and deleted_at is null;
        if v_referenced_owner is null or v_referenced_owner <> p_user_id then
          return private.record_memory_operation(
            p_user_id, p_device_id, p_operation_id, p_entity_type, p_entity_id,
            p_operation_type, p_base_version, p_request_hash,
            'REJECTED', nullif(v_current_version, 0), null,
            'FOREIGN_OWNER_REFERENCE'
          );
        end if;

        if v_entity is null then
          insert into public.memory_board_cards (
            id, user_id, board_id, card_id, position_key, version, client_updated_at
          ) values (
            p_entity_id,
            p_user_id,
            v_board_id,
            v_card_id,
            p_payload ->> 'positionKey',
            v_next_version,
            v_client_updated_at
          );
        else
          update public.memory_board_cards
          set board_id = v_board_id,
              card_id = v_card_id,
              position_key = p_payload ->> 'positionKey',
              version = v_next_version,
              client_updated_at = v_client_updated_at,
              server_updated_at = now(),
              deleted_at = null
          where user_id = p_user_id and id = p_entity_id;
        end if;
      end if;

    else
      return private.memory_operation_result(
        'REJECTED', null, null, 'ENTITY_TYPE_INVALID', null
      );
  end case;

  insert into public.sync_changes (
    user_id,
    entity_type,
    entity_id,
    operation_type,
    entity_version
  ) values (
    p_user_id,
    p_entity_type,
    p_entity_id,
    v_change_type,
    v_next_version
  ) returning sync_seq into v_sync_seq;

  if p_entity_type = 'MEMORY_CARD' then
    perform private.assert_complete_card(p_user_id, p_entity_id);
  elsif p_entity_type = 'VISUAL_ASSET' and v_card_id is not null then
    perform private.assert_complete_card(p_user_id, v_card_id);
  end if;

  return private.record_memory_operation(
    p_user_id, p_device_id, p_operation_id, p_entity_type, p_entity_id,
    p_operation_type, p_base_version, p_request_hash,
    'APPLIED', v_next_version, v_sync_seq, null
  );
end;
$$;

create or replace function public.ensure_user_profile(
  p_display_name text default null,
  p_locale text default 'en',
  p_time_zone text default 'UTC'
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := private.require_memory_user();
  v_display_name text;
begin
  v_display_name := coalesce(
    nullif(btrim(p_display_name), ''),
    'User-' || left(v_user_id::text, 8)
  );

  insert into public.user_profiles (
    user_id, display_name, locale, time_zone
  ) values (
    v_user_id, v_display_name, p_locale, p_time_zone
  ) on conflict (user_id) do nothing;

  insert into public.user_preferences (
    user_id, payload, client_updated_at
  ) values (
    v_user_id, '{}'::jsonb, now()
  ) on conflict (user_id) do nothing;

  return (
    select jsonb_build_object(
      'userId', p.user_id,
      'displayName', p.display_name,
      'locale', p.locale,
      'timeZone', p.time_zone,
      'minimumRetainedSyncSeq', p.minimum_retained_sync_seq
    )
    from public.user_profiles p
    where p.user_id = v_user_id
  );
end;
$$;

create or replace function public.register_user_device(
  p_device_id uuid,
  p_installation_id uuid,
  p_platform text,
  p_app_version text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := private.require_memory_user();
  v_device public.user_devices%rowtype;
  v_owner uuid;
begin
  if p_platform not in ('WEB', 'ANDROID')
     or char_length(btrim(p_app_version)) not between 1 and 100 then
    raise exception 'DEVICE_PAYLOAD_INVALID';
  end if;

  select user_id into v_owner
  from public.user_devices
  where id = p_device_id;
  if v_owner is not null and v_owner <> v_user_id then
    raise exception 'DEVICE_OWNERSHIP_CONFLICT';
  end if;

  select * into v_device
  from public.user_devices
  where user_id = v_user_id and installation_id = p_installation_id;

  if found then
    update public.user_devices
    set platform = p_platform,
        app_version = p_app_version,
        last_seen_at = now()
    where id = v_device.id
    returning * into v_device;
  else
    insert into public.user_devices (
      id, user_id, installation_id, platform, app_version
    ) values (
      p_device_id, v_user_id, p_installation_id, p_platform, p_app_version
    )
    returning * into v_device;
  end if;

  return jsonb_build_object(
    'id', v_device.id,
    'installationId', v_device.installation_id,
    'platform', v_device.platform,
    'appVersion', v_device.app_version,
    'lastSyncSeq', v_device.last_sync_seq
  );
end;
$$;

create or replace function public.apply_memory_card_mutation(
  p_operation_id uuid,
  p_device_id uuid,
  p_entity_type text,
  p_entity_id uuid,
  p_operation_type text,
  p_base_version bigint,
  p_request_hash text,
  p_payload jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := private.require_memory_user();
begin
  if p_entity_type not in ('PRIVATE_TITLE', 'MEMORY_CARD', 'VISUAL_ASSET') then
    return private.memory_operation_result(
      'REJECTED', null, null, 'ENTITY_FAMILY_MISMATCH', null
    );
  end if;
  return private.apply_memory_mutation(
    v_user_id, p_operation_id, p_device_id, p_entity_type, p_entity_id,
    p_operation_type, p_base_version, p_request_hash, p_payload
  );
end;
$$;

create or replace function public.apply_board_mutation(
  p_operation_id uuid,
  p_device_id uuid,
  p_entity_type text,
  p_entity_id uuid,
  p_operation_type text,
  p_base_version bigint,
  p_request_hash text,
  p_payload jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := private.require_memory_user();
begin
  if p_entity_type not in ('MEMORY_BOARD', 'MEMORY_BOARD_CARD') then
    return private.memory_operation_result(
      'REJECTED', null, null, 'ENTITY_FAMILY_MISMATCH', null
    );
  end if;
  return private.apply_memory_mutation(
    v_user_id, p_operation_id, p_device_id, p_entity_type, p_entity_id,
    p_operation_type, p_base_version, p_request_hash, p_payload
  );
end;
$$;

create or replace function public.resolve_memory_conflict(
  p_operation_id uuid,
  p_device_id uuid,
  p_entity_type text,
  p_entity_id uuid,
  p_base_version bigint,
  p_request_hash text,
  p_payload jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := private.require_memory_user();
begin
  if p_entity_type not in (
    'PRIVATE_TITLE', 'MEMORY_CARD', 'VISUAL_ASSET',
    'MEMORY_BOARD', 'MEMORY_BOARD_CARD'
  ) then
    return private.memory_operation_result(
      'REJECTED', null, null, 'ENTITY_TYPE_INVALID', null
    );
  end if;
  return private.apply_memory_mutation(
    v_user_id, p_operation_id, p_device_id, p_entity_type, p_entity_id,
    'RESOLVE_CONFLICT', p_base_version, p_request_hash, p_payload
  );
end;
$$;

create or replace function public.pull_memory_changes(
  p_after_seq bigint default 0,
  p_limit integer default 200
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := private.require_memory_user();
  v_minimum_seq bigint;
begin
  if p_after_seq < 0 or p_limit < 1 or p_limit > 500 then
    raise exception 'SYNC_PULL_INVALID';
  end if;

  select minimum_retained_sync_seq
  into v_minimum_seq
  from public.user_profiles
  where user_id = v_user_id;
  v_minimum_seq := coalesce(v_minimum_seq, 0);

  if p_after_seq < v_minimum_seq then
    return jsonb_build_object(
      'changes', '[]'::jsonb,
      'nextSyncSeq', greatest(
        v_minimum_seq,
        coalesce((
          select max(sync_seq)
          from public.sync_changes
          where user_id = v_user_id
        ), 0)
      ),
      'minimumRetainedSyncSeq', v_minimum_seq,
      'requiresFullResync', true
    );
  end if;

  return (
    with page as (
      select
        sync_seq as "syncSeq",
        entity_type as "entityType",
        entity_id as "entityId",
        operation_type as "operationType",
        entity_version as "entityVersion",
        changed_at as "changedAt"
      from public.sync_changes
      where user_id = v_user_id and sync_seq > p_after_seq
      order by sync_seq
      limit p_limit
    )
    select jsonb_build_object(
      'changes', coalesce(
        jsonb_agg(to_jsonb(page) order by "syncSeq"),
        '[]'::jsonb
      ),
      'nextSyncSeq', coalesce(max("syncSeq"), p_after_seq),
      'minimumRetainedSyncSeq', v_minimum_seq,
      'requiresFullResync', false
    )
    from page
  );
end;
$$;

create or replace function public.promote_guest_memory(
  p_operation_id uuid,
  p_device_id uuid,
  p_guest_owner_id text,
  p_source_hash text,
  p_bundle jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := private.require_memory_user();
  v_existing public.user_account_promotions%rowtype;
  v_item jsonb;
  v_private_title_count integer := 0;
  v_card_count integer := 0;
  v_asset_count integer := 0;
  v_board_count integer := 0;
  v_board_card_count integer := 0;
  v_counts jsonb;
  v_sync_seq bigint;
  v_card_id uuid;
begin
  if not exists (
    select 1 from public.user_devices
    where user_id = v_user_id and id = p_device_id
  ) then
    raise exception 'DEVICE_NOT_REGISTERED';
  end if;

  if p_guest_owner_id !~ '^guest:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     or p_source_hash !~ '^[0-9a-f]{64}$'
     or p_bundle is null
     or jsonb_typeof(p_bundle) <> 'object' then
    raise exception 'PROMOTION_PAYLOAD_INVALID';
  end if;

  if octet_length(p_bundle::text) > 2097152 then
    raise exception 'PROMOTION_BUNDLE_TOO_LARGE';
  end if;

  if jsonb_typeof(coalesce(p_bundle -> 'privateTitles', '[]'::jsonb)) <> 'array'
     or jsonb_typeof(coalesce(p_bundle -> 'cards', '[]'::jsonb)) <> 'array'
     or jsonb_typeof(coalesce(p_bundle -> 'visualAssets', '[]'::jsonb)) <> 'array'
     or jsonb_typeof(coalesce(p_bundle -> 'boards', '[]'::jsonb)) <> 'array'
     or jsonb_typeof(coalesce(p_bundle -> 'boardCards', '[]'::jsonb)) <> 'array'
     or jsonb_array_length(coalesce(p_bundle -> 'privateTitles', '[]'::jsonb)) > 250
     or jsonb_array_length(coalesce(p_bundle -> 'cards', '[]'::jsonb)) > 500
     or jsonb_array_length(coalesce(p_bundle -> 'visualAssets', '[]'::jsonb)) > 500
     or jsonb_array_length(coalesce(p_bundle -> 'boards', '[]'::jsonb)) > 100
     or jsonb_array_length(coalesce(p_bundle -> 'boardCards', '[]'::jsonb)) > 2000 then
    raise exception 'PROMOTION_BUNDLE_LIMIT_EXCEEDED';
  end if;

  select * into v_existing
  from public.user_account_promotions
  where user_id = v_user_id and guest_owner_id = p_guest_owner_id;

  if found then
    if v_existing.source_hash <> p_source_hash then
      raise exception 'PROMOTION_SOURCE_HASH_MISMATCH';
    end if;
    return jsonb_build_object(
      'status', v_existing.status,
      'importedCounts', v_existing.imported_counts,
      'nextSyncSeq', coalesce((
        select max(sync_seq)
        from public.sync_changes
        where user_id = v_user_id
      ), 0)
    );
  end if;

  if exists (
    select 1 from public.user_account_promotions
    where operation_id = p_operation_id
  ) then
    raise exception 'PROMOTION_OPERATION_ID_CONFLICT';
  end if;

  insert into public.user_account_promotions (
    operation_id,
    user_id,
    device_id,
    guest_owner_id,
    source_hash,
    status
  ) values (
    p_operation_id,
    v_user_id,
    p_device_id,
    p_guest_owner_id,
    p_source_hash,
    'STARTED'
  );

  for v_item in
    select value from jsonb_array_elements(
      coalesce(p_bundle -> 'privateTitles', '[]'::jsonb)
    )
  loop
    insert into public.memory_private_titles (
      id, user_id, display_title, normalized_title, optional_genres,
      version, created_at, client_updated_at, server_updated_at, deleted_at
    ) values (
      (v_item ->> 'id')::uuid,
      v_user_id,
      v_item ->> 'displayTitle',
      v_item ->> 'normalizedTitle',
      coalesce(
        array(select jsonb_array_elements_text(coalesce(v_item -> 'optionalGenres', '[]'::jsonb))),
        '{}'::text[]
      ),
      coalesce((v_item ->> 'version')::bigint, 1),
      coalesce(nullif(v_item ->> 'createdAt', '')::timestamptz, now()),
      coalesce(nullif(v_item ->> 'clientUpdatedAt', '')::timestamptz, now()),
      now(),
      nullif(v_item ->> 'deletedAt', '')::timestamptz
    );

    insert into public.sync_changes (
      user_id, entity_type, entity_id, operation_type, entity_version
    ) values (
      v_user_id,
      'PRIVATE_TITLE',
      (v_item ->> 'id')::uuid,
      case when nullif(v_item ->> 'deletedAt', '') is null then 'UPSERT' else 'DELETE' end,
      coalesce((v_item ->> 'version')::bigint, 1)
    );
    v_private_title_count := v_private_title_count + 1;
  end loop;

  for v_item in
    select value from jsonb_array_elements(
      coalesce(p_bundle -> 'cards', '[]'::jsonb)
    )
  loop
    insert into public.memory_cards (
      id, user_id, catalog_anime_id, private_title_id, title_snapshot,
      status, note, watched_at, watched_at_precision, episode, scene_cue,
      emotion_tags, rewatch_intent, visibility, version, created_at,
      client_updated_at, server_updated_at, deleted_at
    ) values (
      (v_item ->> 'id')::uuid,
      v_user_id,
      nullif(v_item ->> 'catalogAnimeId', ''),
      nullif(v_item ->> 'privateTitleId', '')::uuid,
      v_item ->> 'titleSnapshot',
      coalesce(v_item ->> 'status', 'DRAFT'),
      v_item ->> 'note',
      nullif(v_item ->> 'watchedAt', '')::date,
      coalesce(v_item ->> 'watchedAtPrecision', 'UNKNOWN'),
      nullif(v_item ->> 'episode', '')::integer,
      v_item ->> 'sceneCue',
      coalesce(
        array(select jsonb_array_elements_text(coalesce(v_item -> 'emotionTags', '[]'::jsonb))),
        '{}'::text[]
      ),
      v_item ->> 'rewatchIntent',
      coalesce(v_item ->> 'visibility', 'PRIVATE'),
      coalesce((v_item ->> 'version')::bigint, 1),
      coalesce(nullif(v_item ->> 'createdAt', '')::timestamptz, now()),
      coalesce(nullif(v_item ->> 'clientUpdatedAt', '')::timestamptz, now()),
      now(),
      nullif(v_item ->> 'deletedAt', '')::timestamptz
    );

    insert into public.sync_changes (
      user_id, entity_type, entity_id, operation_type, entity_version
    ) values (
      v_user_id,
      'MEMORY_CARD',
      (v_item ->> 'id')::uuid,
      case when nullif(v_item ->> 'deletedAt', '') is null then 'UPSERT' else 'DELETE' end,
      coalesce((v_item ->> 'version')::bigint, 1)
    );
    v_card_count := v_card_count + 1;
  end loop;

  for v_item in
    select value from jsonb_array_elements(
      coalesce(p_bundle -> 'visualAssets', '[]'::jsonb)
    )
  loop
    insert into public.memory_visual_assets (
      id, user_id, card_id, asset_type, state, storage_scope, visibility,
      rights_basis, checksum_sha256, mime_type, byte_size, width, height,
      design_spec, is_current, version, created_at, client_updated_at,
      server_updated_at, deleted_at
    ) values (
      (v_item ->> 'id')::uuid,
      v_user_id,
      (v_item ->> 'cardId')::uuid,
      v_item ->> 'assetType',
      v_item ->> 'state',
      coalesce(v_item ->> 'storageScope', 'LOCAL_ONLY'),
      coalesce(v_item ->> 'visibility', 'PRIVATE'),
      coalesce(v_item ->> 'rightsBasis', 'UNKNOWN'),
      nullif(v_item ->> 'checksumSha256', ''),
      nullif(v_item ->> 'mimeType', ''),
      nullif(v_item ->> 'byteSize', '')::bigint,
      nullif(v_item ->> 'width', '')::integer,
      nullif(v_item ->> 'height', '')::integer,
      v_item -> 'designSpec',
      coalesce((v_item ->> 'isCurrent')::boolean, false),
      coalesce((v_item ->> 'version')::bigint, 1),
      coalesce(nullif(v_item ->> 'createdAt', '')::timestamptz, now()),
      coalesce(nullif(v_item ->> 'clientUpdatedAt', '')::timestamptz, now()),
      now(),
      nullif(v_item ->> 'deletedAt', '')::timestamptz
    );

    insert into public.sync_changes (
      user_id, entity_type, entity_id, operation_type, entity_version
    ) values (
      v_user_id,
      'VISUAL_ASSET',
      (v_item ->> 'id')::uuid,
      case when nullif(v_item ->> 'deletedAt', '') is null then 'UPSERT' else 'DELETE' end,
      coalesce((v_item ->> 'version')::bigint, 1)
    );
    v_asset_count := v_asset_count + 1;
  end loop;

  for v_item in
    select value from jsonb_array_elements(
      coalesce(p_bundle -> 'boards', '[]'::jsonb)
    )
  loop
    insert into public.memory_boards (
      id, user_id, title, description, visibility, version, created_at,
      client_updated_at, server_updated_at, deleted_at
    ) values (
      (v_item ->> 'id')::uuid,
      v_user_id,
      v_item ->> 'title',
      coalesce(v_item ->> 'description', ''),
      coalesce(v_item ->> 'visibility', 'PRIVATE'),
      coalesce((v_item ->> 'version')::bigint, 1),
      coalesce(nullif(v_item ->> 'createdAt', '')::timestamptz, now()),
      coalesce(nullif(v_item ->> 'clientUpdatedAt', '')::timestamptz, now()),
      now(),
      nullif(v_item ->> 'deletedAt', '')::timestamptz
    );

    insert into public.sync_changes (
      user_id, entity_type, entity_id, operation_type, entity_version
    ) values (
      v_user_id,
      'MEMORY_BOARD',
      (v_item ->> 'id')::uuid,
      case when nullif(v_item ->> 'deletedAt', '') is null then 'UPSERT' else 'DELETE' end,
      coalesce((v_item ->> 'version')::bigint, 1)
    );
    v_board_count := v_board_count + 1;
  end loop;

  for v_item in
    select value from jsonb_array_elements(
      coalesce(p_bundle -> 'boardCards', '[]'::jsonb)
    )
  loop
    insert into public.memory_board_cards (
      id, user_id, board_id, card_id, position_key, version, created_at,
      client_updated_at, server_updated_at, deleted_at
    ) values (
      (v_item ->> 'id')::uuid,
      v_user_id,
      (v_item ->> 'boardId')::uuid,
      (v_item ->> 'cardId')::uuid,
      v_item ->> 'positionKey',
      coalesce((v_item ->> 'version')::bigint, 1),
      coalesce(nullif(v_item ->> 'createdAt', '')::timestamptz, now()),
      coalesce(nullif(v_item ->> 'clientUpdatedAt', '')::timestamptz, now()),
      now(),
      nullif(v_item ->> 'deletedAt', '')::timestamptz
    );

    insert into public.sync_changes (
      user_id, entity_type, entity_id, operation_type, entity_version
    ) values (
      v_user_id,
      'MEMORY_BOARD_CARD',
      (v_item ->> 'id')::uuid,
      case when nullif(v_item ->> 'deletedAt', '') is null then 'UPSERT' else 'DELETE' end,
      coalesce((v_item ->> 'version')::bigint, 1)
    );
    v_board_card_count := v_board_card_count + 1;
  end loop;

  for v_card_id in
    select id
    from public.memory_cards
    where user_id = v_user_id
      and status = 'COMPLETE_PRIVATE'
      and deleted_at is null
  loop
    perform private.assert_complete_card(v_user_id, v_card_id);
  end loop;

  v_counts := jsonb_build_object(
    'privateTitles', v_private_title_count,
    'cards', v_card_count,
    'visualAssets', v_asset_count,
    'boards', v_board_count,
    'boardCards', v_board_card_count
  );

  update public.user_account_promotions
  set status = 'COMPLETED',
      imported_counts = v_counts,
      completed_at = now()
  where operation_id = p_operation_id;

  select coalesce(max(sync_seq), 0)
  into v_sync_seq
  from public.sync_changes
  where user_id = v_user_id;

  return jsonb_build_object(
    'status', 'COMPLETED',
    'importedCounts', v_counts,
    'nextSyncSeq', v_sync_seq
  );
end;
$$;
