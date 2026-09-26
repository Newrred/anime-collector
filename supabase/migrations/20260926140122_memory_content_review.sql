-- Content classification gate. UNCONFIGURED keeps unreviewed public content closed.
-- No adult eligibility, policy approval or public activation is granted by this migration.
alter table private.memory_publication_settings add column content_policy_revision text not null default 'UNCONFIGURED';
create table private.memory_content_review_requests (
 case_id uuid primary key references private.memory_reports(id),
 target_kind text not null check(target_kind in ('board','home')),
 target_id uuid not null,
 snapshot_hash text not null,
 policy_revision text not null,
 unique(target_kind,target_id,snapshot_hash,policy_revision)
);
alter table private.memory_content_review_requests enable row level security;
revoke all on private.memory_content_review_requests from public,anon,authenticated,service_role;
create table private.memory_content_review_audit (
 id bigint generated always as identity primary key,
 target_kind text not null check(target_kind in ('board','home')),
 target_id uuid not null,
 snapshot_hash text not null,
 rating text not null,
 revision bigint not null,
 actor uuid not null,
 policy_revision text not null,
 case_id uuid not null references private.memory_reports(id),
 created_at timestamptz not null default now(),
 unique(target_kind,target_id,revision)
);
alter table private.memory_content_review_audit enable row level security;
revoke all on private.memory_content_review_audit from public,anon,authenticated,service_role;
create function private.notify_memory_content_review() returns trigger
language plpgsql security definer set search_path='' as $$
declare target_owner uuid; notice_reason text;
begin
 if new.target_kind='board' then select user_id into target_owner from private.memory_publications where id=new.target_id;
 else select user_id into target_owner from private.memory_minihomes where id=new.target_id; end if;
 if target_owner is null then raise exception 'NOT_FOUND'; end if;
 new.case_id:=gen_random_uuid();
 notice_reason:=case new.rating when 'GENERAL' then 'Reviewed as general content.'
  when 'MATURE' then 'Adult verification is required to view this content.'
  else 'This content is outside the current public content policy.' end;
 insert into private.memory_reports(id,reporter,operation_id,target_kind,target_id,category,note,status)
 values(new.case_id,null,gen_random_uuid(),new.target_kind,new.target_id,'SAFETY','','CLOSED');
 insert into private.memory_moderation_notices(case_id,recipient,action,reason,target_kind,target_id)
 values(new.case_id,target_owner,'CONTENT_'||new.rating,notice_reason,new.target_kind,new.target_id);
 insert into private.memory_moderation_audit(case_id,actor,action,reason,case_revision,target_revision)
 values(new.case_id,new.actor,'CONTENT_'||new.rating,notice_reason,0,new.revision);
 return new;
end $$;
revoke all on function private.notify_memory_content_review() from public,anon,authenticated,service_role;
create trigger memory_content_review_notice before insert on private.memory_content_review_audit
for each row execute function private.notify_memory_content_review();
create table private.memory_content_reviews (
 publication_id uuid primary key references private.memory_publications(id) on delete cascade,
 snapshot_hash text not null check(snapshot_hash ~ '^[a-f0-9]{64}$'),
 rating text not null check(rating in ('GENERAL','MATURE','BLOCKED')),
 policy_revision text not null,
 revision bigint not null default 1,
 reviewed_by uuid not null
);
alter table private.memory_content_reviews enable row level security;
revoke all on private.memory_content_reviews from public,anon,authenticated;

create function public.review_memory_publication_content(p_id uuid,p_hash text,p_rating text,p_revision bigint,p_policy text)
returns bigint language plpgsql security definer set search_path='' as $$
declare actor uuid; snapshot jsonb; previous bigint; result bigint; current_policy text;
begin
 actor:=private.require_memory_moderator();
 select content_policy_revision into current_policy from private.memory_publication_settings for share;
 if current_policy is null or current_policy='UNCONFIGURED' or p_policy is distinct from current_policy then raise exception 'CONTENT_POLICY_CHANGED'; end if;
 if p_rating is null or p_rating not in ('GENERAL','MATURE','BLOCKED') or p_revision is null or p_revision<0 then
  raise exception 'INVALID_SELECTION';
 end if;
 select published_snapshot into snapshot from private.memory_publications where id=p_id for update;
 if snapshot is null then raise exception 'NOT_FOUND'; end if;
 if p_hash is distinct from encode(sha256(convert_to(snapshot::text,'UTF8')),'hex') then
  raise exception 'PUBLICATION_CONFLICT';
 end if;
 select revision into previous from private.memory_content_reviews where publication_id=p_id;
 if coalesce(previous,0)<>p_revision then raise exception 'PUBLICATION_CONFLICT'; end if;
 insert into private.memory_content_reviews(publication_id,snapshot_hash,rating,reviewed_by,policy_revision)
 values(p_id,p_hash,p_rating,actor,p_policy)
 on conflict(publication_id) do update set snapshot_hash=excluded.snapshot_hash,rating=excluded.rating,
  reviewed_by=excluded.reviewed_by,policy_revision=excluded.policy_revision,revision=private.memory_content_reviews.revision+1
 returning revision into result;
 insert into private.memory_content_review_audit(target_kind,target_id,snapshot_hash,rating,revision,actor,policy_revision)
 values('board',p_id,p_hash,p_rating,result,actor,p_policy);
 return result;
end $$;
revoke all on function public.review_memory_publication_content(uuid,text,text,bigint,text) from public,anon,authenticated;
grant execute on function public.review_memory_publication_content(uuid,text,text,bigint,text) to authenticated;

alter function public.read_memory_publication(uuid) set schema private;
alter function private.read_memory_publication(uuid) rename to read_memory_publication_before_content_review;
revoke all on function private.read_memory_publication_before_content_review(uuid) from public,anon,authenticated,service_role;
create function public.read_memory_publication(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 perform set_config('response.headers','[{"Cache-Control":"no-store"}]',true);
 if not exists(select 1 from private.memory_publications p join private.memory_content_reviews r on r.publication_id=p.id
  where p.id=p_id and r.rating='GENERAL'
  and r.policy_revision=(select content_policy_revision from private.memory_publication_settings)
  and r.snapshot_hash=encode(sha256(convert_to(p.published_snapshot::text,'UTF8')),'hex')) then return null; end if;
 return private.read_memory_publication_before_content_review(p_id);
end $$;
revoke all on function public.read_memory_publication(uuid) from public,anon,authenticated;
grant execute on function public.read_memory_publication(uuid) to anon,authenticated,service_role;

-- Home nickname/bio require independent review; board entries still use board reviews.
create table private.memory_home_content_reviews (
 home_id uuid primary key references private.memory_minihomes(id) on delete cascade,
 snapshot_hash text not null check(snapshot_hash ~ '^[a-f0-9]{64}$'),
 rating text not null check(rating in ('GENERAL','MATURE','BLOCKED')),
 policy_revision text not null,
 revision bigint not null default 1,
 reviewed_by uuid not null
);
alter table private.memory_home_content_reviews enable row level security;
revoke all on private.memory_home_content_reviews from public,anon,authenticated;

create function public.review_memory_minihome_content(p_id uuid,p_hash text,p_rating text,p_revision bigint,p_policy text)
returns bigint language plpgsql security definer set search_path='' as $$
declare actor uuid; snapshot jsonb; previous bigint; result bigint; current_policy text;
begin
 actor:=private.require_memory_moderator();
 select content_policy_revision into current_policy from private.memory_publication_settings for share;
 if current_policy is null or current_policy='UNCONFIGURED' or p_policy is distinct from current_policy then raise exception 'CONTENT_POLICY_CHANGED'; end if;
 if p_rating is null or p_rating not in ('GENERAL','MATURE','BLOCKED') or p_revision is null or p_revision<0 then
  raise exception 'INVALID_SELECTION';
 end if;
 select published_selection into snapshot from private.memory_minihomes where id=p_id for update;
 if snapshot is null then raise exception 'NOT_FOUND'; end if;
 if p_hash is distinct from encode(sha256(convert_to(snapshot::text,'UTF8')),'hex') then
  raise exception 'PUBLICATION_CONFLICT';
 end if;
 select revision into previous from private.memory_home_content_reviews where home_id=p_id;
 if coalesce(previous,0)<>p_revision then raise exception 'PUBLICATION_CONFLICT'; end if;
 insert into private.memory_home_content_reviews(home_id,snapshot_hash,rating,reviewed_by,policy_revision)
 values(p_id,p_hash,p_rating,actor,p_policy)
 on conflict(home_id) do update set snapshot_hash=excluded.snapshot_hash,rating=excluded.rating,
  reviewed_by=excluded.reviewed_by,policy_revision=excluded.policy_revision,revision=private.memory_home_content_reviews.revision+1
 returning revision into result;
 insert into private.memory_content_review_audit(target_kind,target_id,snapshot_hash,rating,revision,actor,policy_revision)
 values('home',p_id,p_hash,p_rating,result,actor,p_policy);
 return result;
end $$;
revoke all on function public.review_memory_minihome_content(uuid,text,text,bigint,text) from public,anon,authenticated;
grant execute on function public.review_memory_minihome_content(uuid,text,text,bigint,text) to authenticated;

alter function public.read_memory_minihome(uuid) set schema private;
alter function private.read_memory_minihome(uuid) rename to read_memory_minihome_before_content_review;
revoke all on function private.read_memory_minihome_before_content_review(uuid) from public,anon,authenticated,service_role;
create function public.read_memory_minihome(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 perform set_config('response.headers','[{"Cache-Control":"no-store"}]',true);
 if not exists(select 1 from private.memory_minihomes p join private.memory_home_content_reviews r on r.home_id=p.id
  where p.id=p_id and r.rating='GENERAL'
  and r.policy_revision=(select content_policy_revision from private.memory_publication_settings)
  and r.snapshot_hash=encode(sha256(convert_to(p.published_selection::text,'UTF8')),'hex')) then return null; end if;
 return private.read_memory_minihome_before_content_review(p_id);
end $$;
revoke all on function public.read_memory_minihome(uuid) from public,anon,authenticated;
grant execute on function public.read_memory_minihome(uuid) to anon,authenticated,service_role;

-- A generic RESTORE cannot resolve a classification decision.
alter function public.review_memory_report(uuid,bigint,bigint,text,text) set schema private;
alter function private.review_memory_report(uuid,bigint,bigint,text,text) rename to review_memory_report_before_content_review;
revoke all on function private.review_memory_report_before_content_review(uuid,bigint,bigint,text,text) from public,anon,authenticated,service_role;
create function public.review_memory_report(p_id uuid,p_revision bigint,p_target_revision bigint,p_action text,p_reason text)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform private.require_memory_moderator();
 if exists(select 1 from private.memory_content_review_audit where case_id=p_id)
  or exists(select 1 from private.memory_content_review_requests where case_id=p_id) then raise exception 'CONTENT_REVIEW_REQUIRED'; end if;
 return private.review_memory_report_before_content_review(p_id,p_revision,p_target_revision,p_action,p_reason);
end $$;
revoke all on function public.review_memory_report(uuid,bigint,bigint,text,text) from public,anon,authenticated;
grant execute on function public.review_memory_report(uuid,bigint,bigint,text,text) to authenticated;

create function public.resolve_memory_content_appeal(p_case uuid,p_case_revision bigint,p_content_revision bigint,p_hash text,p_rating text,p_policy text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; report private.memory_reports; content_version bigint; initial_review boolean;
begin
 actor:=private.require_memory_moderator();
 select * into report from private.memory_reports where id=p_case for update;
 if not found then raise exception 'NOT_FOUND'; end if;
 initial_review:=exists(select 1 from private.memory_content_review_requests where case_id=p_case);
 if not initial_review and not exists(select 1 from private.memory_content_review_audit where case_id=p_case) then raise exception 'NOT_FOUND'; end if;
 if report.status<>(case when initial_review then 'RECEIVED' else 'APPEALED' end) or report.revision is distinct from p_case_revision then raise exception 'PUBLICATION_CONFLICT'; end if;
 if initial_review and not exists(select 1 from private.memory_content_review_requests where case_id=p_case and snapshot_hash=p_hash and policy_revision=p_policy) then raise exception 'PUBLICATION_CONFLICT'; end if;
 if report.target_kind='board' then
  content_version:=public.review_memory_publication_content(report.target_id,p_hash,p_rating,p_content_revision,p_policy);
 else
  content_version:=public.review_memory_minihome_content(report.target_id,p_hash,p_rating,p_content_revision,p_policy);
 end if;
 update private.memory_reports set status='CLOSED',revision=revision+1 where id=p_case returning * into report;
 insert into private.memory_moderation_audit(case_id,actor,action,reason,case_revision,target_revision)
 values(p_case,actor,case when initial_review then 'CONTENT_INITIAL_REVIEWED' else 'CONTENT_APPEAL_REVIEWED' end,
  'Content classification reviewed.',report.revision,content_version);
 return jsonb_build_object('id',p_case,'revision',report.revision,'contentRevision',content_version,'status',report.status);
end $$;
revoke all on function public.resolve_memory_content_appeal(uuid,bigint,bigint,text,text,text) from public,anon,authenticated;
grant execute on function public.resolve_memory_content_appeal(uuid,bigint,bigint,text,text,text) to authenticated;

alter function public.list_memory_moderation(uuid) set schema private;
alter function private.list_memory_moderation(uuid) rename to list_memory_moderation_before_content_review;
revoke all on function private.list_memory_moderation_before_content_review(uuid) from public,anon,authenticated,service_role;
create function public.list_memory_moderation(p_after uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 perform private.require_memory_moderator();
 result:=private.list_memory_moderation_before_content_review(p_after);
 return jsonb_set(result,'{items}',coalesce((select jsonb_agg(item||jsonb_build_object('reviewType',
  case when exists(select 1 from private.memory_content_review_audit a where a.case_id=(item->>'id')::uuid)
   or exists(select 1 from private.memory_content_review_requests q where q.case_id=(item->>'id')::uuid) then 'CONTENT' else 'REPORT' end) order by n)
  from jsonb_array_elements(result->'items') with ordinality q(item,n)),'[]'::jsonb));
end $$;
revoke all on function public.list_memory_moderation(uuid) from public,anon,authenticated;
grant execute on function public.list_memory_moderation(uuid) to authenticated;

create function public.get_memory_content_review(p_case uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare r private.memory_reports; snapshot jsonb; owner_id uuid; current_revision bigint; rating text; policy text;
begin
 perform private.require_memory_moderator();
 select * into r from private.memory_reports where id=p_case;
 if not found or (not exists(select 1 from private.memory_content_review_audit where case_id=p_case)
  and not exists(select 1 from private.memory_content_review_requests where case_id=p_case)) then raise exception 'NOT_FOUND'; end if;
 select content_policy_revision into policy from private.memory_publication_settings;
 if policy is null or policy='UNCONFIGURED' then raise exception 'CONTENT_POLICY_CHANGED'; end if;
 if r.target_kind='board' then
  select p.published_snapshot,p.user_id into snapshot,owner_id from private.memory_publications p
   join public.memory_boards b on b.id=p.board_id and b.user_id=p.user_id
   where p.id=r.target_id and p.state in ('PUBLISHED','PREPARING') and b.deleted_at is null;
  if snapshot is not null and exists(select 1 from jsonb_array_elements(snapshot->'cards') c
   where not private.memory_public_card_readable(owner_id,c)) then raise exception 'NOT_FOUND'; end if;
  select c.revision,c.rating into current_revision,rating from private.memory_content_reviews c where c.publication_id=r.target_id;
 else
  select h.published_selection into snapshot from private.memory_minihomes h where h.id=r.target_id;
  select c.revision,c.rating into current_revision,rating from private.memory_home_content_reviews c where c.home_id=r.target_id;
 end if;
 if snapshot is null then raise exception 'NOT_FOUND'; end if;
 if exists(select 1 from private.memory_content_review_requests where case_id=p_case and
  (snapshot_hash<>encode(sha256(convert_to(snapshot::text,'UTF8')),'hex') or policy_revision<>policy)) then raise exception 'PUBLICATION_CONFLICT'; end if;
 return jsonb_build_object('id',r.id,'kind',r.target_kind,'target',r.target_id,'caseRevision',r.revision,'status',r.status,
  'contentRevision',coalesce(current_revision,0),'rating',rating,'policyRevision',policy,
  'reviewHash',encode(sha256(convert_to(snapshot::text,'UTF8')),'hex'),'snapshot',snapshot);
end $$;
revoke all on function public.get_memory_content_review(uuid) from public,anon,authenticated;
grant execute on function public.get_memory_content_review(uuid) to authenticated;

create function public.resolve_memory_content_review_image(p_case uuid,p_review_hash text,p_policy text,p_content_revision bigint,p_asset_id uuid,p_variant text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare review jsonb; asset private.memory_public_assets;
begin
 review:=public.get_memory_content_review(p_case);
 if p_variant is null or p_variant not in ('full','thumb') then return null; end if;
 if not exists(select 1 from private.memory_publication_settings where reads_enabled and images_enabled) then return null; end if;
 if review->>'kind'<>'board' or review->>'reviewHash' is distinct from p_review_hash
  or review->>'policyRevision' is distinct from p_policy
  or (review->>'contentRevision')::bigint is distinct from p_content_revision then return null; end if;
 if not (review->'snapshot' @> jsonb_build_object('cards',jsonb_build_array(jsonb_build_object('visual',jsonb_build_object('type','USER_IMAGE','assetId',p_asset_id))))) then return null; end if;
 select * into asset from private.memory_public_assets where id=p_asset_id and state='READY';
 if not found then return null; end if;
 return jsonb_build_object('path',asset.object_prefix||'/'||p_variant||'.webp',
  'hash',case when p_variant='full' then asset.full_hash else asset.thumb_hash end);
end $$;
revoke all on function public.resolve_memory_content_review_image(uuid,text,text,bigint,uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.resolve_memory_content_review_image(uuid,text,text,bigint,uuid,text) to authenticated;

create function public.list_memory_pending_content(p_kind text,p_after uuid default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare items jsonb; next_id uuid; policy text;
begin
 perform private.require_memory_moderator();
 if p_kind is null or p_kind not in ('board','home') then raise exception 'INVALID_SELECTION'; end if;
 select content_policy_revision into policy from private.memory_publication_settings;
 if policy='UNCONFIGURED' then raise exception 'CONTENT_POLICY_CHANGED'; end if;
 if p_kind='board' then
  select coalesce(jsonb_agg(item order by id),'[]'::jsonb) into items from (
   select p.id,jsonb_build_object('id',p.id,'kind','board','label',p.published_snapshot->>'title') item
   from private.memory_publications p join public.memory_boards b on b.id=p.board_id and b.user_id=p.user_id
   left join private.memory_content_reviews r on r.publication_id=p.id
   where p.published_snapshot is not null and p.state in ('PUBLISHED','PREPARING') and b.deleted_at is null
   and (p_after is null or p.id>p_after)
   and (r.publication_id is null or r.policy_revision<>policy or r.snapshot_hash<>encode(sha256(convert_to(p.published_snapshot::text,'UTF8')),'hex'))
   order by p.id limit 21) q;
 else
  select coalesce(jsonb_agg(item order by id),'[]'::jsonb) into items from (
   select h.id,jsonb_build_object('id',h.id,'kind','home','label',h.published_selection->>'nickname') item
   from private.memory_minihomes h left join private.memory_home_content_reviews r on r.home_id=h.id
   where h.published_selection is not null and (p_after is null or h.id>p_after)
   and (r.home_id is null or r.policy_revision<>policy or r.snapshot_hash<>encode(sha256(convert_to(h.published_selection::text,'UTF8')),'hex'))
   order by h.id limit 21) q;
 end if;
 if jsonb_array_length(items)>20 then next_id:=(items->19->>'id')::uuid; items:=items-20; end if;
 return jsonb_build_object('items',items,'next',next_id);
end $$;
revoke all on function public.list_memory_pending_content(text,uuid) from public,anon,authenticated;
grant execute on function public.list_memory_pending_content(text,uuid) to authenticated;

create function public.open_memory_content_review(p_kind text,p_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare snapshot jsonb; policy text; hash text; case_id uuid;
begin
 perform private.require_memory_moderator();
 if p_kind is null or p_kind not in ('board','home') then raise exception 'INVALID_SELECTION'; end if;
 select content_policy_revision into policy from private.memory_publication_settings for share;
 if policy='UNCONFIGURED' then raise exception 'CONTENT_POLICY_CHANGED'; end if;
 if p_kind='board' then select published_snapshot into snapshot from private.memory_publications where id=p_id for update;
 else select published_selection into snapshot from private.memory_minihomes where id=p_id for update; end if;
 if snapshot is null then raise exception 'NOT_FOUND'; end if;
 hash:=encode(sha256(convert_to(snapshot::text,'UTF8')),'hex');
 select q.case_id into case_id from private.memory_content_review_requests q
 where q.target_kind=p_kind and q.target_id=p_id and q.snapshot_hash=hash and q.policy_revision=policy;
 if case_id is null then
  case_id:=gen_random_uuid();
  insert into private.memory_reports(id,reporter,operation_id,target_kind,target_id,category,note)
  values(case_id,null,gen_random_uuid(),p_kind,p_id,'SAFETY','');
  insert into private.memory_content_review_requests(case_id,target_kind,target_id,snapshot_hash,policy_revision)
  values(case_id,p_kind,p_id,hash,policy);
 end if;
 return public.get_memory_content_review(case_id);
end $$;
revoke all on function public.open_memory_content_review(text,uuid) from public,anon,authenticated;
grant execute on function public.open_memory_content_review(text,uuid) to authenticated;
