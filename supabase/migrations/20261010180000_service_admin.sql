-- Service administration is separate from content moderation. No role is seeded,
-- signup/public flag is enabled, or user-authored record is changed by this migration.
create table private.memory_service_operators (
 user_id uuid primary key references auth.users(id) on delete cascade,
 enabled boolean not null default true,
 created_at timestamptz not null default clock_timestamp()
);

-- Only a reviewed, version-controlled release may register/activate a bundle.
-- Neither the dashboard nor service_role receives write access to these tables.
create table private.memory_signup_release_bundles (
 id text primary key check(id ~ '^[A-Za-z0-9_-]{1,120}$'),
 policy_version text not null check(length(policy_version) between 1 and 120),
 terms_version text not null check(length(terms_version) between 1 and 120),
 privacy_version text not null check(length(privacy_version) between 1 and 120),
 countries jsonb not null check(jsonb_typeof(countries)='array' and jsonb_array_length(countries) between 1 and 249),
 production_ready boolean not null default false,
 created_at timestamptz not null default clock_timestamp(),
 check(not production_ready or (policy_version !~* '(test|draft)' and terms_version !~* '(test|draft)' and privacy_version !~* '(test|draft)'))
);
create table private.memory_signup_runtime_control (
 singleton boolean primary key default true check(singleton),
 revision bigint not null default 0 check(revision>=0),
 active_bundle_id text references private.memory_signup_release_bundles(id),
 first_activated_at timestamptz,
 check((active_bundle_id is null)=(first_activated_at is null))
);
insert into private.memory_signup_runtime_control(singleton) values(true);

create table private.memory_service_admin_audit (
 id bigint generated always as identity primary key,
 actor uuid not null,
 action text not null check(action in ('SIGNUP_PAUSED','SIGNUP_RESUMED')),
 enabled_before boolean not null,
 enabled_after boolean not null,
 admission_enabled boolean not null check(admission_enabled),
 policy_version text not null,
 terms_version text not null,
 privacy_version text not null,
 before_revision text not null check(before_revision ~ '^[a-f0-9]{64}$'),
 control_revision bigint not null unique check(control_revision>0),
 created_at timestamptz not null default clock_timestamp(),
 check(enabled_before<>enabled_after),
 check((action='SIGNUP_PAUSED' and enabled_before and not enabled_after)
    or (action='SIGNUP_RESUMED' and not enabled_before and enabled_after))
);

alter table private.memory_service_operators enable row level security;
alter table private.memory_signup_release_bundles enable row level security;
alter table private.memory_signup_runtime_control enable row level security;
alter table private.memory_service_admin_audit enable row level security;
revoke all on private.memory_service_operators,private.memory_signup_release_bundles,
 private.memory_signup_runtime_control,private.memory_service_admin_audit from public,anon,authenticated,service_role;
revoke all on sequence private.memory_service_admin_audit_id_seq from public,anon,authenticated,service_role;

create function private.protect_service_admin_immutable() returns trigger
language plpgsql set search_path='' as $$
begin raise exception 'ADMIN_RECORD_IMMUTABLE'; end $$;
create trigger memory_service_admin_audit_immutable before update or delete on private.memory_service_admin_audit
 for each row execute function private.protect_service_admin_immutable();
create trigger memory_service_admin_audit_no_truncate before truncate on private.memory_service_admin_audit
 execute function private.protect_service_admin_immutable();
create trigger memory_signup_release_bundles_immutable before update or delete on private.memory_signup_release_bundles
 for each row execute function private.protect_service_admin_immutable();
create trigger memory_signup_release_bundles_no_truncate before truncate on private.memory_signup_release_bundles
 execute function private.protect_service_admin_immutable();

create function private.check_service_admin_bundle() returns trigger
language plpgsql set search_path='' as $$
declare country_count integer; unique_count integer; canonical jsonb;
begin
 if exists(select 1 from jsonb_array_elements(new.countries) c where jsonb_typeof(c)<>'object'
  or not (c ?& array['country','minimumAge']) or (c-'country'-'minimumAge')<>'{}'::jsonb
  or jsonb_typeof(c->'country')<>'string' or c->>'country' !~ '^[A-Z]{2}$'
  or jsonb_typeof(c->'minimumAge')<>'number' or c->>'minimumAge' !~ '^(1[3-9]|20)$')
 then raise exception 'ADMIN_BUNDLE_INVALID'; end if;
 select count(*),count(distinct c->>'country'),jsonb_agg(c order by c->>'country')
 into country_count,unique_count,canonical from jsonb_array_elements(new.countries) c;
 if country_count<>unique_count then raise exception 'ADMIN_BUNDLE_INVALID'; end if;
 new.countries:=canonical;
 return new;
end $$;
create trigger memory_signup_release_bundle_validate before insert on private.memory_signup_release_bundles
 for each row execute function private.check_service_admin_bundle();

create function private.require_memory_service_operator(p_lock boolean default false) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid;
begin
 if auth.role() is distinct from 'authenticated' or auth.uid() is null then raise exception 'ADMIN_REQUIRED'; end if;
 -- A status read remains usable in a READ ONLY transaction. A mutation holds
 -- the role/account locks so a revocation cannot overtake its authorization.
 if p_lock then
  select o.user_id into actor from private.memory_service_operators o
  join auth.users u on u.id=o.user_id
  where o.user_id=auth.uid() and o.enabled and not coalesce(u.is_anonymous,false)
  for share of o,u;
 else
  select o.user_id into actor from private.memory_service_operators o
  join auth.users u on u.id=o.user_id
  where o.user_id=auth.uid() and o.enabled and not coalesce(u.is_anonymous,false);
 end if;
 if actor is null then raise exception 'ADMIN_REQUIRED'; end if;
 perform set_config('response.headers','[{"Cache-Control":"private, no-store, max-age=0"}]',true);
 return actor;
end $$;

-- A deterministic policy-state token also detects changes made by a separate
-- reviewed release tool, not only mutations made by the dashboard.
create function private.moemoa_admin_signup_state() returns jsonb
language sql stable security definer set search_path='' as $$
 with country_rows as (
  select coalesce(jsonb_agg(jsonb_build_object('country',country,'minimumAge',minimum_age) order by country),'[]'::jsonb) countries
  from private.simple_signup_countries
 ), state as (
  select p.*, c.revision control_revision,c.active_bundle_id,c.first_activated_at,r.countries,
   coalesce(p.admission_enabled and b.production_ready and c.first_activated_at is not null
    and b.policy_version=p.policy_version and b.terms_version=p.terms_version
    and b.privacy_version=p.privacy_version and b.countries=r.countries,false) ready
  from private.simple_signup_policy p cross join country_rows r
  cross join private.memory_signup_runtime_control c
  left join private.memory_signup_release_bundles b on b.id=c.active_bundle_id
  where p.singleton and c.singleton
 ), result as (
  select jsonb_build_object('enabled',enabled,'admissionEnabled',admission_enabled,
   'policyVersion',policy_version,'termsVersion',terms_version,'privacyVersion',privacy_version,
   'countries',countries,'canPause',enabled and admission_enabled,
   'canResume',not enabled and ready,'readyForResume',ready) signup,
   jsonb_build_object('enabled',enabled,'admissionEnabled',admission_enabled,
    'policyVersion',policy_version,'termsVersion',terms_version,'privacyVersion',privacy_version,
    'countries',countries,'controlRevision',control_revision,'activeBundle',active_bundle_id,
    'firstActivatedAt',first_activated_at,'ready',ready) token from state
 ) select jsonb_build_object('revision',encode(sha256(convert_to(token::text,'UTF8')),'hex'),'signup',signup) from result;
$$;

create function public.get_moemoa_admin_status() returns jsonb
language plpgsql security definer set search_path='' set lock_timeout='5s' as $$
declare actor uuid:=private.require_memory_service_operator(); signup_state jsonb; public_storage_limit bigint;
begin
 signup_state:=private.moemoa_admin_signup_state();
 if signup_state is null then raise exception 'ADMIN_CONFIGURATION_UNAVAILABLE'; end if;
 -- Older test schemas do not have the optional public-storage budget release.
 -- Unknown is null, never an invented zero or a reason to enable/apply Public.
 if to_regclass('private.memory_public_storage_policy') is not null then
  execute 'select max_reserved_bytes from private.memory_public_storage_policy where singleton' into public_storage_limit;
 end if;
 return signup_state || jsonb_build_object('version',1,'checkedAt',clock_timestamp(),
  'counts',jsonb_build_object(
   'accounts',(select count(*) from auth.users where not coalesce(is_anonymous,false)),
   'receipts',(select count(*) from private.simple_signup_declarations),
   'pendingAdmissions',(select count(*) from private.simple_signup_admissions),
   'pendingHandoffs',(select count(*) from private.simple_signup_handoffs)),
  'images',jsonb_build_object(
   'private',jsonb_build_object(
    'states',(select coalesce(jsonb_object_agg(state,n),'{}'::jsonb) from (select state,count(*) n from private.memory_private_media group by state) q),
    'reservedBytes',(select coalesce(sum(main_bytes+thumb_bytes),0) from private.memory_private_media where state<>'DELETED'),
    'due',(select count(*) from private.memory_private_media where state='DELETING' and cleanup_after<=now()),
    'waiting',(select count(*) from private.memory_private_media where state='DELETING' and cleanup_after>now()),
    'orphaned',(select count(*) from private.memory_private_media m where state<>'DELETED' and not exists(select 1 from auth.users u where u.id=m.owner_id))),
   'public',jsonb_build_object(
    'states',(select coalesce(jsonb_object_agg(state,n),'{}'::jsonb) from (select state,count(*) n from private.memory_public_assets group by state) q),
    'reservedBytes',(select coalesce(sum(reserved_bytes),0) from private.memory_public_assets where state<>'DELETED'))),
  'publication',(select jsonb_build_object('readsEnabled',reads_enabled,'writesEnabled',writes_enabled,'reportsEnabled',reports_enabled) from private.memory_publication_settings where singleton),
  'moderation',jsonb_build_object(
   'enabled',exists(select 1 from private.memory_moderators where user_id=actor and enabled),
   'reports',jsonb_build_object('received',(select count(*) from private.memory_reports where status='RECEIVED'),
    'appealed',(select count(*) from private.memory_reports where status='APPEALED'),
    'closed',(select count(*) from private.memory_reports where status='CLOSED'))),
  'costs',jsonb_build_object(
   'policies',(select coalesce(jsonb_agg(jsonb_build_object('scope',scope,'enabled',enabled,'paused',paused,'dailyLimit',daily_limit,'liveLimit',live_limit) order by scope),'[]'::jsonb) from private.memory_resource_policies),
   'usage',(select coalesce(jsonb_agg(jsonb_build_object('scope',scope,'used',used) order by scope),'[]'::jsonb) from (select scope,sum(used) used from private.memory_resource_usage where window_day=(now() at time zone 'UTC')::date group by scope) q),
   'privateStorageLimitBytes',(select physical_bytes from private.memory_private_media_policy where id),
   'privateMonthlyReadLimitBytes',(select global_read_bytes_per_month from private.memory_private_media_policy where id),
   'privateObservedAt',(select observed_at from private.memory_private_media_policy where id),
   'privateMonthlyReadBytes',coalesce((select read_bytes from private.memory_private_media_meter where owner_id='00000000-0000-0000-0000-000000000000' and month=date_trunc('month',now() at time zone 'UTC')::date),0),
   'publicStorageLimitBytes',public_storage_limit),
  'audit',(select coalesce(jsonb_agg(item order by id desc),'[]'::jsonb) from (
   select id,jsonb_build_object('action',action,'createdAt',created_at,'enabledBefore',enabled_before,'enabledAfter',enabled_after) item
   from private.memory_service_admin_audit order by id desc limit 20) q));
end $$;

create function public.set_moemoa_signup_paused(p_expected_revision text,p_paused boolean) returns jsonb
language plpgsql security definer set search_path='' set lock_timeout='5s' as $$
declare actor uuid:=private.require_memory_service_operator(true); p private.simple_signup_policy;
 state jsonb; next_revision bigint;
begin
 if p_paused is null or p_expected_revision is null or p_expected_revision !~ '^[a-f0-9]{64}$'
 then raise exception 'ADMIN_INVALID_REQUEST'; end if;
 -- All mutable inputs to the token are locked through the atomic state/audit
 -- commit. A concurrent country insert/delete cannot escape a row-only lock.
 select * into strict p from private.simple_signup_policy where singleton for update;
 lock table private.simple_signup_countries in share mode;
 perform 1 from private.memory_signup_runtime_control where singleton for update;
 state:=private.moemoa_admin_signup_state();
 if state is null then raise exception 'ADMIN_CONFIGURATION_UNAVAILABLE'; end if;
 if state->>'revision'<>p_expected_revision then raise exception 'ADMIN_REVISION_CONFLICT'; end if;
 -- false disables the admission hook/trigger: never use it as a pause switch.
 if not p.admission_enabled then raise exception 'ADMIN_ACTIVATION_REQUIRED'; end if;
 if not p_paused and (state->'signup'->>'readyForResume')::boolean is not true
 then raise exception 'ADMIN_RELEASE_NOT_READY'; end if;
 if p.enabled=(not p_paused) then return public.get_moemoa_admin_status(); end if;
 update private.simple_signup_policy set enabled=not p_paused where singleton;
 update private.memory_signup_runtime_control set revision=revision+1 where singleton returning revision into next_revision;
 insert into private.memory_service_admin_audit(actor,action,enabled_before,enabled_after,admission_enabled,
  policy_version,terms_version,privacy_version,before_revision,control_revision)
 values(actor,case when p_paused then 'SIGNUP_PAUSED' else 'SIGNUP_RESUMED' end,p.enabled,not p_paused,true,
  p.policy_version,p.terms_version,p.privacy_version,p_expected_revision,next_revision);
 return public.get_moemoa_admin_status();
end $$;

revoke all on function private.protect_service_admin_immutable(),private.check_service_admin_bundle(),
 private.require_memory_service_operator(boolean),private.moemoa_admin_signup_state(),
 public.get_moemoa_admin_status(),public.set_moemoa_signup_paused(text,boolean) from public,anon,authenticated,service_role;
grant execute on function public.get_moemoa_admin_status(),public.set_moemoa_signup_paused(text,boolean) to authenticated;
comment on function public.get_moemoa_admin_status() is 'Service-operator aggregate status only. No private content, account IDs, historic deletion total, or worker-run success claim.';
comment on function public.set_moemoa_signup_paused(text,boolean) is 'Pause/resume an already activated, reviewed signup release only. Preserve admission enforcement and atomically append audit; never activate public publishing.';
