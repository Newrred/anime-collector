-- W08. Server-controlled private derivatives; no upload/download grant to client roles.
alter table private.memory_publication_settings
  add column images_enabled boolean not null default false,
  add column asset_limit integer not null default 0 check(asset_limit>=0),
  add column asset_bytes_limit bigint not null default 0 check(asset_bytes_limit>=0);
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('memory-public-derivatives','memory-public-derivatives',false,2097152,array['image/webp']);
create policy memory_derivatives_deny_client on storage.objects as restrictive for all to anon,authenticated
  using(bucket_id <> 'memory-public-derivatives') with check(bucket_id <> 'memory-public-derivatives');

-- Trusted moderation approval, never populated from client metadata or rights self-assertion.
create table private.memory_public_image_rights(
  asset_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  source_version bigint not null,
  image_type text not null check(image_type in ('USER_ORIGINAL','LICENSED_IMAGE')),
  evidence_ref text not null check(length(evidence_ref) between 1 and 240),
  approved_at timestamptz not null default now(),
  revoked_at timestamptz,
  primary key(user_id,asset_id,source_version)
);
create table private.memory_public_assets(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  card_id uuid not null,
  source_asset_id uuid not null,
  source_version bigint not null,
  source_hash text not null check(source_hash ~ '^[a-f0-9]{64}$'),
  operation_id uuid not null,
  policy_revision text not null,
  state text not null default 'PREPARING' check(state in ('PREPARING','READY','FAILED','CANCELLED','DELETING','DELETED')),
  object_prefix uuid not null default gen_random_uuid(),
  reserved_bytes bigint not null default 4194304,
  full_hash text, thumb_hash text,
  full_bytes integer, thumb_bytes integer,
  width integer,height integer,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now()+interval '24 hours'),
  unique(user_id,operation_id),
  check(state<>'READY' or (full_hash ~ '^[a-f0-9]{64}$' and thumb_hash ~ '^[a-f0-9]{64}$'
    and full_bytes between 1 and 2097152 and thumb_bytes between 1 and 2097152
    and width between 1 and 1600 and height between 1 and 1600))
);
-- No FK to mutable source asset/card: retain keys for cleanup even after source purging.
create index memory_public_assets_source on private.memory_public_assets(user_id,source_asset_id,source_version,state);
alter table private.memory_public_image_rights enable row level security;
alter table private.memory_public_assets enable row level security;
revoke all on private.memory_public_image_rights,private.memory_public_assets from public,anon,authenticated;

create function public.reserve_memory_public_asset(p_asset_id uuid,p_source_version bigint,p_operation_id uuid,p_policy_revision text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := private.require_publication_writer(); a public.memory_visual_assets%rowtype;
  r private.memory_public_assets%rowtype; settings private.memory_publication_settings%rowtype; n bigint; bytes bigint;
begin
  select * into settings from private.memory_publication_settings where singleton for share;
  if not settings.images_enabled then raise exception 'PUBLIC_IMAGE_DISABLED'; end if;
  if p_policy_revision is distinct from settings.policy_revision or p_operation_id is null then raise exception 'CONSENT_MISMATCH'; end if;
  -- Serialize reservations per account; pending reservations consume the same budget as ready objects.
  perform 1 from public.user_profiles where user_id=u for update;
  if not found then raise exception 'AUTH_REQUIRED'; end if;
  select * into a from public.memory_visual_assets where id=p_asset_id and user_id=u and version=p_source_version
    and asset_type='USER_IMAGE' and state='READY' and is_current and deleted_at is null for share;
  if not found or a.checksum_sha256 is null then raise exception 'PUBLIC_VISUAL_NOT_READY'; end if;
  if not exists(select 1 from public.memory_cards where user_id=u and id=a.card_id and status='COMPLETE_PRIVATE' and deleted_at is null)
    or exists(select 1 from private.memory_public_cards where user_id=u and card_id=a.card_id and (revoked or hidden)) then raise exception 'PUBLICATION_RESTRICTED'; end if;
  if not exists(select 1 from private.memory_public_image_rights where user_id=u and asset_id=a.id and source_version=a.version and revoked_at is null) then raise exception 'IMAGE_RIGHTS_REQUIRED'; end if;
  select * into r from private.memory_public_assets where user_id=u and operation_id=p_operation_id;
  if found then
    if r.source_asset_id<>a.id or r.source_version<>a.version or r.policy_revision<>p_policy_revision then raise exception 'OPERATION_MISMATCH'; end if;
    if r.state='READY' then return jsonb_build_object('id',r.id,'state','READY'); end if;
    raise exception 'ASSET_OPERATION_UNAVAILABLE';
  end if;
  select count(*),coalesce(sum(reserved_bytes),0) into n,bytes from private.memory_public_assets where user_id=u and state<>'DELETED';
  if n>=settings.asset_limit or bytes+4194304>settings.asset_bytes_limit then raise exception 'IMAGE_QUOTA_EXCEEDED'; end if;
  insert into private.memory_public_assets(user_id,card_id,source_asset_id,source_version,source_hash,operation_id,policy_revision)
    values(u,a.card_id,a.id,a.version,a.checksum_sha256,p_operation_id,p_policy_revision) returning * into r;
  return jsonb_build_object('id',r.id,'state',r.state,'sourceHash',r.source_hash,'prefix',r.object_prefix);
end $$;

create function public.complete_memory_public_asset(p_id uuid,p_full_hash text,p_thumb_hash text,p_full_bytes integer,p_thumb_bytes integer,p_width integer,p_height integer)
returns void language plpgsql security definer set search_path='' as $$
declare r private.memory_public_assets%rowtype;
begin
 select * into r from private.memory_public_assets where id=p_id for update;
 if not found or r.state<>'PREPARING' or r.expires_at<=now() then raise exception 'ASSET_OPERATION_UNAVAILABLE'; end if;
 if not exists(select 1 from private.memory_publication_settings where writes_enabled and images_enabled and policy_revision=r.policy_revision)
   or exists(select 1 from private.memory_publication_accounts where user_id=r.user_id and (hidden or write_blocked))
   or exists(select 1 from private.memory_public_cards where user_id=r.user_id and card_id=r.card_id and (hidden or revoked))
   or not exists(select 1 from public.memory_cards where user_id=r.user_id and id=r.card_id and deleted_at is null and status='COMPLETE_PRIVATE')
   or not exists(select 1 from public.memory_visual_assets where id=r.source_asset_id and user_id=r.user_id and version=r.source_version and is_current and deleted_at is null)
   or not exists(select 1 from private.memory_public_image_rights where user_id=r.user_id and asset_id=r.source_asset_id and source_version=r.source_version and revoked_at is null)
 then raise exception 'PUBLICATION_RESTRICTED'; end if;
 if p_full_hash is null or p_thumb_hash is null or p_full_bytes is null or p_thumb_bytes is null or p_width is null or p_height is null then raise exception 'INVALID_ASSET'; end if;
 update private.memory_public_assets set state='READY',full_hash=p_full_hash,thumb_hash=p_thumb_hash,full_bytes=p_full_bytes,
  thumb_bytes=p_thumb_bytes,width=p_width,height=p_height,reserved_bytes=p_full_bytes+p_thumb_bytes where id=r.id;
end $$;

create function private.public_asset_referenced(p_id uuid) returns boolean language sql stable set search_path='' as $$
 select exists(select 1 from private.memory_publications where
  published_snapshot @> jsonb_build_object('cards',jsonb_build_array(jsonb_build_object('visual',jsonb_build_object('assetId',p_id)))) or
  preview->'snapshot' @> jsonb_build_object('cards',jsonb_build_array(jsonb_build_object('visual',jsonb_build_object('assetId',p_id)))));
$$;
create function public.cancel_memory_public_asset(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
 if not exists(select 1 from private.memory_public_assets where id=p_id and user_id=auth.uid()) then raise exception 'NOT_FOUND'; end if;
 if private.public_asset_referenced(p_id) then raise exception 'ASSET_IN_USE'; end if;
 update private.memory_public_assets set state='CANCELLED' where id=p_id and user_id=auth.uid() and state in ('PREPARING','READY','FAILED');
end $$;
create function public.fail_memory_public_asset(p_id uuid) returns void language sql security definer set search_path='' as $$
 update private.memory_public_assets set state='FAILED' where id=p_id and state='PREPARING';
$$;

-- Match domain/systemDesign.js canonical JSON and FNV-1a over Unicode code points.
-- Export only its visual token, never the private seed/genre strings used to derive it.
create function private.public_system_design_token(spec jsonb) returns text
language plpgsql immutable set search_path='' as $$
declare canonical text; genres text; h bigint:=2166136261; i integer;
begin
 if spec->>'version' is distinct from '1' or jsonb_typeof(spec->'version') is distinct from 'number'
   or spec->>'templateId' is null or spec->>'templateId' not in ('memory-gradient','memory-type')
   or spec->>'titleLayout' is null or spec->>'titleLayout' not in ('BOTTOM_LEFT','CENTER','TOP_LEFT')
   or jsonb_typeof(spec->'paletteId') is distinct from 'string' or length(btrim(spec->>'paletteId')) not between 1 and 256
   or jsonb_typeof(spec->'patternSeed') is distinct from 'string' or length(btrim(spec->>'patternSeed')) not between 1 and 256
   or jsonb_typeof(spec->'genreTokens') is distinct from 'array' then raise exception 'PUBLIC_VISUAL_NOT_READY'; end if;
 if jsonb_array_length(spec->'genreTokens')>64 or exists(select 1 from jsonb_array_elements(spec->'genreTokens') t where jsonb_typeof(t)<>'string') then raise exception 'PUBLIC_VISUAL_NOT_READY'; end if;
 select coalesce(string_agg(to_json(btrim(token#>>'{}'))::text,',' order by n),'') into genres
  from jsonb_array_elements(spec->'genreTokens') with ordinality rows(token,n) where btrim(token#>>'{}')<>'';
 canonical := '{"version":1,"templateId":'||to_json(spec->>'templateId')::text||',"paletteId":'||to_json(btrim(spec->>'paletteId'))::text||
  ',"patternSeed":'||to_json(btrim(spec->>'patternSeed'))::text||',"titleLayout":'||to_json(spec->>'titleLayout')::text||',"genreTokens":['||genres||']}';
 for i in 1..char_length(canonical) loop h:=((h # ascii(substr(canonical,i,1)))*16777619)%4294967296; end loop;
 return lpad(to_hex(h),8,'0');
end $$;
revoke all on function private.public_system_design_token(jsonb) from public,anon,authenticated;

create function private.resolve_memory_public_visual(p_user uuid,p_asset public.memory_visual_assets,p_anime text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r private.memory_public_assets%rowtype; spec jsonb := p_asset.design_spec;
begin
 if p_asset.asset_type='CATALOG_COVER' then
  if not exists(select 1 from public.catalog_cover_revisions where catalog_cover_revision_id=p_asset.catalog_cover_revision_id
    and catalog_anime_id=p_anime and availability='READY' and rights_basis='EXPLICIT_PERMISSION') then raise exception 'PUBLIC_VISUAL_NOT_READY'; end if;
  return jsonb_build_object('type','CATALOG_COVER','revisionId',p_asset.catalog_cover_revision_id);
 elsif p_asset.asset_type='SYSTEM_DESIGN' then
  if spec->>'version' is distinct from '1' or spec->>'templateId' not in ('memory-gradient','memory-type')
    or spec->>'titleLayout' not in ('BOTTOM_LEFT','CENTER','TOP_LEFT')
    or spec->>'templateId' is null or spec->>'titleLayout' is null then raise exception 'PUBLIC_VISUAL_NOT_READY'; end if;
  -- Derived visual parameters only: don't publish seeds, private genres or extra JSON keys.
  return jsonb_build_object('type','SYSTEM_DESIGN','rendererVersion',1,'patternToken',
    private.public_system_design_token(spec));
 elsif p_asset.asset_type='USER_IMAGE' then
  select a.* into r from private.memory_public_assets a join private.memory_public_image_rights rights
   on rights.user_id=a.user_id and rights.asset_id=a.source_asset_id and rights.source_version=a.source_version
   where a.user_id=p_user and a.source_asset_id=p_asset.id and a.source_version=p_asset.version
    and a.state='READY' and rights.revoked_at is null order by a.created_at desc,a.id limit 1;
  if not found then raise exception 'PUBLIC_VISUAL_NOT_READY'; end if;
  return jsonb_build_object('type','USER_IMAGE','assetId',r.id,'width',r.width,'height',r.height);
 end if;
 raise exception 'PUBLIC_VISUAL_NOT_READY';
end $$;
create or replace function private.build_memory_publication(p_user uuid, p_board uuid, p_selection jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare b public.memory_boards%rowtype; c public.memory_cards%rowtype;
  a public.memory_visual_assets%rowtype; cover public.catalog_cover_revisions%rowtype;
  membership public.memory_board_cards%rowtype; item jsonb; fields jsonb; card_public uuid; cards jsonb := '[]'; sources jsonb := '[]';
  row_json jsonb; board_json jsonb; seen uuid[] := '{}'; cid uuid;
begin
  if octet_length(p_selection::text) > 65536 or jsonb_typeof(p_selection) is distinct from 'object' or
    (p_selection - array['title','description','cards']) <> '{}'::jsonb or
    jsonb_typeof(p_selection->'title') is distinct from 'string' or
    length(btrim(p_selection->>'title')) not between 1 and 80 or
    jsonb_typeof(p_selection->'description') is distinct from 'string' or
    length(p_selection->>'description') > 500 or
    jsonb_typeof(p_selection->'cards') is distinct from 'array' then
    raise exception 'INVALID_SELECTION';
  end if;
  if jsonb_array_length(p_selection->'cards') not between 1 and 100 then raise exception 'INVALID_SELECTION'; end if;
  select * into b from public.memory_boards where user_id=p_user and id=p_board and deleted_at is null for share;
  if not found then raise exception 'NOT_FOUND'; end if;
  for item in select value from jsonb_array_elements(p_selection->'cards') loop
    if jsonb_typeof(item) is distinct from 'object' or
      (item - array['cardId','fields']) <> '{}'::jsonb or
      jsonb_typeof(item->'fields') is distinct from 'array' or
      jsonb_typeof(item->'cardId') is distinct from 'string' then raise exception 'INVALID_SELECTION'; end if;
    cid := (item->>'cardId')::uuid;
    if cid=any(seen) then raise exception 'DUPLICATE_CARD'; end if;
    seen := array_append(seen,cid);
    fields := item->'fields';
    if jsonb_array_length(fields) > 6 then raise exception 'INVALID_SELECTION'; end if;
    if exists(select 1 from jsonb_array_elements(fields) f where jsonb_typeof(f) <> 'string'
      or f #>> '{}' not in ('note','watchedAt','episode','sceneCue','emotionTags','rewatchIntent')) then
      raise exception 'INVALID_SELECTION';
    end if;
    select * into c from public.memory_cards where user_id=p_user and id=cid
      and status='COMPLETE_PRIVATE' and deleted_at is null for share;
    if not found then raise exception 'NOT_FOUND'; end if;
    select * into membership from public.memory_board_cards where user_id=p_user and board_id=p_board
      and card_id=cid and deleted_at is null for share;
    if not found then raise exception 'NOT_FOUND'; end if;
    insert into private.memory_public_cards(user_id,card_id) values(p_user,cid) on conflict(user_id,card_id) do nothing;
    select id into card_public from private.memory_public_cards where user_id=p_user and card_id=cid and not revoked and not hidden;
    if not found then raise exception 'PUBLICATION_RESTRICTED'; end if;
    select * into a from public.memory_visual_assets where user_id=p_user and card_id=cid
      and is_current and state='READY' and deleted_at is null for share;
    if not found then raise exception 'PUBLIC_VISUAL_NOT_READY'; end if;
    row_json := jsonb_build_object('id',card_public,'title',c.title_snapshot,
      'visual',private.resolve_memory_public_visual(p_user,a,c.catalog_anime_id));
    if c.catalog_anime_id is not null then row_json := row_json || jsonb_build_object('animeId',c.catalog_anime_id); end if;
    if fields ? 'note' then row_json := row_json || jsonb_build_object('note',c.note); end if;
    if fields ? 'watchedAt' then row_json := row_json || jsonb_build_object('watchedAt',c.watched_at,'watchedAtPrecision',c.watched_at_precision); end if;
    if fields ? 'episode' then row_json := row_json || jsonb_build_object('episode',c.episode); end if;
    if fields ? 'sceneCue' then row_json := row_json || jsonb_build_object('sceneCue',c.scene_cue); end if;
    if fields ? 'emotionTags' then row_json := row_json || jsonb_build_object('emotionTags',c.emotion_tags); end if;
    if fields ? 'rewatchIntent' then row_json := row_json || jsonb_build_object('rewatchIntent',c.rewatch_intent); end if;
    cards := cards || jsonb_build_array(row_json);
    sources := sources || jsonb_build_array(jsonb_build_object('cardId',cid,'version',c.version,'assetId',a.id,'assetVersion',a.version,'membershipVersion',membership.version));
  end loop;
  board_json := jsonb_build_object('schemaVersion',1,'title',p_selection->>'title','description',p_selection->>'description','cards',cards);
  return jsonb_build_object('snapshot',board_json,'sources',sources,'boardVersion',b.version);
end $$;


create or replace function private.memory_public_card_readable(p_user uuid,p_card jsonb) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from private.memory_public_cards pc join public.memory_cards c on c.user_id=pc.user_id and c.id=pc.card_id
  where pc.user_id=p_user and pc.id=(p_card->>'id')::uuid and not pc.revoked and not pc.hidden and c.deleted_at is null and c.status='COMPLETE_PRIVATE')
 and case p_card->'visual'->>'type'
 when 'CATALOG_COVER' then exists(select 1 from public.catalog_cover_revisions where catalog_cover_revision_id=p_card->'visual'->>'revisionId' and availability='READY')
 when 'SYSTEM_DESIGN' then p_card->'visual'->>'rendererVersion'='1'
 when 'USER_IMAGE' then exists(select 1 from private.memory_public_assets a join private.memory_public_image_rights rights
  on rights.user_id=a.user_id and rights.asset_id=a.source_asset_id and rights.source_version=a.source_version
  where a.id=(p_card->'visual'->>'assetId')::uuid and a.user_id=p_user and a.state='READY' and rights.revoked_at is null)
 else false end;
$$;

-- Only the trusted image endpoint may obtain storage coordinates. The visitor gets bytes, not this result.
create function public.resolve_memory_public_image(p_publication_id uuid,p_asset_id uuid,p_variant text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare snapshot jsonb; a private.memory_public_assets%rowtype;
begin
 if p_variant not in ('full','thumb') or p_variant is null then return null; end if;
 snapshot := public.read_memory_publication(p_publication_id);
 if snapshot is null or not (snapshot @> jsonb_build_object('cards',jsonb_build_array(jsonb_build_object('visual',jsonb_build_object('type','USER_IMAGE','assetId',p_asset_id))))) then return null; end if;
 select * into a from private.memory_public_assets where id=p_asset_id and state='READY';
 if not found then return null; end if;
 return jsonb_build_object('path',a.object_prefix||'/'||p_variant||'.webp','hash',case when p_variant='full' then a.full_hash else a.thumb_hash end);
end $$;
create function public.resolve_memory_image_preview(p_asset_id uuid,p_variant text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare a private.memory_public_assets%rowtype;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
 if p_variant not in ('full','thumb') or p_variant is null then return null; end if;
 select assets.* into a from private.memory_public_assets assets join private.memory_public_image_rights rights
  on rights.user_id=assets.user_id and rights.asset_id=assets.source_asset_id and rights.source_version=assets.source_version
  where assets.id=p_asset_id and assets.user_id=auth.uid() and assets.state='READY' and rights.revoked_at is null;
 if not found then return null; end if;
 return jsonb_build_object('path',a.object_prefix||'/'||p_variant||'.webp','hash',case when p_variant='full' then a.full_hash else a.thumb_hash end);
end $$;

create function public.claim_memory_image_cleanup(p_limit integer default 50) returns jsonb
language plpgsql security definer set search_path='' as $$
declare ids uuid[]; result jsonb;
begin
 select array_agg(id) into ids from (select id from private.memory_public_assets
  where (state in ('DELETING','FAILED','CANCELLED') or expires_at<now()) and state<>'DELETED'
   and not private.public_asset_referenced(id) order by created_at limit greatest(1,least(coalesce(p_limit,50),100)) for update skip locked) candidates;
 update private.memory_public_assets set state='DELETING' where id=any(ids);
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'prefix',object_prefix)),'[]') into result from private.memory_public_assets where id=any(ids);
 return result;
end $$;
create function public.complete_memory_image_cleanup(p_id uuid) returns void language sql security definer set search_path='' as $$
 update private.memory_public_assets set state='DELETED',reserved_bytes=0 where id=p_id and state='DELETING';
$$;

revoke all on function private.resolve_memory_public_visual(uuid,public.memory_visual_assets,text),private.public_asset_referenced(uuid) from public,anon,authenticated;
revoke all on function public.reserve_memory_public_asset(uuid,bigint,uuid,text),public.cancel_memory_public_asset(uuid),public.resolve_memory_image_preview(uuid,text) from public,anon,authenticated;
grant execute on function public.reserve_memory_public_asset(uuid,bigint,uuid,text),public.cancel_memory_public_asset(uuid),public.resolve_memory_image_preview(uuid,text) to authenticated;
revoke all on function public.complete_memory_public_asset(uuid,text,text,integer,integer,integer,integer),public.fail_memory_public_asset(uuid),
 public.resolve_memory_public_image(uuid,uuid,text),public.claim_memory_image_cleanup(integer),public.complete_memory_image_cleanup(uuid) from public,anon,authenticated;
grant execute on function public.complete_memory_public_asset(uuid,text,text,integer,integer,integer,integer),public.fail_memory_public_asset(uuid),
 public.resolve_memory_public_image(uuid,uuid,text),public.claim_memory_image_cleanup(integer),public.complete_memory_image_cleanup(uuid) to service_role;
