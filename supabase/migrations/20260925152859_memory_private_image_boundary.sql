-- Additive private optimized representations. No change to original source checksum/local-only model.
create table private.memory_private_media_policy (
 id boolean primary key default true check(id), revision text not null default 'UNAPPROVED',
 approved boolean not null default false, enabled boolean not null default false, paused boolean not null default false,
 observed_at timestamptz, quota_bytes bigint not null default 0 check(quota_bytes>=0),
 physical_bytes bigint not null default 0 check(physical_bytes>=0),
 main_bytes integer not null default 1000000 check(main_bytes between 1 and 1000000),
 thumb_bytes integer not null default 120000 check(thumb_bytes between 1 and 120000),
 preparations_per_day integer not null default 0 check(preparations_per_day>=0),
 decode_attempts_per_day integer not null default 0 check(decode_attempts_per_day>=0),
 asset_count_max integer not null default 0 check(asset_count_max>=0),
 upload_max_in_flight integer not null default 1 check(upload_max_in_flight between 1 and 10),
 read_bytes_per_month bigint not null default 0 check(read_bytes_per_month>=0),
 global_read_bytes_per_month bigint not null default 0 check(global_read_bytes_per_month>=0)
);
insert into private.memory_private_media_policy(id) values(true);
create table private.memory_private_media (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null, asset_id uuid not null,
 source_version bigint not null check(source_version>0), operation_id uuid not null,
 policy_revision text not null, pipeline text not null check(pipeline='private-webp-v1'),
 input_hash text not null check(input_hash ~ '^[0-9a-f]{64}$'),
 main_hash text not null check(main_hash ~ '^[0-9a-f]{64}$'), thumb_hash text not null check(thumb_hash ~ '^[0-9a-f]{64}$'),
 main_bytes integer not null check(main_bytes between 1 and 1000000), thumb_bytes integer not null check(thumb_bytes between 1 and 120000),
 width integer not null check(width between 1 and 1600), height integer not null check(height between 1 and 1600),
 state text not null default 'PREPARING' check(state in ('PREPARING','READY','DELETING','DELETED')),
 created_at timestamptz not null default now(), expires_at timestamptz not null default (now()+interval '30 minutes'),
 write_until timestamptz not null default (now()+interval '30 seconds'), cleanup_after timestamptz,
 unique(owner_id,operation_id)
);
create unique index memory_private_media_one_active on private.memory_private_media(owner_id,asset_id,source_version) where state in ('PREPARING','READY');
create index memory_private_media_cleanup on private.memory_private_media(state,cleanup_after);
-- Cancellation can arrive before the upload obtains its reservation. Keep the operation fenced.
create table private.memory_private_media_cancelled (
 owner_id uuid not null references auth.users(id) on delete cascade, operation_id uuid not null,
 primary key(owner_id,operation_id)
);
create table private.memory_private_media_meter (
 owner_id uuid primary key, day date not null, preparations bigint not null default 0 check(preparations>=0),
 decode_attempts bigint not null default 0 check(decode_attempts>=0),
 month date not null, read_bytes bigint not null default 0 check(read_bytes>=0)
);
alter table private.memory_private_media_policy enable row level security;
alter table private.memory_private_media enable row level security;
alter table private.memory_private_media_meter enable row level security;
alter table private.memory_private_media_cancelled enable row level security;
revoke all on private.memory_private_media_cancelled from public,anon,authenticated;
revoke all on private.memory_private_media_policy,private.memory_private_media,private.memory_private_media_meter from public,anon,authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('memory-private-representations','memory-private-representations',false,1000000,array['image/webp']);
-- Existing permissive policies must not accidentally allow a direct Storage bypass.
create policy memory_private_media_no_direct_access on storage.objects as restrictive for all to anon,authenticated
 using(bucket_id<>'memory-private-representations') with check(bucket_id<>'memory-private-representations');

create function private.lock_private_media() returns void language sql set search_path='' as $$
 select pg_catalog.pg_advisory_xact_lock(78342916::bigint)
$$;
create function private.private_media_source(p_owner uuid,p_asset uuid,p_version bigint) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.memory_visual_assets a join public.memory_cards c on c.id=a.card_id and c.user_id=a.user_id
 join auth.users u on u.id=a.user_id where a.id=p_asset and a.user_id=p_owner and a.version=p_version
 and a.asset_type='USER_IMAGE' and a.state='READY' and a.is_current and a.deleted_at is null and c.deleted_at is null
 and not exists(select 1 from private.memory_publication_delete_fences f where f.user_id=p_owner and f.card_id=c.id))
$$;
create function private.private_media_policy() returns private.memory_private_media_policy language plpgsql security definer set search_path='' as $$
declare p private.memory_private_media_policy;
begin
 select * into strict p from private.memory_private_media_policy where id;
 if not p.enabled or not p.approved then raise exception 'PRIVATE_IMAGE_DISABLED'; end if;
 if p.paused then raise exception 'PRIVATE_IMAGE_PAUSED'; end if;
 if p.observed_at is null or p.observed_at<now()-interval '24 hours' or p.observed_at>now()+interval '5 minutes' then raise exception 'PRIVATE_IMAGE_POLICY_STALE'; end if;
 return p;
end $$;
create function public.get_memory_private_image_policy(p_asset uuid,p_version bigint) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); p private.memory_private_media_policy;
begin
 if actor is null then raise exception 'AUTH_REQUIRED'; end if;
 if not private.private_media_source(actor,p_asset,p_version) then raise exception 'NOT_FOUND'; end if;
 p:=private.private_media_policy();
 return jsonb_build_object('revision',p.revision,'mainMaxBytes',p.main_bytes,'thumbnailMaxBytes',p.thumb_bytes,
 'quotaBytes',p.quota_bytes,'transportBodyMaxBytes',1500000,'targetLongEdgePx',1600,'thumbnailLongEdgePx',400,
 'pipeline','private-webp-v1','usedBytes',(select coalesce(sum(main_bytes+thumb_bytes),0) from private.memory_private_media where owner_id=actor and state<>'DELETED'),
 'representation',(select jsonb_build_object('id',r.id,'state',r.state,'sourceVersion',r.source_version,'mainHash',r.main_hash,
   'mainBytes',r.main_bytes,'thumbnailHash',r.thumb_hash,'thumbnailBytes',r.thumb_bytes,'width',r.width,'height',r.height,'pipeline',r.pipeline)
   from private.memory_private_media r where r.owner_id=actor and r.asset_id=p_asset and r.source_version=p_version and r.state='READY'),
 'preparing',exists(select 1 from private.memory_private_media r where r.owner_id=actor and r.asset_id=p_asset and r.source_version=p_version and r.state='PREPARING'));
end $$;

create function public.authorize_memory_private_image_attempt(p_asset uuid,p_version bigint,p_policy text) returns void
 language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); p private.memory_private_media_policy;
 day_value date:=(now() at time zone 'UTC')::date; month_value date:=date_trunc('month',now() at time zone 'UTC')::date;
begin
 if actor is null then raise exception 'AUTH_REQUIRED'; end if;
 perform private.lock_private_media();
 if not private.private_media_source(actor,p_asset,p_version) then raise exception 'NOT_FOUND'; end if;
 p:=private.private_media_policy();
 if p_policy is distinct from p.revision then raise exception 'PRIVATE_IMAGE_POLICY_STALE'; end if;
 insert into private.memory_private_media_meter(owner_id,day,month) values(actor,day_value,month_value) on conflict do nothing;
 update private.memory_private_media_meter set day=day_value,
  preparations=case when day=day_value then preparations else 0 end,
  decode_attempts=(case when day=day_value then decode_attempts else 0 end)+1
 where owner_id=actor and (case when day=day_value then decode_attempts else 0 end)<p.decode_attempts_per_day;
 if not found then raise exception 'PRIVATE_IMAGE_RATE_LIMITED'; end if;
end $$;

-- Reservation takes server-measured representations, so only the trusted HTTP service may call it.
create function public.reserve_memory_private_image(p_owner uuid,p_asset uuid,p_version bigint,p_operation uuid,p_policy text,
 p_input_hash text,p_main_hash text,p_thumb_hash text,p_main_bytes integer,p_thumb_bytes integer,p_width integer,p_height integer)
 returns jsonb language plpgsql security definer set search_path='' as $$
declare p private.memory_private_media_policy; r private.memory_private_media; used bigint; physical bigint;
 day_value date:=(now() at time zone 'UTC')::date; month_value date:=date_trunc('month',now() at time zone 'UTC')::date;
begin
 perform private.lock_private_media();
 if not private.private_media_source(p_owner,p_asset,p_version) then raise exception 'NOT_FOUND'; end if;
 p:=private.private_media_policy();
 if p_policy is distinct from p.revision then raise exception 'PRIVATE_IMAGE_POLICY_STALE'; end if;
 select * into r from private.memory_private_media where owner_id=p_owner and operation_id=p_operation;
 if found then
  if r.asset_id<>p_asset or r.source_version<>p_version or r.input_hash is distinct from p_input_hash
   or r.main_hash is distinct from p_main_hash or r.thumb_hash is distinct from p_thumb_hash
   or r.main_bytes is distinct from p_main_bytes or r.thumb_bytes is distinct from p_thumb_bytes
   or r.width is distinct from p_width or r.height is distinct from p_height then raise exception 'OPERATION_MISMATCH'; end if;
  if r.state not in ('PREPARING','READY') or (r.state='PREPARING' and r.expires_at<=now()) then raise exception 'PRIVATE_IMAGE_RETIRED'; end if;
  if r.state='PREPARING' then update private.memory_private_media set write_until=now()+interval '30 seconds' where id=r.id; end if;
  return to_jsonb(r);
 end if;
 if exists(select 1 from private.memory_private_media_cancelled where owner_id=p_owner and operation_id=p_operation) then raise exception 'PRIVATE_IMAGE_RETIRED'; end if;
 if p_main_bytes is null or p_thumb_bytes is null or p_main_bytes not between 1 and p.main_bytes or p_thumb_bytes not between 1 and p.thumb_bytes then raise exception 'IMAGE_SIZE_LIMIT'; end if;
 if exists(select 1 from private.memory_private_media where owner_id=p_owner and asset_id=p_asset and source_version=p_version and state in ('PREPARING','READY')) then raise exception 'PRIVATE_IMAGE_CONFLICT'; end if;
 select coalesce(sum(main_bytes+thumb_bytes),0) into used from private.memory_private_media where owner_id=p_owner and state<>'DELETED';
 select coalesce(sum(main_bytes+thumb_bytes),0) into physical from private.memory_private_media where state<>'DELETED';
 if used+p_main_bytes+p_thumb_bytes>p.quota_bytes then raise exception 'PRIVATE_IMAGE_QUOTA_EXCEEDED'; end if;
 if physical+p_main_bytes+p_thumb_bytes>p.physical_bytes then raise exception 'PRIVATE_IMAGE_CAPACITY_EXCEEDED'; end if;
 if (select count(*) from private.memory_private_media where owner_id=p_owner and state<>'DELETED')>=p.asset_count_max then raise exception 'PRIVATE_IMAGE_QUOTA_EXCEEDED'; end if;
 if (select count(*) from private.memory_private_media where owner_id=p_owner and state='PREPARING')>=p.upload_max_in_flight then raise exception 'PRIVATE_IMAGE_RATE_LIMITED'; end if;
 insert into private.memory_private_media_meter(owner_id,day,month) values(p_owner,day_value,month_value) on conflict do nothing;
 update private.memory_private_media_meter set day=day_value,decode_attempts=case when day=day_value then decode_attempts else 0 end,
  preparations=(case when day=day_value then preparations else 0 end)+1
 where owner_id=p_owner and (case when day=day_value then preparations else 0 end)<p.preparations_per_day;
 if not found then raise exception 'PRIVATE_IMAGE_RATE_LIMITED'; end if;
 insert into private.memory_private_media(owner_id,asset_id,source_version,operation_id,policy_revision,pipeline,input_hash,main_hash,thumb_hash,main_bytes,thumb_bytes,width,height)
 values(p_owner,p_asset,p_version,p_operation,p_policy,'private-webp-v1',p_input_hash,p_main_hash,p_thumb_hash,p_main_bytes,p_thumb_bytes,p_width,p_height) returning * into r;
 return to_jsonb(r);
end $$;

create function public.complete_memory_private_image(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare r private.memory_private_media; p private.memory_private_media_policy;
begin
 perform private.lock_private_media();
 select * into r from private.memory_private_media where id=p_id;
 if not found then raise exception 'NOT_FOUND'; end if;
 p:=private.private_media_policy();
 if r.policy_revision<>p.revision then raise exception 'PRIVATE_IMAGE_POLICY_STALE'; end if;
 if not private.private_media_source(r.owner_id,r.asset_id,r.source_version) then raise exception 'NOT_FOUND'; end if;
 if r.state='READY' then return; end if;
 if r.state<>'PREPARING' or r.expires_at<=now() then raise exception 'PRIVATE_IMAGE_RETIRED'; end if;
 update private.memory_private_media set state='READY' where id=p_id;
end $$;

create function public.read_memory_private_image(p_asset uuid,p_version bigint,p_variant text,p_charge boolean default true) returns jsonb
 language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); p private.memory_private_media_policy; r private.memory_private_media; cost bigint;
 day_value date:=(now() at time zone 'UTC')::date; month_value date:=date_trunc('month',now() at time zone 'UTC')::date;
 global_actor uuid:='00000000-0000-0000-0000-000000000000';
begin
 if actor is null then raise exception 'AUTH_REQUIRED'; end if;
 if p_variant not in ('main','thumb') or p_variant is null then raise exception 'INVALID_REQUEST'; end if;
 perform private.lock_private_media();
 if not private.private_media_source(actor,p_asset,p_version) then raise exception 'NOT_FOUND'; end if;
 p:=private.private_media_policy();
 select * into r from private.memory_private_media where owner_id=actor and asset_id=p_asset and source_version=p_version and state='READY';
 if not found then raise exception 'NOT_FOUND'; end if;
 cost:=case when p_variant='main' then r.main_bytes else r.thumb_bytes end;
 if p_charge then
  insert into private.memory_private_media_meter(owner_id,day,month) values(actor,day_value,month_value),(global_actor,day_value,month_value) on conflict do nothing;
  update private.memory_private_media_meter set month=month_value,read_bytes=(case when month=month_value then read_bytes else 0 end)+cost
   where owner_id=actor and (case when month=month_value then read_bytes else 0 end)+cost<=p.read_bytes_per_month;
  if not found then raise exception 'PRIVATE_IMAGE_RATE_LIMITED'; end if;
  update private.memory_private_media_meter set month=month_value,read_bytes=(case when month=month_value then read_bytes else 0 end)+cost
   where owner_id=global_actor and (case when month=month_value then read_bytes else 0 end)+cost<=p.global_read_bytes_per_month;
  if not found then raise exception 'PRIVATE_IMAGE_CAPACITY_EXCEEDED'; end if;
 end if;
 return jsonb_build_object('id',r.id,'hash',case when p_variant='main' then r.main_hash else r.thumb_hash end,'bytes',cost,'mime','image/webp');
end $$;

create function public.cancel_memory_private_image(p_operation uuid) returns void language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();
begin
 if actor is null then raise exception 'AUTH_REQUIRED'; end if;
 perform private.lock_private_media();
 update private.memory_private_media set state='DELETING',cleanup_after=greatest(now(),write_until)+interval '60 seconds'
 where owner_id=actor and operation_id=p_operation and state in ('PREPARING','READY');
 if not exists(select 1 from private.memory_private_media where owner_id=actor and operation_id=p_operation)
  and not exists(select 1 from private.memory_private_media_cancelled where owner_id=actor and operation_id=p_operation) then
  -- Bound unreserved-operation fences; known reservations can always be cancelled, even at this cap.
  if (select count(*) from private.memory_private_media_cancelled where owner_id=actor)>=1000 then raise exception 'PRIVATE_IMAGE_RATE_LIMITED'; end if;
  insert into private.memory_private_media_cancelled(owner_id,operation_id) values(actor,p_operation);
 end if;
end $$;
create function private.retire_private_media_source() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_table_schema='auth' then
  perform private.lock_private_media();
  update private.memory_private_media set state='DELETING',cleanup_after=greatest(now(),write_until)+interval '60 seconds' where owner_id=old.id and state in ('PREPARING','READY');
 elsif tg_table_name='memory_publication_delete_fences' then
  perform private.lock_private_media();
  update private.memory_private_media m set state='DELETING',cleanup_after=greatest(now(),write_until)+interval '60 seconds'
   where m.owner_id=new.user_id and m.state in ('PREPARING','READY') and m.asset_id in(select id from public.memory_visual_assets where card_id=new.card_id and user_id=new.user_id);
 elsif tg_table_name='memory_cards' then
  if tg_op='DELETE' or new.deleted_at is not null then
   perform private.lock_private_media();
   update private.memory_private_media m set state='DELETING',cleanup_after=greatest(now(),write_until)+interval '60 seconds'
    where state in ('PREPARING','READY') and asset_id in(select id from public.memory_visual_assets where card_id=old.id);
  end if;
 else
  if tg_op='DELETE' or new.deleted_at is not null or not new.is_current or new.state<>'READY' or new.version<>old.version then
   perform private.lock_private_media();
   update private.memory_private_media set state='DELETING',cleanup_after=greatest(now(),write_until)+interval '60 seconds' where asset_id=old.id and state in ('PREPARING','READY');
  end if;
 end if;
 if tg_op='DELETE' then return old; else return new; end if;
end $$;
create trigger memory_private_media_asset_retire before update or delete on public.memory_visual_assets for each row execute function private.retire_private_media_source();
create trigger memory_private_media_card_retire before update or delete on public.memory_cards for each row execute function private.retire_private_media_source();
create trigger memory_private_media_account_retire before delete on auth.users for each row execute function private.retire_private_media_source();
create trigger memory_private_media_local_delete_fence after insert on private.memory_publication_delete_fences for each row execute function private.retire_private_media_source();

create function private.serialize_private_media_policy() returns trigger language plpgsql set search_path='' as $$
begin perform private.lock_private_media(); return new; end $$;
create trigger memory_private_media_policy_lock before update on private.memory_private_media_policy for each row execute function private.serialize_private_media_policy();

create function public.claim_memory_private_image_cleanup() returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform private.lock_private_media();
 update private.memory_private_media set state='DELETING',cleanup_after=greatest(now(),write_until)+interval '60 seconds' where state='PREPARING' and expires_at<=now();
 return (select coalesce(jsonb_agg(jsonb_build_object('id',id)),'[]') from (select id from private.memory_private_media where state='DELETING' and cleanup_after<=now() order by cleanup_after limit 50) q);
end $$;
create function public.complete_memory_private_image_cleanup(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 perform private.lock_private_media();
 update private.memory_private_media set state='DELETED' where id=p_id and state='DELETING' and cleanup_after<=now();
end $$;

-- No default PUBLIC execute grants; only explicitly listed authenticated APIs expose owner-checked projections.
do $$ declare f record; begin
 for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where (n.nspname='private' and p.proname in ('lock_private_media','private_media_source','private_media_policy','retire_private_media_source','serialize_private_media_policy'))
 or (n.nspname='public' and p.proname in ('get_memory_private_image_policy','authorize_memory_private_image_attempt','reserve_memory_private_image','complete_memory_private_image','read_memory_private_image','cancel_memory_private_image','claim_memory_private_image_cleanup','complete_memory_private_image_cleanup')) loop
  execute format('revoke all on function %s from public,anon,authenticated',f.signature);
 end loop;
end $$;
grant execute on function public.get_memory_private_image_policy(uuid,bigint),public.read_memory_private_image(uuid,bigint,text,boolean),public.cancel_memory_private_image(uuid) to authenticated;
grant execute on function public.authorize_memory_private_image_attempt(uuid,bigint,text) to authenticated;
grant execute on function public.reserve_memory_private_image(uuid,uuid,bigint,uuid,text,text,text,text,integer,integer,integer,integer),public.complete_memory_private_image(uuid),public.claim_memory_private_image_cleanup(),public.complete_memory_private_image_cleanup(uuid) to service_role;
