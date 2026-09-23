-- Add catalog-managed official covers as immutable Memory visual references.
-- Existing USER_IMAGE and SYSTEM_DESIGN rows and RPC behavior remain unchanged.

create table public.catalog_cover_revisions (
  catalog_cover_revision_id text primary key,
  catalog_cover_id text not null,
  catalog_anime_id text not null,
  availability text not null default 'READY',
  rights_basis text not null default 'EXPLICIT_PERMISSION',
  permission_verified_at timestamptz not null,
  permission_evidence_ref text not null,
  source_provider text not null,
  source_rights_basis text not null,
  source_release_id text not null,
  bucket_id text not null,
  object_path text not null,
  checksum_sha256 text not null,
  mime_type text not null,
  byte_size bigint not null,
  width integer not null,
  height integer not null,
  created_at timestamptz not null default now(),
  constraint catalog_cover_revisions_revision_id_check
    check (catalog_cover_revision_id ~ '^asset:[0-9a-f]{40}$'),
  constraint catalog_cover_revisions_cover_id_check
    check (catalog_cover_id ~ '^cover:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'),
  constraint catalog_cover_revisions_anime_id_check
    check (catalog_anime_id ~ '^anime:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'),
  constraint catalog_cover_revisions_identity_check
    check (substr(catalog_cover_id, 7) = substr(catalog_anime_id, 7)),
  constraint catalog_cover_revisions_availability_check
    check (availability in ('READY', 'MISSING', 'REPLACE_REQUIRED')),
  constraint catalog_cover_revisions_rights_check
    check (rights_basis = 'EXPLICIT_PERMISSION'),
  constraint catalog_cover_revisions_evidence_check
    check (char_length(permission_evidence_ref) between 1 and 240),
  constraint catalog_cover_revisions_source_check
    check (char_length(source_provider) between 1 and 40 and char_length(source_rights_basis) between 1 and 120),
  constraint catalog_cover_revisions_bucket_check
    check (bucket_id = 'catalog-covers-preview'),
  constraint catalog_cover_revisions_object_path_check
    check (object_path ~ '^covers/anime-[a-f0-9-]+/[a-f0-9]{64}\.(jpg|png|webp)$'),
  constraint catalog_cover_revisions_checksum_check
    check (checksum_sha256 ~ '^[a-f0-9]{64}$'),
  constraint catalog_cover_revisions_mime_check
    check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  constraint catalog_cover_revisions_size_check
    check (byte_size between 1 and 8388608 and width between 1 and 10000 and height between 1 and 10000),
  constraint catalog_cover_revisions_reference_key
    unique (catalog_cover_revision_id, catalog_cover_id, catalog_anime_id, permission_verified_at)
);

create index catalog_cover_revisions_anime_idx
  on public.catalog_cover_revisions (catalog_anime_id, created_at desc);

alter table public.catalog_cover_revisions enable row level security;
revoke all on table public.catalog_cover_revisions from public, anon, authenticated;
grant select on table public.catalog_cover_revisions to anon, authenticated;
grant select, insert, update, delete on table public.catalog_cover_revisions to service_role;

create policy "read approved catalog cover revisions"
on public.catalog_cover_revisions for select to anon, authenticated
using (rights_basis = 'EXPLICIT_PERMISSION');

create or replace function private.capture_catalog_cover_revisions(p_release_id text)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.catalog_cover_revisions (
    catalog_cover_revision_id, catalog_cover_id, catalog_anime_id,
    availability, rights_basis, permission_verified_at, permission_evidence_ref,
    source_provider, source_rights_basis, source_release_id,
    bucket_id, object_path, checksum_sha256, mime_type, byte_size, width, height
  )
  select
    asset.asset_id,
    'cover:' || substr(asset.anime_id, 7),
    asset.anime_id,
    'READY',
    'EXPLICIT_PERMISSION',
    '2026-09-03 00:00:00+00'::timestamptz,
    'decision:CATALOG-PROD-01:2026-09-03',
    asset.source_provider,
    asset.rights_basis,
    asset.release_id,
    asset.bucket_id,
    asset.object_path,
    asset.checksum,
    asset.mime_type,
    asset.byte_size,
    asset.width,
    asset.height
  from public.catalog_assets asset
  where asset.release_id = p_release_id
  on conflict (catalog_cover_revision_id) do nothing;
$$;

create or replace function private.capture_active_catalog_cover_revisions()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'ACTIVE' and new.status is distinct from old.status then
    perform private.capture_catalog_cover_revisions(new.id);
  end if;
  return new;
end;
$$;

create trigger catalog_release_capture_cover_revisions
after update of status on public.catalog_releases
for each row execute function private.capture_active_catalog_cover_revisions();

do $$
declare
  v_release_id text;
begin
  select release_id into v_release_id
  from public.catalog_active_release
  where singleton;
  if v_release_id is not null then
    perform private.capture_catalog_cover_revisions(v_release_id);
  end if;
end;
$$;

alter table public.memory_visual_assets
  add column catalog_cover_id text,
  add column catalog_cover_revision_id text,
  add column catalog_anime_id text,
  add column permission_verified_at timestamptz;

alter table public.memory_visual_assets
  drop constraint memory_visual_assets_asset_type_check,
  drop constraint memory_visual_assets_storage_scope_check,
  drop constraint memory_visual_assets_rights_basis_check,
  drop constraint memory_visual_assets_design_spec_check;

alter table public.memory_visual_assets
  add constraint memory_visual_assets_asset_type_check
    check (asset_type in ('USER_IMAGE', 'SYSTEM_DESIGN', 'CATALOG_COVER')),
  add constraint memory_visual_assets_storage_scope_check
    check (
      (asset_type = 'CATALOG_COVER' and storage_scope = 'CATALOG_MANAGED')
      or (asset_type <> 'CATALOG_COVER' and storage_scope = 'LOCAL_ONLY')
    ),
  add constraint memory_visual_assets_rights_basis_check
    check (rights_basis in ('UNKNOWN', 'USER_ORIGINAL', 'LICENSED', 'SYSTEM_GENERATED', 'EXPLICIT_PERMISSION')),
  add constraint memory_visual_assets_source_metadata_check
    check (
      (
        asset_type = 'CATALOG_COVER'
        and rights_basis = 'EXPLICIT_PERMISSION'
        and design_spec is null
        and catalog_cover_id is not null
        and catalog_cover_revision_id is not null
        and catalog_anime_id is not null
        and permission_verified_at is not null
      )
      or (
        asset_type = 'SYSTEM_DESIGN'
        and rights_basis = 'SYSTEM_GENERATED'
        and design_spec is not null
        and jsonb_typeof(design_spec) = 'object'
        and octet_length(design_spec::text) <= 32768
        and catalog_cover_id is null
        and catalog_cover_revision_id is null
        and catalog_anime_id is null
        and permission_verified_at is null
      )
      or (
        asset_type = 'USER_IMAGE'
        and design_spec is null
        and catalog_cover_id is null
        and catalog_cover_revision_id is null
        and catalog_anime_id is null
        and permission_verified_at is null
      )
    ),
  add constraint memory_visual_assets_catalog_cover_id_check
    check (catalog_cover_id is null or catalog_cover_id ~ '^cover:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'),
  add constraint memory_visual_assets_catalog_cover_revision_id_check
    check (catalog_cover_revision_id is null or catalog_cover_revision_id ~ '^asset:[0-9a-f]{40}$'),
  add constraint memory_visual_assets_catalog_anime_id_check
    check (catalog_anime_id is null or catalog_anime_id ~ '^anime:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'),
  add constraint memory_visual_assets_catalog_cover_fk
    foreign key (catalog_cover_revision_id, catalog_cover_id, catalog_anime_id, permission_verified_at)
    references public.catalog_cover_revisions (
      catalog_cover_revision_id, catalog_cover_id, catalog_anime_id, permission_verified_at
    ) on update restrict on delete restrict;

create or replace function private.hydrate_catalog_cover_memory_asset()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_refs jsonb;
  v_ref jsonb;
begin
  if new.asset_type = 'CATALOG_COVER' then
    v_refs := coalesce(nullif(current_setting('moemoa.catalog_cover_refs', true), ''), '{}')::jsonb;
    v_ref := v_refs -> new.id::text;
    if v_ref is not null then
      if v_ref ->> 'sourceKind' <> 'CATALOG_COVER'
         or v_ref ->> 'rightsBasis' <> 'EXPLICIT_PERMISSION' then
        raise exception 'CATALOG_COVER_REFERENCE_INVALID';
      end if;
      new.catalog_cover_id := nullif(v_ref ->> 'catalogCoverId', '');
      new.catalog_cover_revision_id := nullif(v_ref ->> 'catalogCoverRevisionId', '');
      new.catalog_anime_id := nullif(v_ref ->> 'catalogAnimeId', '');
      new.permission_verified_at := nullif(v_ref ->> 'permissionVerifiedAt', '')::timestamptz;
    end if;
  else
    new.catalog_cover_id := null;
    new.catalog_cover_revision_id := null;
    new.catalog_anime_id := null;
    new.permission_verified_at := null;
  end if;
  return new;
end;
$$;

create trigger memory_visual_assets_catalog_cover_hydration
before insert or update on public.memory_visual_assets
for each row execute function private.hydrate_catalog_cover_memory_asset();

create or replace function private.assert_complete_card(
  p_user_id uuid,
  p_card_id uuid
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_card public.memory_cards%rowtype;
  v_asset public.memory_visual_assets%rowtype;
  v_asset_count integer;
begin
  select * into v_card
  from public.memory_cards
  where user_id = p_user_id and id = p_card_id;

  if not found or v_card.deleted_at is not null or v_card.status <> 'COMPLETE_PRIVATE' then
    return;
  end if;

  select count(*)::integer into v_asset_count
  from public.memory_visual_assets
  where user_id = p_user_id and card_id = p_card_id
    and deleted_at is null and state = 'READY' and is_current;
  if v_asset_count <> 1 then
    raise exception 'COMPLETE_CARD_ASSET_REQUIRED';
  end if;

  select * into v_asset
  from public.memory_visual_assets
  where user_id = p_user_id and card_id = p_card_id
    and deleted_at is null and state = 'READY' and is_current;

  if v_asset.asset_type = 'CATALOG_COVER' then
    if v_card.catalog_anime_id is null
       or v_card.catalog_anime_id <> v_asset.catalog_anime_id then
      raise exception 'CATALOG_COVER_TITLE_MISMATCH';
    end if;
    if nullif(btrim(coalesce(v_card.note, '')), '') is null
       and v_card.watched_at is null
       and v_card.episode is null
       and nullif(btrim(coalesce(v_card.scene_cue, '')), '') is null
       and cardinality(v_card.emotion_tags) = 0
       and nullif(btrim(coalesce(v_card.rewatch_intent, '')), '') is null then
      raise exception 'CATALOG_COVER_PERSONAL_SIGNAL_REQUIRED';
    end if;
  end if;
end;
$$;

alter function public.apply_memory_card_mutation(uuid, uuid, text, uuid, text, bigint, text, jsonb)
  rename to apply_memory_card_mutation_without_catalog_cover;
alter function public.resolve_memory_conflict(uuid, uuid, text, uuid, bigint, text, jsonb)
  rename to resolve_memory_conflict_without_catalog_cover;
alter function public.promote_guest_memory(uuid, uuid, text, text, jsonb)
  rename to promote_guest_memory_without_catalog_cover;

revoke all on function public.apply_memory_card_mutation_without_catalog_cover(uuid, uuid, text, uuid, text, bigint, text, jsonb)
  from public, anon, authenticated;
revoke all on function public.resolve_memory_conflict_without_catalog_cover(uuid, uuid, text, uuid, bigint, text, jsonb)
  from public, anon, authenticated;
revoke all on function public.promote_guest_memory_without_catalog_cover(uuid, uuid, text, text, jsonb)
  from public, anon, authenticated;

create function public.apply_memory_card_mutation(
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
begin
  perform set_config(
    'moemoa.catalog_cover_refs',
    case
      when p_entity_type = 'VISUAL_ASSET' and p_payload ->> 'assetType' = 'CATALOG_COVER'
      then jsonb_build_object(p_entity_id::text, p_payload -> 'catalogCoverRef')::text
      else '{}'
    end,
    true
  );
  return public.apply_memory_card_mutation_without_catalog_cover(
    p_operation_id, p_device_id, p_entity_type, p_entity_id, p_operation_type,
    p_base_version, p_request_hash, p_payload
  );
end;
$$;

create function public.resolve_memory_conflict(
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
begin
  perform set_config(
    'moemoa.catalog_cover_refs',
    case
      when p_entity_type = 'VISUAL_ASSET' and p_payload ->> 'assetType' = 'CATALOG_COVER'
      then jsonb_build_object(p_entity_id::text, p_payload -> 'catalogCoverRef')::text
      else '{}'
    end,
    true
  );
  return public.resolve_memory_conflict_without_catalog_cover(
    p_operation_id, p_device_id, p_entity_type, p_entity_id,
    p_base_version, p_request_hash, p_payload
  );
end;
$$;

create function public.promote_guest_memory(
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
  v_refs jsonb;
begin
  select coalesce(jsonb_object_agg(item ->> 'id', item -> 'catalogCoverRef'), '{}'::jsonb)
  into v_refs
  from jsonb_array_elements(coalesce(p_bundle -> 'visualAssets', '[]'::jsonb)) as rows(item)
  where item ->> 'assetType' = 'CATALOG_COVER';
  perform set_config('moemoa.catalog_cover_refs', v_refs::text, true);
  return public.promote_guest_memory_without_catalog_cover(
    p_operation_id, p_device_id, p_guest_owner_id, p_source_hash, p_bundle
  );
end;
$$;

revoke all on function public.apply_memory_card_mutation(uuid, uuid, text, uuid, text, bigint, text, jsonb)
  from public, anon;
revoke all on function public.resolve_memory_conflict(uuid, uuid, text, uuid, bigint, text, jsonb)
  from public, anon;
revoke all on function public.promote_guest_memory(uuid, uuid, text, text, jsonb)
  from public, anon;
grant execute on function public.apply_memory_card_mutation(uuid, uuid, text, uuid, text, bigint, text, jsonb)
  to authenticated;
grant execute on function public.resolve_memory_conflict(uuid, uuid, text, uuid, bigint, text, jsonb)
  to authenticated;
grant execute on function public.promote_guest_memory(uuid, uuid, text, text, jsonb)
  to authenticated;
