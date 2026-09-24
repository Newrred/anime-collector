-- Additive owner-only status; anonymous DTO and all existing fences remain unchanged.
alter table private.memory_publications add column published_sources jsonb;

create function private.capture_memory_publication_sources() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.state='PUBLISHED' and old.state='PREPARING' and new.published_operation is distinct from old.published_operation then
    new.published_sources := old.preview - 'snapshot';
  elsif new.published_snapshot is null then
    new.published_sources := null;
  end if;
  return new;
end $$;
revoke all on function private.capture_memory_publication_sources() from public,anon,authenticated;
create trigger capture_memory_publication_sources before update on private.memory_publications
for each row execute function private.capture_memory_publication_sources();

create or replace function public.get_memory_publication(p_board_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare u uuid := auth.uid(); p private.memory_publications%rowtype; changed boolean;
begin
  if u is null then raise exception 'AUTH_REQUIRED'; end if;
  perform set_config('response.headers','[{"Cache-Control":"no-store"}]',true);
  select * into p from private.memory_publications where user_id=u and board_id=p_board_id;
  if not found then return null; end if;
  changed := p.published_sources is null or not exists(select 1 from public.memory_boards
    where user_id=u and id=p_board_id and deleted_at is null and version=(p.published_sources->>'boardVersion')::bigint)
    or exists(select 1 from jsonb_array_elements(p.published_sources->'sources') s
      where not exists(select 1 from public.memory_cards c
        join public.memory_visual_assets a on a.user_id=c.user_id and a.card_id=c.id
        join public.memory_board_cards m on m.user_id=c.user_id and m.card_id=c.id and m.board_id=p_board_id
        join private.memory_public_cards pc on pc.user_id=c.user_id and pc.card_id=c.id
        where c.user_id=u and c.id=(s->>'cardId')::uuid and c.deleted_at is null and c.status='COMPLETE_PRIVATE'
          and c.version=(s->>'version')::bigint and a.id=(s->>'assetId')::uuid and a.version=(s->>'assetVersion')::bigint
          and a.deleted_at is null and a.is_current and a.state='READY'
          and m.deleted_at is null and m.version=(s->>'membershipVersion')::bigint and not pc.revoked and not pc.hidden));
  return jsonb_build_object('id',p.id,'revision',p.revision,'state',p.state,'hidden',p.hidden,
    'hasPublished',p.published_snapshot is not null,'sourceChanged',changed,
    'snapshot',p.preview->'snapshot','reviewHash',p.preview_hash,'policyRevision',p.policy_revision);
end $$;
revoke all on function public.get_memory_publication(uuid) from public,anon,authenticated;
grant execute on function public.get_memory_publication(uuid) to authenticated;

-- A replay after card-wide withdrawal/deletion must not report a successful live publication.
create or replace function public.publish_memory_publication(p_id uuid,p_expected_revision bigint,p_review_hash text,p_policy_revision text,p_operation_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare u uuid := private.require_publication_writer(); p private.memory_publications%rowtype; draft jsonb;
begin
  if p_operation_id is null then raise exception 'INVALID_OPERATION'; end if;
  select * into p from private.memory_publications where id=p_id and user_id=u for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if p.hidden then raise exception 'PUBLICATION_RESTRICTED'; end if;
  if p.published_operation=p_operation_id then
    if p.published_hash is distinct from p_review_hash or p.published_revision is distinct from p_expected_revision or p.policy_revision is distinct from p_policy_revision then raise exception 'OPERATION_MISMATCH'; end if;
    if p.state='PUBLISHED' and exists(select 1 from jsonb_array_elements(p.published_snapshot->'cards') c
      where not private.memory_public_card_readable(u,c)) then raise exception 'PUBLICATION_RESTRICTED'; end if;
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
revoke all on function public.publish_memory_publication(uuid,bigint,text,text,uuid) from public,anon,authenticated;
grant execute on function public.publish_memory_publication(uuid,bigint,text,text,uuid) to authenticated;

-- A lost sync acknowledgement must not allow a source to appear after its local deletion.
-- No card FK: this fence also covers delayed inserts and is never cleared by source restore.
create table private.memory_publication_delete_fences (
  user_id uuid not null references auth.users(id) on delete cascade,
  card_id uuid not null,
  primary key(user_id,card_id)
);
alter table private.memory_publication_delete_fences enable row level security;
revoke all on private.memory_publication_delete_fences from public,anon,authenticated;

create function public.retire_memory_card_publications(p_card_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare u uuid := auth.uid();
begin
  if u is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_card_id is null then raise exception 'INVALID_SELECTION'; end if;
  -- Owner namespace only; never reveal whether this ID belongs to someone else.
  insert into private.memory_publication_delete_fences(user_id,card_id) values(u,p_card_id) on conflict do nothing;
  if exists(select 1 from public.memory_cards where user_id=u and id=p_card_id) then
    perform public.revoke_memory_card_publications(p_card_id);
  end if;
end $$;
revoke all on function public.retire_memory_card_publications(uuid) from public,anon,authenticated;
grant execute on function public.retire_memory_card_publications(uuid) to authenticated;

alter function private.build_memory_publication(uuid,uuid,jsonb) rename to build_memory_publication_visuals_v1;
create function private.build_memory_publication(p_user uuid,p_board uuid,p_selection jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
  if jsonb_typeof(p_selection->'cards') is distinct from 'array' then raise exception 'INVALID_SELECTION'; end if;
  if exists(select 1 from jsonb_array_elements(p_selection->'cards') s
    join private.memory_publication_delete_fences f on f.user_id=p_user and f.card_id=(s->>'cardId')::uuid) then
    raise exception 'PUBLICATION_RESTRICTED';
  end if;
  return private.build_memory_publication_visuals_v1(p_user,p_board,p_selection);
end $$;
revoke all on function private.build_memory_publication(uuid,uuid,jsonb) from public,anon,authenticated;

alter function private.memory_public_card_readable(uuid,jsonb) rename to memory_public_card_visual_readable_v1;
create function private.memory_public_card_readable(p_user uuid,p_card jsonb) returns boolean
language sql stable security definer set search_path='' as $$
  select private.memory_public_card_visual_readable_v1(p_user,p_card) and not exists(
    select 1 from private.memory_publication_delete_fences f join private.memory_public_cards c
      on c.user_id=f.user_id and c.card_id=f.card_id
    where f.user_id=p_user and c.id=(p_card->>'id')::uuid);
$$;
revoke all on function private.memory_public_card_readable(uuid,jsonb) from public,anon,authenticated;
