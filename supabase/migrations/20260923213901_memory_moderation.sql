alter table private.memory_publication_settings
 add column reports_enabled boolean not null default false,
 add column report_daily_limit integer not null default 0 check(report_daily_limit>=0);
create table private.memory_moderators(user_id uuid primary key references auth.users(id) on delete cascade, enabled boolean not null default true);
create table private.memory_reports(
 id uuid primary key default gen_random_uuid(), reporter uuid references auth.users(id) on delete set null, operation_id uuid not null,
 target_kind text not null check(target_kind in ('home','board')), target_id uuid not null,
 category text not null check(category in ('SAFETY','RIGHTS','SPAM','OTHER')), note text not null check(length(note)<=1000),
 created_at timestamptz not null default now(), status text not null default 'RECEIVED', revision bigint not null default 0,
 unique(reporter,operation_id)
);
create index memory_report_open on private.memory_reports(reporter,target_kind,target_id,category) where status in ('RECEIVED','APPEALED');
create index memory_report_quota on private.memory_reports(reporter,created_at);
create table private.memory_moderation_targets(kind text not null,id uuid not null,revision bigint not null default 0,primary key(kind,id));
create table private.memory_moderation_notices(
 id uuid primary key default gen_random_uuid(), case_id uuid not null references private.memory_reports(id),
 recipient uuid not null references auth.users(id) on delete cascade, action text not null, reason text not null,
 target_kind text not null,target_id uuid not null,created_at timestamptz not null default now(),
 appeal text check(length(appeal) between 1 and 1000), appealed_at timestamptz
);
create table private.memory_moderation_audit(
 id bigint generated always as identity primary key, case_id uuid not null, actor uuid not null,
 action text not null, reason text not null, case_revision bigint not null,target_revision bigint not null,
 created_at timestamptz not null default now()
);
create table private.memory_account_sanctions(
 case_id uuid primary key references private.memory_reports(id),user_id uuid not null references auth.users(id) on delete cascade,active boolean not null
);
alter table private.memory_moderators enable row level security;
alter table private.memory_reports enable row level security;
alter table private.memory_moderation_targets enable row level security;
alter table private.memory_moderation_notices enable row level security;
alter table private.memory_moderation_audit enable row level security;
alter table private.memory_account_sanctions enable row level security;
revoke all on private.memory_moderators,private.memory_reports,private.memory_moderation_targets,private.memory_moderation_notices,private.memory_moderation_audit,private.memory_account_sanctions from public,anon,authenticated;

create function private.require_memory_moderator() returns uuid language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not exists(select 1 from private.memory_moderators where user_id=auth.uid() and enabled) then raise exception 'MODERATOR_REQUIRED'; end if;
 perform set_config('response.headers','[{"Cache-Control":"no-store"}]',true);
 return auth.uid();
end $$;
create function public.submit_memory_report(p_kind text,p_target uuid,p_category text,p_operation uuid,p_note text default '') returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); r private.memory_reports; quota integer;
begin
 if u is null then raise exception 'AUTH_REQUIRED'; end if;
 perform set_config('response.headers','[{"Cache-Control":"no-store"}]',true);
 if p_kind is null or p_kind not in ('home','board') or p_category is null or p_category not in ('SAFETY','RIGHTS','SPAM','OTHER') or p_operation is null or p_note is null or length(p_note)>1000 then raise exception 'INVALID_SELECTION'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('report:'||u::text,0));
 select * into r from private.memory_reports where reporter=u and operation_id=p_operation;
 if found then
  if r.target_kind<>p_kind or r.target_id is distinct from p_target or r.category<>p_category or r.note<>p_note then raise exception 'OPERATION_MISMATCH'; end if;
  return jsonb_build_object('id',r.id,'status',r.status);
 end if;
 select * into r from private.memory_reports where reporter=u and target_kind=p_kind and target_id=p_target and category=p_category and status in ('RECEIVED','APPEALED') order by created_at desc limit 1;
 if found then return jsonb_build_object('id',r.id,'status',r.status); end if;
 select report_daily_limit into quota from private.memory_publication_settings where reports_enabled;
 if quota is null then raise exception 'PUBLICATION_DISABLED'; end if;
 if (select count(*) from private.memory_reports where reporter=u and created_at>now()-interval '24 hours')>=quota then raise exception 'RATE_LIMITED'; end if;
 if not (case when p_kind='home' then exists(select 1 from private.memory_minihomes where id=p_target and published_operation is not null)
   else exists(select 1 from private.memory_publications where id=p_target and published_operation is not null) end) then raise exception 'NOT_FOUND'; end if;
 insert into private.memory_reports(reporter,operation_id,target_kind,target_id,category,note) values(u,p_operation,p_kind,p_target,p_category,p_note) returning * into r;
 return jsonb_build_object('id',r.id,'status',r.status);
end $$;

create function public.list_memory_safety(p_after uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); items jsonb; cursor_id uuid;
begin
 if u is null then raise exception 'AUTH_REQUIRED'; end if;
 perform set_config('response.headers','[{"Cache-Control":"no-store"}]',true);
 select coalesce(jsonb_agg(item order by id),'[]'::jsonb) into items from (
  select id,jsonb_build_object('id',id,'type','NOTICE','targetKind',target_kind,'targetId',target_id,'action',action,'reason',reason,'createdAt',created_at,'appealed',appeal is not null) item
   from private.memory_moderation_notices where recipient=u and (p_after is null or id>p_after)
  union all
  select id,jsonb_build_object('id',id,'type','REPORT','targetKind',target_kind,'targetId',target_id,'status',status,'createdAt',created_at)
   from private.memory_reports where reporter=u and (p_after is null or id>p_after)
  order by id limit 21
 ) q;
 if jsonb_array_length(items)>20 then cursor_id:=(items->19->>'id')::uuid; items:=items-20; end if;
 return jsonb_build_object('items',items,'next',cursor_id);
end $$;

create function public.appeal_memory_notice(p_id uuid,p_text text) returns jsonb language plpgsql security definer set search_path='' as $$
declare n private.memory_moderation_notices; case_id_value uuid;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
 if p_text is null or length(btrim(p_text)) not between 1 and 1000 then raise exception 'INVALID_SELECTION'; end if;
 perform set_config('response.headers','[{"Cache-Control":"no-store"}]',true);
 select case_id into case_id_value from private.memory_moderation_notices where id=p_id and recipient=auth.uid();
 if case_id_value is null then raise exception 'NOT_FOUND'; end if;
 -- Same lock order as review: case, then notice.
 perform 1 from private.memory_reports where id=case_id_value for update;
 select * into n from private.memory_moderation_notices where id=p_id and recipient=auth.uid() for update;
 if n.appeal is not null then return jsonb_build_object('id',n.id,'appealed',true); end if;
 update private.memory_moderation_notices set appeal=p_text,appealed_at=now() where id=p_id;
 update private.memory_reports set status='APPEALED',revision=revision+1 where id=n.case_id;
 insert into private.memory_moderation_audit(case_id,actor,action,reason,case_revision,target_revision)
 select id,auth.uid(),'APPEAL','OWNER_APPEAL',revision,0 from private.memory_reports where id=n.case_id;
 return jsonb_build_object('id',p_id,'appealed',true);
end $$;

create function public.list_memory_moderation(p_after uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare items jsonb; cursor_id uuid;
begin
 perform private.require_memory_moderator();
 select coalesce(jsonb_agg(item order by id),'[]'::jsonb) into items from (
  select r.id,jsonb_build_object('id',r.id,'kind',r.target_kind,'target',r.target_id,'category',r.category,'note',r.note,
   'createdAt',r.created_at,'status',r.status,'revision',r.revision,'targetRevision',coalesce(t.revision,0),
   'appeals',coalesce((select jsonb_agg(jsonb_build_object('noticeId',n.id,'text',n.appeal,'createdAt',n.appealed_at)) from private.memory_moderation_notices n where n.case_id=r.id and n.appeal is not null),'[]'::jsonb)) item
  from private.memory_reports r left join private.memory_moderation_targets t on t.kind=r.target_kind and t.id=r.target_id
  where p_after is null or r.id>p_after order by r.id limit 21
 ) q;
 if jsonb_array_length(items)>20 then cursor_id:=(items->19->>'id')::uuid; items:=items-20; end if;
 return jsonb_build_object('items',items,'next',cursor_id);
end $$;

create function public.review_memory_report(p_id uuid,p_revision bigint,p_target_revision bigint,p_action text,p_reason text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.require_memory_moderator(); r private.memory_reports; target_owner uuid; target_version bigint;
begin
 if p_action is null or p_action not in ('KEEP','HIDE','RESTORE','RESTRICT_ACCOUNT','RELEASE_ACCOUNT') or p_reason is null or length(btrim(p_reason)) not between 1 and 500 then raise exception 'INVALID_SELECTION'; end if;
 select * into r from private.memory_reports where id=p_id for update;
 if not found then raise exception 'NOT_FOUND'; end if;
 if r.revision is distinct from p_revision then raise exception 'PUBLICATION_CONFLICT'; end if;
 insert into private.memory_moderation_targets(kind,id) values(r.target_kind,r.target_id) on conflict do nothing;
 select revision into target_version from private.memory_moderation_targets where kind=r.target_kind and id=r.target_id for update;
 if target_version is distinct from p_target_revision then raise exception 'PUBLICATION_CONFLICT'; end if;
 if r.target_kind='home' then
  select user_id into target_owner from private.memory_minihomes where id=r.target_id for update;
  if p_action in ('HIDE','RESTORE') then update private.memory_minihomes set hidden=(p_action='HIDE') where id=r.target_id; end if;
 else
  select user_id into target_owner from private.memory_publications where id=r.target_id for update;
  if p_action in ('HIDE','RESTORE') then update private.memory_publications set hidden=(p_action='HIDE') where id=r.target_id; end if;
 end if;
 if target_owner is null and p_action<>'KEEP' then raise exception 'NOT_FOUND'; end if;
 if p_action in ('RESTRICT_ACCOUNT','RELEASE_ACCOUNT') then
  insert into private.memory_account_sanctions(case_id,user_id,active) values(r.id,target_owner,p_action='RESTRICT_ACCOUNT')
  on conflict(case_id) do update set active=excluded.active;
 end if;
 update private.memory_reports set status='CLOSED',revision=revision+1 where id=r.id returning * into r;
 update private.memory_moderation_targets set revision=revision+1 where kind=r.target_kind and id=r.target_id returning revision into target_version;
 insert into private.memory_moderation_audit(case_id,actor,action,reason,case_revision,target_revision) values(r.id,actor,p_action,p_reason,r.revision,target_version);
 if target_owner is not null then
  insert into private.memory_moderation_notices(case_id,recipient,action,reason,target_kind,target_id) values(r.id,target_owner,p_action,p_reason,r.target_kind,r.target_id);
 end if;
 return jsonb_build_object('id',r.id,'revision',r.revision,'targetRevision',target_version,'status',r.status);
end $$;

-- Sanctions never change legacy account flags and are released per case only.
create function public.read_memory_moderation_audit(p_case uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 perform private.require_memory_moderator();
 select coalesce(jsonb_agg(to_jsonb(q) order by id),'[]'::jsonb) into result from (
 select id,actor,action,reason,case_revision,target_revision,created_at from private.memory_moderation_audit where case_id=p_case order by id desc limit 50) q;
 return result;
end $$;
alter function private.require_publication_writer() rename to require_publication_writer_v1;
create function private.require_publication_writer() returns uuid language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_publication_writer_v1();
begin
 if exists(select 1 from private.memory_account_sanctions where user_id=u and active) then raise exception 'PUBLICATION_RESTRICTED'; end if;
 return u;
end $$;
create function private.check_moderated_asset() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.state='READY' and exists(select 1 from private.memory_account_sanctions where user_id=new.user_id and active) then raise exception 'PUBLICATION_RESTRICTED'; end if;
 return new;
end $$;
create trigger memory_asset_moderation before insert or update on private.memory_public_assets for each row execute function private.check_moderated_asset();
revoke all on function private.require_memory_moderator(),private.require_publication_writer(),private.check_moderated_asset() from public,anon,authenticated;
revoke all on function public.submit_memory_report(text,uuid,text,uuid,text),public.list_memory_safety(uuid),public.appeal_memory_notice(uuid,text),public.list_memory_moderation(uuid),public.review_memory_report(uuid,bigint,bigint,text,text) from public,anon,authenticated;
grant execute on function public.submit_memory_report(text,uuid,text,uuid,text),public.list_memory_safety(uuid),public.appeal_memory_notice(uuid,text),public.list_memory_moderation(uuid),public.review_memory_report(uuid,bigint,bigint,text,text) to authenticated;
revoke all on function public.read_memory_moderation_audit(uuid) from public,anon,authenticated;
grant execute on function public.read_memory_moderation_audit(uuid) to authenticated;
