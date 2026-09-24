-- C07: owner-only relationships, never a grant on private memories.
alter table private.memory_publication_settings add column follows_enabled boolean not null default false;
create table private.memory_relationships (
  owner_id uuid not null references auth.users(id) on delete cascade,
  target_id uuid not null references auth.users(id) on delete cascade,
  following boolean not null default false,
  blocked boolean not null default false,
  primary key(owner_id,target_id), check(owner_id <> target_id), check(not (following and blocked))
);
alter table private.memory_relationships enable row level security;
revoke all on private.memory_relationships from public,anon,authenticated;

create function public.get_memory_relationship(p_home_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid(); t uuid; r private.memory_relationships;
begin
  if u is null then raise exception 'AUTH_REQUIRED'; end if;
  perform set_config('response.headers','[{"Cache-Control":"no-store"}]',true);
  select user_id into t from private.memory_minihomes where id=p_home_id;
  select * into r from private.memory_relationships where owner_id=u and target_id=t;
  return jsonb_build_object('self',coalesce(u=t,false),'following',coalesce(r.following,false),'blocked',coalesce(r.blocked,false));
end $$;

create function public.set_memory_relationship(p_home_id uuid,p_action text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid(); t uuid;
begin
  if u is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_action is null or p_action not in ('follow','unfollow','block','unblock') then raise exception 'INVALID_OPERATION'; end if;
  select user_id into t from private.memory_minihomes where id=p_home_id;
  if t is null then raise exception 'NOT_FOUND'; end if;
  if u=t then raise exception 'INVALID_OPERATION'; end if;
  -- Sorted pair lock also covers absent rows and opposing follow/block requests.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(least(u,t)::text||greatest(u,t)::text,0));
  if p_action='follow' then
    perform private.require_publication_writer();
    if not exists(select 1 from private.memory_publication_settings where follows_enabled) then raise exception 'PUBLICATION_DISABLED'; end if;
    if public.read_memory_minihome(p_home_id) is null or exists(
      select 1 from private.memory_relationships where blocked and
      ((owner_id=u and target_id=t) or (owner_id=t and target_id=u))
    ) then raise exception 'PUBLICATION_RESTRICTED'; end if;
    insert into private.memory_relationships(owner_id,target_id,following) values(u,t,true)
      on conflict(owner_id,target_id) do update set following=true;
  elsif p_action='block' then
    insert into private.memory_relationships(owner_id,target_id,blocked) values(u,t,true)
      on conflict(owner_id,target_id) do update set following=false,blocked=true;
    update private.memory_relationships set following=false where owner_id=t and target_id=u;
  elsif p_action='unfollow' then
    update private.memory_relationships set following=false where owner_id=u and target_id=t;
  else
    update private.memory_relationships set blocked=false where owner_id=u and target_id=t;
  end if;
  return public.get_memory_relationship(p_home_id);
end $$;

create function public.list_memory_relationships(p_blocked boolean default false,p_after uuid default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid(); result jsonb := '[]'; row record; page_count integer := 0; cursor_id uuid; snapshot jsonb;
begin
  if u is null then raise exception 'AUTH_REQUIRED'; end if;
  perform set_config('response.headers','[{"Cache-Control":"no-store"}]',true);
  for row in select h.id,r.blocked from private.memory_relationships r join private.memory_minihomes h on h.user_id=r.target_id
    where r.owner_id=u and (case when p_blocked then r.blocked else r.following and not r.blocked end)
      and (p_after is null or h.id>p_after)
      and (p_blocked or not exists(select 1 from private.memory_relationships reverse where reverse.owner_id=r.target_id and reverse.target_id=u and reverse.blocked))
    order by h.id limit 21
  loop
    page_count:=page_count+1;
    if page_count=21 then return jsonb_build_object('items',result,'next',cursor_id); end if;
    snapshot:=public.read_memory_minihome(row.id);
    result:=result||jsonb_build_array(jsonb_build_object('id',row.id,'nickname',snapshot->>'nickname','available',snapshot is not null,'blocked',row.blocked));
    cursor_id:=row.id;
  end loop;
  return jsonb_build_object('items',result,'next',null);
end $$;
revoke all on function public.get_memory_relationship(uuid),public.set_memory_relationship(uuid,text),public.list_memory_relationships(boolean,uuid) from public,anon;
grant execute on function public.get_memory_relationship(uuid),public.set_memory_relationship(uuid,text),public.list_memory_relationships(boolean,uuid) to authenticated;
