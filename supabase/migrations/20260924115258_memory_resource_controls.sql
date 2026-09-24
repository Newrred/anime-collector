-- Disabled until D03 approval. These are committed-work budgets, not ingress WAF.
-- Retire historical direct social grants without deleting or migrating their rows.
do $$ declare legacy text; begin
 foreach legacy in array array['user_follows','user_showcase_layouts','user_showcase_public'] loop
  if to_regclass('public.'||legacy) is not null then
   execute format('revoke all on public.%I from public,anon,authenticated',legacy);
  end if;
 end loop;
end $$;
drop policy if exists "read public or own profiles" on public.user_profiles;
drop policy if exists "read public, own, or connected profiles" on public.user_profiles;
revoke all on public.user_profiles from public,anon,authenticated;
grant select on public.user_profiles to authenticated;
create policy memory_profiles_owner_boundary on public.user_profiles as restrictive for select to authenticated using ((select auth.uid())=user_id);
create table private.memory_resource_policies(
 scope text primary key, enabled boolean not null default false, paused boolean not null default false,
 daily_limit bigint not null default 0 check(daily_limit>=0), live_limit bigint check(live_limit>=0)
);
create table private.memory_resource_usage(
 actor uuid not null,scope text not null references private.memory_resource_policies(scope),
 window_day date not null,used bigint not null check(used>=0),primary key(actor,scope)
);
create table private.memory_resource_overrides(
 actor uuid not null,scope text not null references private.memory_resource_policies(scope),
 daily_limit bigint not null check(daily_limit>=0),live_limit bigint check(live_limit>=0),
 expires_at timestamptz not null,reason text not null check(length(btrim(reason)) between 1 and 500),primary key(actor,scope)
);
insert into private.memory_resource_policies(scope) values
 ('SYNC_MEMORY_PRIVATE_TITLES'),('SYNC_MEMORY_CARDS'),('SYNC_MEMORY_VISUAL_ASSETS'),('SYNC_MEMORY_BOARDS'),('SYNC_MEMORY_BOARD_CARDS'),
 ('SYNC_USER_DEVICES'),('PUBLIC_PREPARE'),('PUBLIC_PUBLISH'),('FOLLOW_WRITE'),('IMAGE_ATTEMPT'),('IMAGE_DELIVERY'),('IMAGE_DELIVERY_BYTES');
alter table private.memory_resource_policies enable row level security;
alter table private.memory_resource_usage enable row level security;
alter table private.memory_resource_overrides enable row level security;
revoke all on private.memory_resource_policies,private.memory_resource_usage,private.memory_resource_overrides from public,anon,authenticated;

create function private.consume_memory_resource(p_actor uuid,p_scope text,p_cost bigint default 1,p_live bigint default null) returns void
language plpgsql security definer set search_path='' as $$
declare policy private.memory_resource_policies; custom private.memory_resource_overrides; changed integer;
 day_value date := (now() at time zone 'UTC')::date;
begin
 if p_actor is null or p_cost is null or p_cost<0 then raise exception 'INVALID_SELECTION'; end if;
 select * into policy from private.memory_resource_policies where scope=p_scope;
 if not found then raise exception 'INVALID_OPERATION'; end if;
 if policy.paused then raise exception using message=case when p_scope like 'SYNC_%' then 'SYNC_PAUSED' else 'PUBLICATION_DISABLED' end; end if;
 if not policy.enabled then return; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('budget:'||p_actor::text||':'||p_scope,0));
 select * into custom from private.memory_resource_overrides where actor=p_actor and scope=p_scope and expires_at>now();
 if found then policy.daily_limit:=custom.daily_limit; policy.live_limit:=custom.live_limit; end if;
 if p_live is not null and policy.live_limit is not null and p_live>policy.live_limit then
  raise exception using message=case when p_scope like 'SYNC_%' then 'SYNC_QUOTA_EXCEEDED' else 'RATE_LIMITED' end;
 end if;
 insert into private.memory_resource_usage(actor,scope,window_day,used) values(p_actor,p_scope,day_value,0) on conflict do nothing;
 update private.memory_resource_usage set window_day=day_value,used=(case when window_day=day_value then used else 0 end)+p_cost
  where actor=p_actor and scope=p_scope and (case when window_day=day_value then used else 0 end)+p_cost<=policy.daily_limit;
 get diagnostics changed=row_count;
 if changed=0 then raise exception using message=case when p_scope like 'SYNC_%' then 'SYNC_RATE_LIMITED' else 'RATE_LIMITED' end; end if;
end $$;

create function private.guard_memory_resource() returns trigger language plpgsql security definer set search_path='' as $$
declare current_row jsonb:=to_jsonb(new); previous_row jsonb:=case when tg_op='UPDATE' then to_jsonb(old) else '{}'::jsonb end;
 actor uuid:=(current_row->>'user_id')::uuid; scope_value text; live_count bigint;
begin
 if current_row=previous_row then return new; end if;
 if tg_table_schema='public' then
  -- Tombstones and visual retirement remain possible under pause/overage.
  if tg_op='UPDATE' and (current_row->>'deleted_at' is not null or current_row->>'is_current'='false') then return new; end if;
  scope_value:='SYNC_'||upper(tg_table_name);
  if not exists(select 1 from private.memory_resource_policies where scope=scope_value and (enabled or paused)) then return new; end if;
  -- Take the same lock before counting capacity, including concurrent transactions.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('budget:'||actor::text||':'||scope_value,0));
  if current_row ? 'deleted_at' then
   execute format('select count(*) from public.%I where user_id=$1 and deleted_at is null',tg_table_name) into live_count using actor;
  else
   execute format('select count(*) from public.%I where user_id=$1',tg_table_name) into live_count using actor;
  end if;
 elsif tg_table_name='memory_relationships' then
  if not new.following or coalesce((previous_row->>'following')::boolean,false) then return new; end if;
  actor:=new.owner_id; scope_value:='FOLLOW_WRITE';
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('budget:'||actor::text||':'||scope_value,0));
  select count(*) into live_count from private.memory_relationships where owner_id=actor and following;
 else
  if current_row->>'published_operation' is distinct from previous_row->>'published_operation'
    and coalesce(current_row->'published_snapshot',current_row->'published_selection','null'::jsonb)<>'null'::jsonb then scope_value:='PUBLIC_PUBLISH';
  elsif (current_row->>'review_hash' is distinct from previous_row->>'review_hash' or current_row->>'preview_hash' is distinct from previous_row->>'preview_hash') and current_row->'preview'<>'null'::jsonb then scope_value:='PUBLIC_PREPARE';
  else return new; end if;
 end if;
 if tg_table_schema='private' then
  perform pg_catalog.pg_advisory_xact_lock_shared(pg_catalog.hashtextextended('public-account:'||actor::text,0));
  if exists(select 1 from private.memory_account_sanctions where user_id=actor and active)
    or exists(select 1 from private.memory_publication_accounts where user_id=actor and (hidden or write_blocked)) then raise exception 'PUBLICATION_RESTRICTED'; end if;
 end if;
 perform private.consume_memory_resource(actor,scope_value,1,live_count);
 return new;
end $$;

create function private.serialize_memory_sanction() returns trigger language plpgsql security definer set search_path='' as $$
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('public-account:'||new.user_id::text,0));
 return new;
end $$;
create trigger memory_sanction_serialization before insert or update on private.memory_account_sanctions for each row execute function private.serialize_memory_sanction();
create or replace function private.check_moderated_asset() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.state in ('PREPARING','READY') then
  perform pg_catalog.pg_advisory_xact_lock_shared(pg_catalog.hashtextextended('public-account:'||new.user_id::text,0));
  if exists(select 1 from private.memory_account_sanctions where user_id=new.user_id and active)
    or exists(select 1 from private.memory_publication_accounts where user_id=new.user_id and (hidden or write_blocked)) then raise exception 'PUBLICATION_RESTRICTED'; end if;
 end if;
 return new;
end $$;
revoke all on function private.serialize_memory_sanction() from public,anon,authenticated;
do $$ declare name text; begin
 foreach name in array array['memory_private_titles','memory_cards','memory_visual_assets','memory_boards','memory_board_cards','user_devices'] loop
  execute format('create trigger memory_resource_guard after insert or update on public.%I for each row execute function private.guard_memory_resource()',name);
 end loop;
 foreach name in array array['memory_publications','memory_minihomes','memory_relationships'] loop
  execute format('create trigger memory_resource_guard after insert or update on private.%I for each row execute function private.guard_memory_resource()',name);
 end loop;
end $$;

create function public.authorize_memory_image_attempt() returns void language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.require_publication_writer();
begin perform private.consume_memory_resource(actor,'IMAGE_ATTEMPT'); end $$;
create function public.authorize_memory_image_delivery(p_bytes bigint) returns void language plpgsql security definer set search_path='' as $$
begin
 if p_bytes is null or p_bytes not between 1 and 2097152 then raise exception 'INVALID_SELECTION'; end if;
 perform private.consume_memory_resource('00000000-0000-0000-0000-000000000000','IMAGE_DELIVERY');
 perform private.consume_memory_resource('00000000-0000-0000-0000-000000000000','IMAGE_DELIVERY_BYTES',p_bytes);
end $$;

create function public.get_memory_resource_usage() returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); result jsonb;
begin
 if v_actor is null then raise exception 'AUTH_REQUIRED'; end if;
 perform set_config('response.headers','[{"Cache-Control":"no-store"}]',true);
 select coalesce(jsonb_agg(jsonb_build_object('scope',p.scope,'enabled',p.enabled,'paused',p.paused,
  'used',case when u.window_day=(now() at time zone 'UTC')::date then u.used else 0 end,
  'dailyLimit',coalesce(o.daily_limit,p.daily_limit),'liveLimit',case when o.actor is not null then o.live_limit else p.live_limit end,
  'overrideExpiresAt',o.expires_at) order by p.scope),'[]') into result
 from private.memory_resource_policies p left join private.memory_resource_usage u on u.actor=v_actor and u.scope=p.scope
 left join private.memory_resource_overrides o on o.actor=v_actor and o.scope=p.scope and o.expires_at>now()
 where p.scope not in ('IMAGE_DELIVERY','IMAGE_DELIVERY_BYTES');
 return result;
end $$;

create function public.inspect_memory_resource_costs() returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform private.require_memory_moderator();
 return jsonb_build_object('policies',(select jsonb_agg(to_jsonb(p) order by scope) from private.memory_resource_policies p),
  'usage',(select coalesce(jsonb_agg(to_jsonb(q)),'[]') from (select scope,sum(used) used from private.memory_resource_usage where window_day=(now() at time zone 'UTC')::date group by scope) q),
  'deleteFences',(select count(*) from private.memory_publication_delete_fences),
  'fenceBytes',pg_catalog.pg_total_relation_size('private.memory_publication_delete_fences'::regclass),
  'retainedSyncOperations',(select count(*) from public.sync_operations),
  'imageReservedBytes',(select coalesce(sum(reserved_bytes),0) from private.memory_public_assets),
  'reports',(select count(*) from private.memory_reports));
end $$;
revoke all on function private.consume_memory_resource(uuid,text,bigint,bigint),private.guard_memory_resource() from public,anon,authenticated;
revoke all on function public.authorize_memory_image_attempt(),public.authorize_memory_image_delivery(bigint),public.get_memory_resource_usage(),public.inspect_memory_resource_costs() from public,anon,authenticated;
grant execute on function public.authorize_memory_image_attempt(),public.get_memory_resource_usage(),public.inspect_memory_resource_costs() to authenticated;
grant execute on function public.authorize_memory_image_delivery(bigint) to service_role;
