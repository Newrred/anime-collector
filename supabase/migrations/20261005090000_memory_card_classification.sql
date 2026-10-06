-- Candidate only. Deploy this before enabling PUBLIC_MEMORY_CARD_CLASSIFICATION_SYNC_V1.
-- Additive private metadata; public snapshot fields remain unchanged.
create function private.valid_memory_classification(p_value jsonb)
returns boolean language plpgsql immutable set search_path = '' as $$
declare r jsonb; t jsonb;
begin
  if p_value is null or jsonb_typeof(p_value) <> 'object' then return false; end if;
  if p_value -> 'version' <> '1'::jsonb or not (p_value ?& array['version','tags','characters'])
    or (select count(*) from jsonb_object_keys(p_value)) <> 3 then return false; end if;
  if jsonb_typeof(p_value -> 'tags') <> 'array' or jsonb_typeof(p_value -> 'characters') <> 'array' then return false; end if;
  if jsonb_array_length(p_value -> 'tags') > 20 or jsonb_array_length(p_value -> 'characters') > 12 then return false; end if;
  for t in select value from jsonb_array_elements(p_value -> 'tags') loop
    if jsonb_typeof(t) <> 'string' or char_length(btrim(t #>> '{}')) not between 1 and 48 then return false; end if;
  end loop;
  for r in select value from jsonb_array_elements(p_value -> 'characters') loop
    if jsonb_typeof(r) <> 'object' then return false; end if;
    if not (r ?& array['source','id','name']) or (select count(*) from jsonb_object_keys(r)) <> 3
      or jsonb_typeof(r -> 'source') <> 'string' or r ->> 'source' not in ('ANILIST','CATALOG')
      or jsonb_typeof(r -> 'id') <> 'string' or char_length(btrim(r ->> 'id')) not between 1 and 160
      or jsonb_typeof(r -> 'name') <> 'string' or char_length(btrim(r ->> 'name')) not between 1 and 120 then return false; end if;
    if r ->> 'source' = 'ANILIST' and r ->> 'id' !~ '^[1-9][0-9]{0,11}$' then return false; end if;
  end loop;
  return true;
end; $$;

alter table public.memory_cards add column classification jsonb not null
  default '{"version":1,"tags":[],"characters":[]}'::jsonb
  constraint memory_cards_classification_check check (private.valid_memory_classification(classification));

create function private.hydrate_memory_classification()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v jsonb;
begin
  v := coalesce(nullif(current_setting('moemoa.card_classification', true), ''), '{}')::jsonb -> new.id::text;
  if new.deleted_at is not null then
    new.classification := '{"version":1,"tags":[],"characters":[]}'::jsonb;
  elsif v is not null then
    if not private.valid_memory_classification(v) then raise exception 'CARD_CLASSIFICATION_INVALID'; end if;
    new.classification := v;
  end if;
  return new;
end; $$;
create trigger memory_cards_classification_hydration before insert or update on public.memory_cards
  for each row execute function private.hydrate_memory_classification();

alter function public.apply_memory_card_mutation(uuid,uuid,text,uuid,text,bigint,text,jsonb) rename to apply_memory_card_mutation_before_classification;
alter function public.resolve_memory_conflict(uuid,uuid,text,uuid,bigint,text,jsonb) rename to resolve_memory_conflict_before_classification;
alter function public.promote_guest_memory(uuid,uuid,text,text,jsonb) rename to promote_guest_memory_before_classification;
revoke all on function public.apply_memory_card_mutation_before_classification(uuid,uuid,text,uuid,text,bigint,text,jsonb) from public,anon,authenticated;
revoke all on function public.resolve_memory_conflict_before_classification(uuid,uuid,text,uuid,bigint,text,jsonb) from public,anon,authenticated;
revoke all on function public.promote_guest_memory_before_classification(uuid,uuid,text,text,jsonb) from public,anon,authenticated;

create function public.apply_memory_card_mutation(p_operation_id uuid,p_device_id uuid,p_entity_type text,p_entity_id uuid,p_operation_type text,p_base_version bigint,p_request_hash text,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
  perform set_config('moemoa.card_classification', case when p_entity_type='MEMORY_CARD' and p_payload ? 'classification'
    then jsonb_build_object(p_entity_id::text,p_payload -> 'classification')::text else '{}' end, true);
  result := public.apply_memory_card_mutation_before_classification(p_operation_id,p_device_id,p_entity_type,p_entity_id,p_operation_type,p_base_version,p_request_hash,p_payload);
  perform set_config('moemoa.card_classification','{}',true);
  return result;
end; $$;

create function public.resolve_memory_conflict(p_operation_id uuid,p_device_id uuid,p_entity_type text,p_entity_id uuid,p_base_version bigint,p_request_hash text,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
  perform set_config('moemoa.card_classification', case when p_entity_type='MEMORY_CARD' and p_payload ? 'classification'
    then jsonb_build_object(p_entity_id::text,p_payload -> 'classification')::text else '{}' end, true);
  result := public.resolve_memory_conflict_before_classification(p_operation_id,p_device_id,p_entity_type,p_entity_id,p_base_version,p_request_hash,p_payload);
  perform set_config('moemoa.card_classification','{}',true);
  return result;
end; $$;

create function public.promote_guest_memory(p_operation_id uuid,p_device_id uuid,p_guest_owner_id text,p_source_hash text,p_bundle jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare result jsonb; refs jsonb;
begin
  select coalesce(jsonb_object_agg(row ->> 'id', row -> 'classification'),'{}'::jsonb) into refs
    from jsonb_array_elements(coalesce(p_bundle -> 'cards','[]'::jsonb)) as rows(row) where row ? 'classification';
  perform set_config('moemoa.card_classification',refs::text,true);
  result := public.promote_guest_memory_before_classification(p_operation_id,p_device_id,p_guest_owner_id,p_source_hash,p_bundle);
  perform set_config('moemoa.card_classification','{}',true);
  return result;
end; $$;

revoke all on function public.apply_memory_card_mutation(uuid,uuid,text,uuid,text,bigint,text,jsonb) from public,anon;
revoke all on function public.resolve_memory_conflict(uuid,uuid,text,uuid,bigint,text,jsonb) from public,anon;
revoke all on function public.promote_guest_memory(uuid,uuid,text,text,jsonb) from public,anon;
grant execute on function public.apply_memory_card_mutation(uuid,uuid,text,uuid,text,bigint,text,jsonb) to authenticated;
grant execute on function public.resolve_memory_conflict(uuid,uuid,text,uuid,bigint,text,jsonb) to authenticated;
grant execute on function public.promote_guest_memory(uuid,uuid,text,text,jsonb) to authenticated;
