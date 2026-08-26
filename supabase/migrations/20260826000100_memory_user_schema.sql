create table public.user_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  handle text unique,
  bio text not null default '',
  locale text not null default 'en',
  time_zone text not null default 'UTC',
  profile_public boolean not null default false,
  minimum_retained_sync_seq bigint not null default 0,
  created_at timestamptz not null default now(),
  server_updated_at timestamptz not null default now(),
  constraint user_profiles_display_name_check
    check (char_length(btrim(display_name)) between 1 and 50),
  constraint user_profiles_handle_check
    check (handle is null or (char_length(handle) between 3 and 24 and handle ~ '^[a-z0-9-]+$')),
  constraint user_profiles_bio_check
    check (char_length(bio) <= 300),
  constraint user_profiles_locale_check
    check (
      char_length(locale) between 2 and 35
      and locale ~ '^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$'
    ),
  constraint user_profiles_time_zone_check
    check (char_length(btrim(time_zone)) between 1 and 100),
  constraint user_profiles_minimum_retained_sync_seq_check
    check (minimum_retained_sync_seq >= 0)
);

create table public.user_devices (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  installation_id uuid not null,
  platform text not null,
  app_version text not null,
  last_sync_seq bigint not null default 0,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint user_devices_platform_check
    check (platform in ('WEB', 'ANDROID')),
  constraint user_devices_app_version_check
    check (char_length(btrim(app_version)) between 1 and 100),
  constraint user_devices_last_sync_seq_check
    check (last_sync_seq >= 0),
  constraint user_devices_user_installation_key
    unique (user_id, installation_id),
  constraint user_devices_user_id_key
    unique (user_id, id)
);

create table public.user_account_promotions (
  operation_id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  device_id uuid not null,
  guest_owner_id text not null,
  source_hash text not null,
  status text not null,
  imported_counts jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint user_account_promotions_device_fk
    foreign key (user_id, device_id)
    references public.user_devices (user_id, id),
  constraint user_account_promotions_guest_owner_id_check
    check (
      guest_owner_id ~ '^guest:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    ),
  constraint user_account_promotions_source_hash_check
    check (source_hash ~ '^[0-9a-f]{64}$'),
  constraint user_account_promotions_status_check
    check (status in ('STARTED', 'COMPLETED', 'FAILED')),
  constraint user_account_promotions_imported_counts_check
    check (
      jsonb_typeof(imported_counts) = 'object'
      and octet_length(imported_counts::text) <= 4096
    ),
  constraint user_account_promotions_user_guest_key
    unique (user_id, guest_owner_id)
);

create table public.user_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  schema_version integer not null default 1,
  payload jsonb not null default '{}'::jsonb,
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  client_updated_at timestamptz not null,
  server_updated_at timestamptz not null default now(),
  constraint user_preferences_schema_version_check
    check (schema_version >= 1),
  constraint user_preferences_payload_check
    check (
      jsonb_typeof(payload) = 'object'
      and octet_length(payload::text) <= 32768
    ),
  constraint user_preferences_version_check
    check (version >= 1)
);

create table public.memory_private_titles (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  display_title text not null,
  normalized_title text not null,
  optional_genres text[] not null default '{}'::text[],
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  client_updated_at timestamptz not null,
  server_updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint memory_private_titles_display_title_check
    check (char_length(btrim(display_title)) between 1 and 120),
  constraint memory_private_titles_normalized_title_check
    check (
      char_length(normalized_title) between 1 and 160
      and normalized_title = lower(btrim(normalized_title))
    ),
  constraint memory_private_titles_optional_genres_check
    check (
      cardinality(optional_genres) <= 16
      and array_position(optional_genres, null) is null
      and not jsonb_path_exists(
        to_jsonb(optional_genres),
        '$[*] ? (@ like_regex "^.{49}")'
      )
    ),
  constraint memory_private_titles_version_check
    check (version >= 1),
  constraint memory_private_titles_user_id_key
    unique (user_id, id)
);

create index memory_private_titles_active_name_idx
  on public.memory_private_titles (user_id, normalized_title)
  where deleted_at is null;

create table public.memory_cards (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  catalog_anime_id text,
  private_title_id uuid,
  title_snapshot text not null,
  status text not null default 'DRAFT',
  note text,
  watched_at date,
  watched_at_precision text not null default 'UNKNOWN',
  episode integer,
  scene_cue text,
  emotion_tags text[] not null default '{}'::text[],
  rewatch_intent text,
  visibility text not null default 'PRIVATE',
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  client_updated_at timestamptz not null,
  server_updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint memory_cards_private_title_fk
    foreign key (user_id, private_title_id)
    references public.memory_private_titles (user_id, id),
  constraint memory_cards_title_source_check
    check (
      (catalog_anime_id is not null)::integer
      + (private_title_id is not null)::integer = 1
    ),
  constraint memory_cards_catalog_anime_id_check
    check (
      catalog_anime_id is null
      or catalog_anime_id ~ '^anime:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    ),
  constraint memory_cards_title_snapshot_check
    check (char_length(btrim(title_snapshot)) between 1 and 120),
  constraint memory_cards_status_check
    check (status in ('DRAFT', 'COMPLETE_PRIVATE', 'DELETED')),
  constraint memory_cards_note_check
    check (char_length(note) <= 10000),
  constraint memory_cards_watched_at_precision_check
    check (watched_at_precision in ('DAY', 'MONTH', 'YEAR', 'UNKNOWN')),
  constraint memory_cards_episode_check
    check (episode is null or episode > 0),
  constraint memory_cards_scene_cue_check
    check (scene_cue is null or char_length(scene_cue) <= 500),
  constraint memory_cards_emotion_tags_check
    check (
      cardinality(emotion_tags) <= 20
      and array_position(emotion_tags, null) is null
      and not jsonb_path_exists(
        to_jsonb(emotion_tags),
        '$[*] ? (@ like_regex "^.{49}")'
      )
    ),
  constraint memory_cards_rewatch_intent_check
    check (rewatch_intent is null or char_length(rewatch_intent) <= 100),
  constraint memory_cards_visibility_check
    check (visibility = 'PRIVATE'),
  constraint memory_cards_version_check
    check (version >= 1),
  constraint memory_cards_deleted_state_check
    check ((deleted_at is null) = (status <> 'DELETED')),
  constraint memory_cards_user_id_key
    unique (user_id, id)
);

create index memory_cards_owner_status_updated_idx
  on public.memory_cards (user_id, status, server_updated_at desc);

create index memory_cards_catalog_active_idx
  on public.memory_cards (user_id, catalog_anime_id)
  where deleted_at is null;

create index memory_cards_private_title_active_idx
  on public.memory_cards (user_id, private_title_id)
  where deleted_at is null;

create table public.memory_visual_assets (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  card_id uuid not null,
  asset_type text not null,
  state text not null,
  storage_scope text not null default 'LOCAL_ONLY',
  visibility text not null default 'PRIVATE',
  rights_basis text not null default 'UNKNOWN',
  checksum_sha256 text,
  mime_type text,
  byte_size bigint,
  width integer,
  height integer,
  design_spec jsonb,
  cloud_bucket text,
  cloud_object_path text,
  is_current boolean not null default false,
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  client_updated_at timestamptz not null,
  server_updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint memory_visual_assets_card_fk
    foreign key (user_id, card_id)
    references public.memory_cards (user_id, id),
  constraint memory_visual_assets_asset_type_check
    check (asset_type in ('USER_IMAGE', 'SYSTEM_DESIGN')),
  constraint memory_visual_assets_state_check
    check (state in ('READY', 'DELETE_PENDING', 'DELETED')),
  constraint memory_visual_assets_storage_scope_check
    check (storage_scope = 'LOCAL_ONLY'),
  constraint memory_visual_assets_visibility_check
    check (visibility = 'PRIVATE'),
  constraint memory_visual_assets_rights_basis_check
    check (rights_basis in ('UNKNOWN', 'USER_ORIGINAL', 'LICENSED', 'SYSTEM_GENERATED')),
  constraint memory_visual_assets_checksum_check
    check (checksum_sha256 is null or checksum_sha256 ~ '^[0-9a-f]{64}$'),
  constraint memory_visual_assets_mime_type_check
    check (
      mime_type is null
      or (
        char_length(mime_type) <= 255
        and mime_type ~ '^image/[A-Za-z0-9.+-]+$'
      )
    ),
  constraint memory_visual_assets_byte_size_check
    check (byte_size is null or byte_size > 0),
  constraint memory_visual_assets_dimensions_check
    check (
      (width is null) = (height is null)
      and (width is null or (width > 0 and height > 0))
    ),
  constraint memory_visual_assets_design_spec_check
    check (
      (
        asset_type = 'SYSTEM_DESIGN'
        and design_spec is not null
        and jsonb_typeof(design_spec) = 'object'
        and octet_length(design_spec::text) <= 32768
      )
      or (asset_type = 'USER_IMAGE' and design_spec is null)
    ),
  constraint memory_visual_assets_cloud_fields_check
    check (cloud_bucket is null and cloud_object_path is null),
  constraint memory_visual_assets_version_check
    check (version >= 1),
  constraint memory_visual_assets_deleted_state_check
    check ((deleted_at is null) = (state <> 'DELETED')),
  constraint memory_visual_assets_user_id_key
    unique (user_id, id)
);

create unique index memory_visual_assets_current_card_idx
  on public.memory_visual_assets (card_id)
  where is_current and deleted_at is null;

create table public.memory_boards (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  description text not null default '',
  visibility text not null default 'PRIVATE',
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  client_updated_at timestamptz not null,
  server_updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint memory_boards_title_check
    check (char_length(btrim(title)) between 1 and 80),
  constraint memory_boards_description_check
    check (char_length(description) <= 500),
  constraint memory_boards_visibility_check
    check (visibility = 'PRIVATE'),
  constraint memory_boards_version_check
    check (version >= 1),
  constraint memory_boards_user_id_key
    unique (user_id, id)
);

create index memory_boards_owner_updated_idx
  on public.memory_boards (user_id, server_updated_at desc)
  where deleted_at is null;

create table public.memory_board_cards (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  board_id uuid not null,
  card_id uuid not null,
  position_key text not null,
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  client_updated_at timestamptz not null,
  server_updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint memory_board_cards_board_fk
    foreign key (user_id, board_id)
    references public.memory_boards (user_id, id),
  constraint memory_board_cards_card_fk
    foreign key (user_id, card_id)
    references public.memory_cards (user_id, id),
  constraint memory_board_cards_position_key_check
    check (char_length(position_key) between 1 and 128),
  constraint memory_board_cards_version_check
    check (version >= 1),
  constraint memory_board_cards_board_card_key
    unique (board_id, card_id)
);

create index memory_board_cards_active_order_idx
  on public.memory_board_cards (user_id, board_id, position_key)
  where deleted_at is null;

create table public.sync_operations (
  operation_id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  device_id uuid not null,
  entity_type text not null,
  entity_id uuid not null,
  operation_type text not null,
  base_version bigint not null,
  request_hash text not null,
  result_status text not null,
  applied_version bigint,
  applied_sync_seq bigint,
  error_code text,
  created_at timestamptz not null default now(),
  constraint sync_operations_device_fk
    foreign key (user_id, device_id)
    references public.user_devices (user_id, id),
  constraint sync_operations_entity_type_check
    check (entity_type in ('PRIVATE_TITLE', 'MEMORY_CARD', 'VISUAL_ASSET', 'MEMORY_BOARD', 'MEMORY_BOARD_CARD')),
  constraint sync_operations_operation_type_check
    check (operation_type in ('UPSERT', 'DELETE', 'PROMOTE', 'RESOLVE_CONFLICT')),
  constraint sync_operations_base_version_check
    check (base_version >= 0),
  constraint sync_operations_request_hash_check
    check (request_hash ~ '^[0-9a-f]{64}$'),
  constraint sync_operations_result_status_check
    check (result_status in ('APPLIED', 'CONFLICT', 'REJECTED')),
  constraint sync_operations_applied_version_check
    check (applied_version is null or applied_version >= 1),
  constraint sync_operations_applied_sync_seq_check
    check (applied_sync_seq is null or applied_sync_seq >= 1),
  constraint sync_operations_error_code_check
    check (error_code is null or char_length(error_code) between 1 and 100)
);

create index sync_operations_user_created_idx
  on public.sync_operations (user_id, created_at desc);

create table public.sync_changes (
  sync_seq bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  entity_type text not null,
  entity_id uuid not null,
  operation_type text not null,
  entity_version bigint not null,
  changed_at timestamptz not null default now(),
  constraint sync_changes_entity_type_check
    check (entity_type in ('PRIVATE_TITLE', 'MEMORY_CARD', 'VISUAL_ASSET', 'MEMORY_BOARD', 'MEMORY_BOARD_CARD')),
  constraint sync_changes_operation_type_check
    check (operation_type in ('UPSERT', 'DELETE')),
  constraint sync_changes_entity_version_check
    check (entity_version >= 1)
);

create index sync_changes_user_seq_idx
  on public.sync_changes (user_id, sync_seq);
