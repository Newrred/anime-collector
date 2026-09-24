alter table private.memory_publication_settings add column minihomes_enabled boolean not null default false;
create table private.memory_minihomes (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null unique references auth.users(id) on delete cascade,
 revision bigint not null default 0,
 hidden boolean not null default false,
 selection jsonb, preview jsonb, review_hash text, policy_revision text,
 published_selection jsonb, published_operation uuid, published_revision bigint, published_hash text
);
alter table private.memory_minihomes enable row level security;
revoke all on private.memory_minihomes from public,anon,authenticated;

create function private.build_memory_minihome(p_user uuid,p_selection jsonb,p_strict boolean) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare item jsonb; snap jsonb; cards jsonb; entries jsonb := '[]'; seen uuid[] := '{}'; pid uuid;
begin
 if jsonb_typeof(p_selection) is distinct from 'object' or octet_length(p_selection::text)>16384
  or (p_selection-array['nickname','bio','entries']) <> '{}'::jsonb
  or jsonb_typeof(p_selection->'nickname') is distinct from 'string' or length(btrim(p_selection->>'nickname')) not between 1 and 60
  or jsonb_typeof(p_selection->'bio') is distinct from 'string' or length(p_selection->>'bio')>500
  or jsonb_typeof(p_selection->'entries') is distinct from 'array' then raise exception 'INVALID_SELECTION'; end if;
 if jsonb_array_length(p_selection->'entries') not between 1 and 10 then raise exception 'INVALID_SELECTION'; end if;
 for item in select value from jsonb_array_elements(p_selection->'entries') loop
  if jsonb_typeof(item) is distinct from 'object' or (item-array['publicationId','cardId']) <> '{}'::jsonb
   or jsonb_typeof(item->'publicationId') is distinct from 'string' then raise exception 'INVALID_SELECTION'; end if;
  pid := (item->>'publicationId')::uuid;
  if pid=any(seen) then raise exception 'INVALID_SELECTION'; end if;
  seen := array_append(seen,pid);
  if not exists(select 1 from private.memory_publications where id=pid and user_id=p_user) then
   if p_strict then raise exception 'NOT_FOUND'; else continue; end if;
  end if;
  snap := public.read_memory_publication(pid);
  if item ? 'cardId' then
   if jsonb_typeof(item->'cardId') is distinct from 'string' then raise exception 'INVALID_SELECTION'; end if;
   select coalesce(jsonb_agg(c),'[]'::jsonb) into cards from jsonb_array_elements(snap->'cards') c where c->>'id'=item->>'cardId';
   snap := jsonb_set(snap,'{cards}',cards);
  end if;
  if snap is null or jsonb_array_length(snap->'cards')=0 then
   if p_strict then raise exception 'PUBLICATION_RESTRICTED'; else continue; end if;
  end if;
  entries := entries || jsonb_build_array(jsonb_build_object('publicationId',pid,'snapshot',snap-'id'));
 end loop;
 return jsonb_build_object('nickname',btrim(p_selection->>'nickname'),'bio',p_selection->>'bio','entries',entries);
end $$;
revoke all on function private.build_memory_minihome(uuid,jsonb,boolean) from public,anon,authenticated;

create function public.get_memory_minihome() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare u uuid := auth.uid(); h private.memory_minihomes%rowtype;
begin
 if u is null then raise exception 'AUTH_REQUIRED'; end if;
 perform set_config('response.headers','[{"Cache-Control":"no-store"}]',true);
 select * into h from private.memory_minihomes where user_id=u;
 if not found then return null; end if;
 return jsonb_build_object('id',h.id,'revision',h.revision,'published',h.published_selection is not null,'hidden',h.hidden,
  'selection',coalesce(h.selection,h.published_selection));
end $$;

create function public.list_memory_minihome_boards(p_after uuid default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare u uuid := auth.uid(); p record; snap jsonb; rows jsonb := '[]'; cursor_id uuid; scanned int:=0;
begin
 if u is null then raise exception 'AUTH_REQUIRED'; end if;
 perform set_config('response.headers','[{"Cache-Control":"no-store"}]',true);
 for p in select id from private.memory_publications where user_id=u and (p_after is null or id>p_after) order by id limit 21 loop
  scanned:=scanned+1;
  if scanned=21 then return jsonb_build_object('boards',rows,'next',cursor_id); end if;
  cursor_id:=p.id; snap:=public.read_memory_publication(p.id);
  if snap is not null and jsonb_array_length(snap->'cards')>0 then rows:=rows||jsonb_build_array(snap); end if;
 end loop;
 return jsonb_build_object('boards',rows,'next',null);
end $$;

create function public.prepare_memory_minihome(p_expected_revision bigint,p_selection jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_publication_writer(); h private.memory_minihomes%rowtype; snap jsonb; policy text; hash text;
begin
 if not exists(select 1 from private.memory_publication_settings where minihomes_enabled) then raise exception 'PUBLICATION_DISABLED'; end if;
 insert into private.memory_minihomes(user_id) values(u) on conflict(user_id) do nothing;
 select * into h from private.memory_minihomes where user_id=u for update;
 if h.hidden then raise exception 'PUBLICATION_RESTRICTED'; end if;
 if h.revision is distinct from p_expected_revision then raise exception 'PUBLICATION_CONFLICT'; end if;
 snap:=private.build_memory_minihome(u,p_selection,true);
 select policy_revision into policy from private.memory_publication_settings where singleton;
 hash:=encode(sha256(convert_to(jsonb_build_object('snapshot',snap,'selection',p_selection,'policy',policy,'revision',h.revision+1)::text,'UTF8')),'hex');
 update private.memory_minihomes set revision=revision+1,selection=p_selection,preview=snap,review_hash=hash,policy_revision=policy where id=h.id;
 return jsonb_build_object('id',h.id,'revision',h.revision+1,'reviewHash',hash,'policyRevision',policy,'snapshot',snap);
end $$;

create function public.publish_memory_minihome(p_expected_revision bigint,p_review_hash text,p_policy_revision text,p_operation_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_publication_writer(); h private.memory_minihomes%rowtype;
begin
 if not exists(select 1 from private.memory_publication_settings where minihomes_enabled) then raise exception 'PUBLICATION_DISABLED'; end if;
 if p_operation_id is null then raise exception 'INVALID_OPERATION'; end if;
 select * into h from private.memory_minihomes where user_id=u for update;
 if not found then raise exception 'NOT_FOUND'; end if;
 if h.hidden then raise exception 'PUBLICATION_RESTRICTED'; end if;
 if h.published_operation=p_operation_id then
  if h.published_hash is distinct from p_review_hash or h.published_revision is distinct from p_expected_revision
    or h.policy_revision is distinct from p_policy_revision then raise exception 'OPERATION_MISMATCH'; end if;
  return jsonb_build_object('id',h.id,'revision',h.revision,'published',h.published_selection is not null);
 end if;
 if h.revision is distinct from p_expected_revision or h.preview is null then raise exception 'PUBLICATION_CONFLICT'; end if;
 if h.review_hash is distinct from p_review_hash or h.policy_revision is distinct from p_policy_revision
  or not exists(select 1 from private.memory_publication_settings where policy_revision=p_policy_revision) then raise exception 'CONSENT_MISMATCH'; end if;
 if private.build_memory_minihome(u,h.selection,true) is distinct from h.preview then raise exception 'PREVIEW_CHANGED'; end if;
 update private.memory_minihomes set revision=revision+1,published_selection=selection,published_operation=p_operation_id,
  published_revision=p_expected_revision,published_hash=p_review_hash,preview=null,review_hash=null where id=h.id;
 return jsonb_build_object('id',h.id,'revision',h.revision+1,'published',true);
end $$;

create function public.revoke_memory_minihome(p_expected_revision bigint) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); h private.memory_minihomes%rowtype;
begin
 if u is null then raise exception 'AUTH_REQUIRED'; end if;
 select * into h from private.memory_minihomes where user_id=u for update;
 if not found then raise exception 'NOT_FOUND'; end if;
 if h.revision is distinct from p_expected_revision then raise exception 'PUBLICATION_CONFLICT'; end if;
 update private.memory_minihomes set revision=revision+1,published_selection=null,selection=null,preview=null,review_hash=null where id=h.id;
 return jsonb_build_object('id',h.id,'revision',h.revision+1,'published',false);
end $$;

create function public.read_memory_minihome(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare h private.memory_minihomes%rowtype;
begin
 perform set_config('response.headers','[{"Cache-Control":"no-store"}]',true);
 if not exists(select 1 from private.memory_publication_settings where reads_enabled and minihomes_enabled) then return null; end if;
 select * into h from private.memory_minihomes where id=p_id and not hidden and published_selection is not null
  and not exists(select 1 from private.memory_publication_accounts a where a.user_id=memory_minihomes.user_id and a.hidden);
 if not found then return null; end if;
 return private.build_memory_minihome(h.user_id,h.published_selection,false)||jsonb_build_object('id',h.id);
end $$;
revoke all on function public.get_memory_minihome(),public.list_memory_minihome_boards(uuid),public.prepare_memory_minihome(bigint,jsonb),
 public.publish_memory_minihome(bigint,text,text,uuid),public.revoke_memory_minihome(bigint),public.read_memory_minihome(uuid) from public,anon,authenticated;
grant execute on function public.get_memory_minihome(),public.list_memory_minihome_boards(uuid),public.prepare_memory_minihome(bigint,jsonb),
 public.publish_memory_minihome(bigint,text,text,uuid),public.revoke_memory_minihome(bigint) to authenticated;
grant execute on function public.read_memory_minihome(uuid) to anon,authenticated;
