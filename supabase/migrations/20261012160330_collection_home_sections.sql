-- Collection/Home v2 candidate. No flags are enabled and no original rows are deleted.
alter table private.memory_publication_settings add column collection_home_enabled boolean not null default false;

-- Prevent pre-v2 writers from silently erasing a newer collection layout.
create function private.guard_collection_layout_writer() returns trigger
language plpgsql set search_path='' as $$
declare item jsonb; seen text[]:='{}'; identity text;
begin
 if new.entity_kind<>'bookshelf' then return new; end if;
 if tg_op='UPDATE' and old.payload ? 'layoutVersion'
  and new.payload->>'layoutVersion' is distinct from old.payload->>'layoutVersion' then
  raise exception 'COLLECTION_CLIENT_UPDATE_REQUIRED';
 end if;
 if new.payload ? 'layoutVersion' then
  if new.payload->>'layoutVersion'<>'1' or (new.payload-array['shelves','sections','layoutVersion'])<>'{}'::jsonb
   or jsonb_typeof(new.payload->'shelves') is distinct from 'array' or jsonb_typeof(new.payload->'sections') is distinct from 'array' then raise exception 'COLLECTION_LAYOUT_INVALID'; end if;
  if jsonb_array_length(new.payload->'shelves')>20 or jsonb_array_length(new.payload->'sections')>40 then raise exception 'COLLECTION_LAYOUT_INVALID'; end if;
  for item in select value from jsonb_array_elements(new.payload->'sections') loop
   if (item-array['kind','sourceId'])<>'{}'::jsonb or item->>'kind' not in ('TITLE_SHELF','MEMORY_BOARD')
    or jsonb_typeof(item->'sourceId') is distinct from 'string' or length(item->>'sourceId') not between 1 and 80 then raise exception 'COLLECTION_LAYOUT_INVALID'; end if;
   identity:=(item->>'kind')||':'||(item->>'sourceId');
   if identity is null or identity=any(seen) then raise exception 'COLLECTION_LAYOUT_INVALID'; end if;
   seen:=array_append(seen,identity);
  end loop;
 end if;
 return new;
end $$;
create trigger collection_layout_writer before insert or update on public.user_title_sync_entities
 for each row execute function private.guard_collection_layout_writer();
revoke all on function private.guard_collection_layout_writer() from public,anon,authenticated,service_role;

create function private.guard_collection_home_writer() returns trigger
language plpgsql set search_path='' as $$
begin
 if coalesce(old.selection->>'schemaVersion',old.published_selection->>'schemaVersion')='2'
  and new.selection is not null and new.selection->>'schemaVersion' is distinct from '2' then
  raise exception 'COLLECTION_CLIENT_UPDATE_REQUIRED';
 end if;
 return new;
end $$;
create trigger collection_home_writer before update on private.memory_minihomes
 for each row execute function private.guard_collection_home_writer();
revoke all on function private.guard_collection_home_writer() from public,anon,authenticated,service_role;

-- Only the current approved catalog identity/cover can supply public title content.
-- Caller can select a reference, but cannot supply title text, cover URL or private tracking.
create function private.collection_title(p_key text) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('titleKey',p_key,'animeId',s.anime_id,'title',s.preferred_title,
   'visual',jsonb_build_object('type','CATALOG_COVER','revisionId',c.catalog_cover_revision_id))
 from public.catalog_active_release a
 join public.catalog_anime_search s on s.release_id=a.release_id
 join public.catalog_cover_revisions c on c.catalog_cover_revision_id=s.cover_asset_id
  and c.catalog_anime_id=s.anime_id and c.availability='READY' and c.rights_basis='EXPLICIT_PERMISSION'
  and c.permission_verified_at is not null and length(c.permission_evidence_ref)>0
 where a.singleton and (s.anime_id=p_key or ('ANILIST:'||s.anilist_id::text)=p_key)
 limit 1
$$;
revoke all on function private.collection_title(text) from public,anon,authenticated,service_role;

create function public.list_memory_minihome_shelves() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare u uuid:=auth.uid(); source public.user_title_sync_entities%rowtype; shelf jsonb; k text; t jsonb;
 titles jsonb; result jsonb:='[]';
begin
 if u is null then raise exception 'AUTH_REQUIRED'; end if;
 perform set_config('response.headers','[{"Cache-Control":"no-store"}]',true);
 if not exists(select 1 from private.memory_publication_settings where collection_home_enabled) then
  return jsonb_build_object('enabled',false,'shelves',result); end if;
 select * into source from public.user_title_sync_entities where user_id=u and entity_kind='bookshelf' and entity_key='default' and deleted_at is null;
 if not found then return jsonb_build_object('enabled',true,'shelves',result); end if;
 for shelf in select value from jsonb_array_elements(source.payload->'shelves') loop
  titles:='[]';
  for k in select value from jsonb_array_elements_text(shelf->'titleKeys') loop
   t:=private.collection_title(k);
   if t is not null then titles:=titles||jsonb_build_array(t); end if;
  end loop;
  result:=result||jsonb_build_array(jsonb_build_object('sourceId',shelf->>'id',
    'sourceVersion',source.version,'name',shelf->>'name','titles',titles,
    'excludedCount',jsonb_array_length(shelf->'titleKeys')-jsonb_array_length(titles)));
 end loop;
 return jsonb_build_object('enabled',true,'shelves',result);
end $$;
revoke all on function public.list_memory_minihome_shelves() from public,anon,authenticated,service_role;
grant execute on function public.list_memory_minihome_shelves() to authenticated;

alter function private.build_memory_minihome(uuid,jsonb,boolean) rename to build_memory_minihome_v1;
create function private.build_memory_minihome(p_user uuid,p_selection jsonb,p_strict boolean) returns jsonb
language plpgsql volatile security definer set search_path='' as $$
declare item jsonb; result jsonb; entries jsonb:='[]'; seen text[]:='{}'; identity text;
 source public.user_title_sync_entities%rowtype; shelf jsonb; candidate jsonb; t jsonb; titles jsonb; key text;
begin
 if not (p_selection ? 'schemaVersion') then return private.build_memory_minihome_v1(p_user,p_selection,p_strict); end if;
 if p_selection->>'schemaVersion' <> '2' or jsonb_typeof(p_selection) is distinct from 'object'
  or octet_length(p_selection::text)>262144 or (p_selection-array['schemaVersion','nickname','bio','entries'])<>'{}'::jsonb
  or jsonb_typeof(p_selection->'nickname') is distinct from 'string' or length(btrim(p_selection->>'nickname')) not between 1 and 60
  or jsonb_typeof(p_selection->'bio') is distinct from 'string' or length(p_selection->>'bio')>500
  or jsonb_typeof(p_selection->'entries') is distinct from 'array' then raise exception 'INVALID_SELECTION'; end if;
 if jsonb_array_length(p_selection->'entries') not between 1 and 10 then raise exception 'INVALID_SELECTION'; end if;
 if not exists(select 1 from private.memory_publication_settings where collection_home_enabled) then
  if p_strict then raise exception 'PUBLICATION_DISABLED'; else return jsonb_build_object('schemaVersion',2,'nickname',p_selection->>'nickname','bio',p_selection->>'bio','entries',entries); end if;
 end if;
 for item in select value from jsonb_array_elements(p_selection->'entries') loop
  if item->>'kind'='MEMORY_BOARD' then
   identity:='board:'||(item->>'publicationId');
   if (item-array['kind','publicationId','cardId'])<>'{}'::jsonb then raise exception 'INVALID_SELECTION'; end if;
   result:=private.build_memory_minihome_v1(p_user,jsonb_build_object('nickname',p_selection->'nickname','bio',p_selection->'bio','entries',jsonb_build_array(item-'kind')),p_strict);
   for candidate in select value from jsonb_array_elements(result->'entries') loop
    entries:=entries||jsonb_build_array(candidate||jsonb_build_object('kind','MEMORY_BOARD'));
   end loop;
  elsif item->>'kind'='TITLE_SHELF' then
   identity:='shelf:'||encode(sha256(convert_to(p_user::text||':'||(item->>'sourceId'),'UTF8')),'hex');
   if (item-array['kind','sourceId','sourceVersion','title','titles'])<>'{}'::jsonb
    or jsonb_typeof(item->'sourceId') is distinct from 'string' or length(item->>'sourceId') not between 1 and 80
    or jsonb_typeof(item->'title') is distinct from 'string' or length(btrim(item->>'title')) not between 1 and 80
    or jsonb_typeof(item->'titles') is distinct from 'array' then raise exception 'INVALID_SELECTION'; end if;
   if jsonb_array_length(item->'titles') not between 1 and 300 then raise exception 'INVALID_SELECTION'; end if;
   if p_strict then
    select * into source from public.user_title_sync_entities where user_id=p_user and entity_kind='bookshelf' and entity_key='default' and deleted_at is null for share;
   else
    select * into source from public.user_title_sync_entities where user_id=p_user and entity_kind='bookshelf' and entity_key='default' and deleted_at is null;
   end if;
   shelf:=null;
   select value into shelf from jsonb_array_elements(source.payload->'shelves') where value->>'id'=item->>'sourceId';
   -- A later private change cannot resurrect or silently refresh a published shelf.
   -- The owner must prepare and confirm the current version again.
   if shelf is null or source.version::text is distinct from item->>'sourceVersion' then
    if p_strict then raise exception 'PREVIEW_CHANGED'; else continue; end if;
   end if;
   titles:='[]';
   for candidate in select value from jsonb_array_elements(item->'titles') loop
    if (candidate-array['titleKey','animeId','revisionId','catalogTitle'])<>'{}'::jsonb then raise exception 'INVALID_SELECTION'; end if;
    key:=candidate->>'titleKey';
    t:=private.collection_title(key);
    if not (shelf->'titleKeys' ? key) or t is null or t->>'animeId' is distinct from candidate->>'animeId'
     or t->'visual'->>'revisionId' is distinct from candidate->>'revisionId' or t->>'title' is distinct from candidate->>'catalogTitle' then
     if p_strict then raise exception 'PUBLIC_VISUAL_NOT_READY'; else continue; end if;
    end if;
    if exists(select 1 from jsonb_array_elements(titles) x where x->>'animeId'=t->>'animeId') then raise exception 'INVALID_SELECTION'; end if;
    titles:=titles||jsonb_build_array(t-'titleKey');
   end loop;
   if jsonb_array_length(titles)>0 then entries:=entries||jsonb_build_array(jsonb_build_object('kind','TITLE_SHELF','sectionId',identity,
     'snapshot',jsonb_build_object('schemaVersion',1,'title',btrim(item->>'title'),'titles',titles))); end if;
  else raise exception 'INVALID_SELECTION'; end if;
  if identity is null or identity=any(seen) then raise exception 'INVALID_SELECTION'; end if;
  seen:=array_append(seen,identity);
 end loop;
 return jsonb_build_object('schemaVersion',2,'nickname',btrim(p_selection->>'nickname'),'bio',p_selection->>'bio','entries',entries);
end $$;
revoke all on function private.build_memory_minihome(uuid,jsonb,boolean),private.build_memory_minihome_v1(uuid,jsonb,boolean) from public,anon,authenticated,service_role;

-- Return the owner's existing board selection for safe editor hydration.
alter function public.get_memory_publication(uuid) rename to get_memory_publication_before_collection;
revoke all on function public.get_memory_publication_before_collection(uuid) from public,anon,authenticated,service_role;
alter function public.get_memory_publication_before_collection(uuid) set schema private;
create function public.get_memory_publication(p_board_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb; selected jsonb; published jsonb; cards jsonb;
begin
 result:=private.get_memory_publication_before_collection(p_board_id);
 if result is null then return null; end if;
 select selection,published_snapshot into selected,published from private.memory_publications where board_id=p_board_id and user_id=auth.uid();
 if selected is null and published is not null then
  -- Older publication rows cleared their draft on publish. Reconstruct only
  -- the explicitly published fields and original card mapping, never current notes.
  select coalesce(jsonb_agg(jsonb_build_object('cardId',pc.card_id,'fields',
    (select coalesce(jsonb_agg(field),'[]'::jsonb) from unnest(array['note','watchedAt','episode','sceneCue','emotionTags','rewatchIntent']) field where c.value ? field)) order by c.ordinality),'[]'::jsonb)
   into cards from jsonb_array_elements(published->'cards') with ordinality c(value,ordinality)
   join private.memory_public_cards pc on pc.id=(c.value->>'id')::uuid and pc.user_id=auth.uid();
  if jsonb_array_length(cards)>0 then selected:=jsonb_build_object('title',published->>'title','description',published->>'description','cards',cards); end if;
 end if;
 return result||jsonb_build_object('selection',selected);
end $$;
revoke all on function public.get_memory_publication(uuid) from public,anon,authenticated,service_role;
grant execute on function public.get_memory_publication(uuid) to authenticated;
