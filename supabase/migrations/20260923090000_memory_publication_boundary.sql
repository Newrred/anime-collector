-- W07 additive, disabled by default. Never change private row visibility.
-- No object URLs or user image bytes are accepted by this boundary.
create table private.memory_publication_settings (
  singleton boolean primary key default true check (singleton),
  reads_enabled boolean not null default false,
  writes_enabled boolean not null default false,
  policy_revision text not null default 'UNAPPROVED'
);
insert into private.memory_publication_settings default values;

create table private.memory_publication_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  hidden boolean not null default false,
  write_blocked boolean not null default false
);
create table private.memory_public_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  card_id uuid not null,
  revoked boolean not null default false,
  hidden boolean not null default false,
  unique(user_id, card_id),
  foreign key(user_id, card_id) references public.memory_cards(user_id, id) on delete cascade
);
create table private.memory_publications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  board_id uuid not null,
  revision bigint not null default 0 check(revision >= 0),
  state text not null default 'PRIVATE' check(state in ('PRIVATE','PREPARING','PUBLISHED','REVOKED')),
  hidden boolean not null default false,
  selection jsonb,
  preview jsonb,
  preview_hash text,
  policy_revision text,
  published_snapshot jsonb,
  published_operation uuid,
  published_hash text,
  published_revision bigint,
  unique(user_id, board_id),
  foreign key(user_id, board_id) references public.memory_boards(user_id, id) on delete cascade
);
-- These are server internals, including owner/source IDs and unpublished previews.
alter table private.memory_publication_settings enable row level security;
alter table private.memory_publication_accounts enable row level security;
alter table private.memory_public_cards enable row level security;
alter table private.memory_publications enable row level security;
revoke all on private.memory_publication_settings, private.memory_publication_accounts,
  private.memory_public_cards, private.memory_publications from public, anon, authenticated;

create function private.require_publication_writer() returns uuid
language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid();
begin
  if u is null then raise exception 'AUTH_REQUIRED'; end if;
  if not exists(select 1 from private.memory_publication_settings
    where writes_enabled and policy_revision <> 'UNAPPROVED') then
    raise exception 'PUBLICATION_DISABLED';
  end if;
  if exists(select 1 from private.memory_publication_accounts where user_id=u and (hidden or write_blocked)) then
    raise exception 'PUBLICATION_RESTRICTED';
  end if;
  return u;
end $$;

-- Only selected fields are copied, using server rows. Client cannot supply the public payload.
-- W08 extends the visual resolver; unsupported images must fail the entire preview.
create function private.build_memory_publication(p_user uuid, p_board uuid, p_selection jsonb)
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
    if not found or a.asset_type <> 'CATALOG_COVER' then raise exception 'PUBLIC_VISUAL_NOT_READY'; end if;
    select * into cover from public.catalog_cover_revisions where catalog_cover_revision_id=a.catalog_cover_revision_id
      and catalog_anime_id=c.catalog_anime_id and availability='READY' and rights_basis='EXPLICIT_PERMISSION';
    if not found then raise exception 'PUBLIC_VISUAL_NOT_READY'; end if;
    row_json := jsonb_build_object('id',card_public,'title',c.title_snapshot,
      'visual',jsonb_build_object('type','CATALOG_COVER','revisionId',cover.catalog_cover_revision_id));
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

create function public.prepare_memory_publication(p_board_id uuid, p_expected_revision bigint, p_selection jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare u uuid := private.require_publication_writer(); p private.memory_publications%rowtype; draft jsonb; policy text; h text;
begin
  if not exists(select 1 from public.memory_boards where user_id=u and id=p_board_id and deleted_at is null) then raise exception 'NOT_FOUND'; end if;
  insert into private.memory_publications(user_id,board_id) values(u,p_board_id) on conflict(user_id,board_id) do nothing;
  select * into p from private.memory_publications where user_id=u and board_id=p_board_id for update;
  if p.hidden then raise exception 'PUBLICATION_RESTRICTED'; end if;
  if p_expected_revision is distinct from p.revision then raise exception 'PUBLICATION_CONFLICT'; end if;
  draft := private.build_memory_publication(u,p_board_id,p_selection);
  select policy_revision into policy from private.memory_publication_settings where singleton;
  h := encode(sha256(convert_to(jsonb_build_object('draft',draft,'policy',policy,'revision',p.revision+1)::text,'UTF8')),'hex');
  update private.memory_publications set revision=revision+1,state='PREPARING',selection=p_selection,
    preview=draft,preview_hash=h,policy_revision=policy where id=p.id;
  return jsonb_build_object('id',p.id,'revision',p.revision+1,'reviewHash',h,'policyRevision',policy,'snapshot',draft->'snapshot');
end $$;

create function public.publish_memory_publication(p_id uuid,p_expected_revision bigint,p_review_hash text,p_policy_revision text,p_operation_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare u uuid := private.require_publication_writer(); p private.memory_publications%rowtype; draft jsonb;
begin
  if p_operation_id is null then raise exception 'INVALID_OPERATION'; end if;
  select * into p from private.memory_publications where id=p_id and user_id=u for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if p.hidden then raise exception 'PUBLICATION_RESTRICTED'; end if;
  if p.published_operation=p_operation_id then
    if p.published_hash is distinct from p_review_hash or p.published_revision is distinct from p_expected_revision or p.policy_revision is distinct from p_policy_revision then raise exception 'OPERATION_MISMATCH'; end if;
    return jsonb_build_object('id',p.id,'revision',p.revision,'state',p.state);
  end if;
  if p.revision is distinct from p_expected_revision or p.state <> 'PREPARING' then raise exception 'PUBLICATION_CONFLICT'; end if;
  if p.preview_hash is distinct from p_review_hash or p.policy_revision is distinct from p_policy_revision or
    not exists(select 1 from private.memory_publication_settings where policy_revision=p_policy_revision) then raise exception 'CONSENT_MISMATCH'; end if;
  draft := private.build_memory_publication(u,p.board_id,p.selection);
  if draft is distinct from p.preview then raise exception 'PREVIEW_CHANGED'; end if;
  update private.memory_publications set revision=revision+1,state='PUBLISHED',published_snapshot=preview->'snapshot',
    published_operation=p_operation_id,published_hash=p_review_hash,published_revision=p_expected_revision,
    preview=null,preview_hash=null,selection=null where id=p.id;
  return jsonb_build_object('id',p.id,'revision',p.revision+1,'state','PUBLISHED');
end $$;

-- Revocation remains available when writes are disabled or the owner is restricted.
create function public.revoke_memory_publication(p_id uuid,p_expected_revision bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid(); p private.memory_publications%rowtype;
begin
  if u is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into p from private.memory_publications where id=p_id and user_id=u for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if p.state='REVOKED' then return jsonb_build_object('id',p.id,'revision',p.revision,'state',p.state); end if;
  if p.revision is distinct from p_expected_revision then raise exception 'PUBLICATION_CONFLICT'; end if;
  update private.memory_publications set revision=revision+1,state='REVOKED',published_snapshot=null,
    preview=null,preview_hash=null,selection=null where id=p.id;
  return jsonb_build_object('id',p.id,'revision',p.revision+1,'state','REVOKED');
end $$;

create function public.revoke_memory_card_publications(p_card_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid();
begin
  if u is null then raise exception 'AUTH_REQUIRED'; end if;
  if not exists(select 1 from public.memory_cards where user_id=u and id=p_card_id) then raise exception 'NOT_FOUND'; end if;
  insert into private.memory_public_cards(user_id,card_id,revoked) values(u,p_card_id,true)
    on conflict(user_id,card_id) do update set revoked=true;
end $$;

create function private.memory_public_card_readable(p_user uuid,p_card jsonb) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from private.memory_public_cards pc
    join public.memory_cards c on c.user_id=pc.user_id and c.id=pc.card_id
    join public.catalog_cover_revisions cr on cr.catalog_cover_revision_id=p_card->'visual'->>'revisionId'
    where pc.user_id=p_user and pc.id=(p_card->>'id')::uuid and not pc.revoked and not pc.hidden
      and c.deleted_at is null and c.status='COMPLETE_PRIVATE' and cr.availability='READY');
$$;

create function public.read_memory_publication(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare p private.memory_publications%rowtype; cards jsonb;
begin
  perform set_config('response.headers','[{"Cache-Control":"no-store"}]',true);
  if not exists(select 1 from private.memory_publication_settings where reads_enabled) then return null; end if;
  select pub.* into p from private.memory_publications pub
    join public.memory_boards b on b.id=pub.board_id and b.user_id=pub.user_id
    where pub.id=p_id and pub.state in ('PUBLISHED','PREPARING') and pub.published_snapshot is not null
      and not pub.hidden and b.deleted_at is null
      and not exists(select 1 from private.memory_publication_accounts a where a.user_id=pub.user_id and a.hidden);
  if not found then return null; end if;
  select coalesce(jsonb_agg(card order by n),'[]'::jsonb) into cards
    from jsonb_array_elements(p.published_snapshot->'cards') with ordinality as rows(card,n)
    where private.memory_public_card_readable(p.user_id,card);
  return (p.published_snapshot - 'cards') || jsonb_build_object('id',p.id,'cards',cards);
end $$;

-- Owner-only recovery after reload; no direct table reads are granted.
create function public.get_memory_publication(p_board_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare u uuid := auth.uid(); p private.memory_publications%rowtype;
begin
  if u is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into p from private.memory_publications where user_id=u and board_id=p_board_id;
  if not found then return null; end if;
  return jsonb_build_object('id',p.id,'revision',p.revision,'state',p.state,'hidden',p.hidden,
    'snapshot',p.preview->'snapshot','reviewHash',p.preview_hash,'policyRevision',p.policy_revision);
end $$;

-- Default EXECUTE is PUBLIC in PostgreSQL; revoke explicitly in this migration.
revoke all on function private.require_publication_writer() from public,anon,authenticated;
revoke all on function private.build_memory_publication(uuid,uuid,jsonb) from public,anon,authenticated;
revoke all on function private.memory_public_card_readable(uuid,jsonb) from public,anon,authenticated;
revoke all on function public.prepare_memory_publication(uuid,bigint,jsonb) from public,anon,authenticated;
revoke all on function public.publish_memory_publication(uuid,bigint,text,text,uuid) from public,anon,authenticated;
revoke all on function public.revoke_memory_publication(uuid,bigint) from public,anon,authenticated;
revoke all on function public.revoke_memory_card_publications(uuid) from public,anon,authenticated;
revoke all on function public.read_memory_publication(uuid) from public,anon,authenticated;
grant execute on function public.prepare_memory_publication(uuid,bigint,jsonb),
  public.publish_memory_publication(uuid,bigint,text,text,uuid),
  public.revoke_memory_publication(uuid,bigint),public.revoke_memory_card_publications(uuid) to authenticated;
grant execute on function public.read_memory_publication(uuid) to anon,authenticated;

revoke all on function public.get_memory_publication(uuid) from public,anon,authenticated;
grant execute on function public.get_memory_publication(uuid) to authenticated;

-- Persist deletion fences: a subsequent stale source restore must not revive an old public snapshot.
create function private.revoke_deleted_memory_publications() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.deleted_at is not null and old.deleted_at is null then
    if tg_table_name='memory_cards' then
      update private.memory_public_cards set revoked=true where user_id=new.user_id and card_id=new.id;
    else
      update private.memory_publications set state='REVOKED',revision=revision+1,published_snapshot=null,
        preview=null,preview_hash=null,selection=null where user_id=new.user_id and board_id=new.id;
    end if;
  end if;
  return new;
end $$;
revoke all on function private.revoke_deleted_memory_publications() from public,anon,authenticated;
create trigger memory_card_publication_delete_fence after update of deleted_at on public.memory_cards
  for each row execute function private.revoke_deleted_memory_publications();
create trigger memory_board_publication_delete_fence after update of deleted_at on public.memory_boards
  for each row execute function private.revoke_deleted_memory_publications();
