-- Additive country activation. Installing this migration does not open signup.
-- Existing country rows retain their previous eligibility until an explicit data
-- release stages the reviewed subset. New country rows default to disabled.
alter table private.simple_signup_countries add column enabled boolean not null default true;
alter table private.simple_signup_countries alter column enabled set default false;

-- No account identities, declarations, free text, tokens, or private content.
create table private.simple_signup_rollout_events (
 release_id text primary key check(release_id ~ '^[A-Z0-9_]{1,120}$'),
 action text not null check(action in ('STAGE','ACTIVATE','PAUSE')),
 source_commit text not null check(source_commit ~ '^[a-f0-9]{40}$'),
 migration_sha256 text not null check(migration_sha256 ~ '^[a-f0-9]{64}$'),
 before_revision text not null check(before_revision ~ '^[a-f0-9]{64}$'),
 after_revision text not null check(after_revision ~ '^[a-f0-9]{64}$'),
 created_at timestamptz not null default clock_timestamp()
);
alter table private.simple_signup_rollout_events enable row level security;
revoke all on private.simple_signup_rollout_events from public,anon,authenticated,service_role;
create trigger simple_signup_rollout_events_immutable before update or delete on private.simple_signup_rollout_events
 for each row execute function private.protect_service_admin_immutable();
create trigger simple_signup_rollout_events_no_truncate before truncate on private.simple_signup_rollout_events
 execute function private.protect_service_admin_immutable();

-- CREATE OR REPLACE retains the existing owner and privilege boundary.
create or replace function public.get_simple_signup_policy() returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('enabled',p.enabled,'serverAdmission',p.admission_enabled,'version',p.policy_version,
 'termsVersion',p.terms_version,'privacyVersion',p.privacy_version,'countries',coalesce((select jsonb_agg(jsonb_build_object(
 'country',c.country,'minimumAge',c.minimum_age) order by c.country) from private.simple_signup_countries c where c.enabled),'[]'::jsonb))
 from private.simple_signup_policy p where singleton;
$$;

create or replace function public.issue_simple_signup_admission(p_subject text,p_email_hash text,p_declaration jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare p private.simple_signup_policy; minimum integer; age integer; day date; result uuid;
begin
 select * into p from private.simple_signup_policy where singleton for share;
 if not found or not p.enabled or not p.admission_enabled then raise exception 'SIGNUP_DISABLED'; end if;
 if p_declaration->>'policyVersion' is distinct from p.policy_version or p_declaration->>'termsVersion' is distinct from p.terms_version
 or p_declaration->>'privacyVersion' is distinct from p.privacy_version then raise exception 'SIGNUP_POLICY_CHANGED'; end if;
 if p_declaration->'accepted' is distinct from 'true'::jsonb or p_declaration->'version' is distinct from '1'::jsonb then raise exception 'TERMS_REQUIRED'; end if;
 age := (p_declaration->>'age')::integer; day := (p_declaration->>'declaredOn')::date;
 if age is null or age not between 0 and 120 or day is null or day not between (now() at time zone 'UTC')::date-1 and (now() at time zone 'UTC')::date+1
 or (p_declaration->>'createdAt')::numeric is null or (p_declaration->>'createdAt')::numeric not between extract(epoch from clock_timestamp()-interval '30 minutes')*1000 and extract(epoch from clock_timestamp())*1000
 then raise exception 'SIGNUP_DETAILS_EXPIRED'; end if;
 select minimum_age into minimum from private.simple_signup_countries where country=p_declaration->>'country' and enabled for share;
 if not found then raise exception 'COUNTRY_NOT_READY'; end if;
 if age<minimum then raise exception 'BELOW_MINIMUM_AGE'; end if;
 delete from private.simple_signup_admissions where expires_at<clock_timestamp();
 delete from private.simple_signup_handoffs where expires_at<clock_timestamp();
 insert into private.simple_signup_admissions(google_subject,email_hash,country,age_band,minimum_age,policy_version,terms_version,privacy_version)
 values(p_subject,p_email_hash,p_declaration->>'country',case when age<18 then 'UNDER_18' else '18_PLUS' end,minimum,p.policy_version,p.terms_version,p.privacy_version)
 returning id into result;
 return result;
end $$;

create or replace function public.check_simple_signup_admission(event jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare p private.simple_signup_policy;
begin
 select * into p from private.simple_signup_policy where singleton;
 if not found or not p.admission_enabled then return '{}'::jsonb; end if;
 if p.enabled and event->'user'->'app_metadata'->>'provider'='google'
 and event->'user'->'user_metadata'->'email_verified'='true'::jsonb
 and coalesce((event->'user'->>'is_anonymous')::boolean,false)=false
 and exists(select 1 from private.simple_signup_admissions a join private.simple_signup_countries c on c.country=a.country and c.enabled
 where a.google_subject=event->'user'->'user_metadata'->>'sub'
 and a.email_hash=encode(sha256(convert_to(lower(trim(event->'user'->>'email')),'UTF8')),'hex')
 and a.claimed_user is null and a.expires_at>clock_timestamp() and a.policy_version=p.policy_version
 and a.terms_version=p.terms_version and a.privacy_version=p.privacy_version and a.minimum_age=c.minimum_age)
 then return '{}'::jsonb; end if;
 return '{"error":{"http_code":403,"message":"Complete signup at MOEMOA before creating an account."}}'::jsonb;
end $$;

create or replace function private.apply_simple_signup_admission() returns trigger
language plpgsql security definer set search_path='' as $$
declare p private.simple_signup_policy; a private.simple_signup_admissions; minimum integer;
begin
 select * into p from private.simple_signup_policy where singleton for share;
 if not found or not p.admission_enabled then return new; end if;
 if not p.enabled or new.raw_app_meta_data->>'provider' is distinct from 'google'
 or new.raw_user_meta_data->'email_verified' is distinct from 'true'::jsonb or coalesce(new.is_anonymous,false)
 then raise exception 'SIGNUP_ADMISSION_REQUIRED'; end if;
 select * into a from private.simple_signup_admissions where google_subject=new.raw_user_meta_data->>'sub'
 and email_hash=encode(sha256(convert_to(lower(trim(new.email)),'UTF8')),'hex') for update;
 if not found or a.claimed_user is not null or a.expires_at<=clock_timestamp() or a.policy_version<>p.policy_version
 or a.terms_version<>p.terms_version or a.privacy_version<>p.privacy_version then raise exception 'SIGNUP_ADMISSION_REQUIRED'; end if;
 select minimum_age into minimum from private.simple_signup_countries where country=a.country and enabled for share;
 if not found or minimum<>a.minimum_age then raise exception 'SIGNUP_POLICY_CHANGED'; end if;
 update private.simple_signup_admissions set claimed_user=new.id where id=a.id;
 insert into private.simple_signup_declarations(user_id,policy_version,country,age_band,minimum_age_at_declaration,terms_version,privacy_version)
 values(new.id,a.policy_version,a.country,a.age_band,a.minimum_age,a.terms_version,a.privacy_version);
 return new;
end $$;

create or replace function public.finish_simple_signup_admission(p_id uuid,p_user_id uuid) returns boolean
language plpgsql security definer set search_path='' as $$
declare a private.simple_signup_admissions; p private.simple_signup_policy; r private.simple_signup_declarations; minimum integer;
begin
 select * into p from private.simple_signup_policy where singleton for share;
 if not found or not p.enabled or not p.admission_enabled then raise exception 'SIGNUP_DISABLED'; end if;
 select * into a from private.simple_signup_admissions where id=p_id for update;
 if not found or a.expires_at<=clock_timestamp() or (a.claimed_user is not null and a.claimed_user<>p_user_id)
 or a.policy_version<>p.policy_version or a.terms_version<>p.terms_version or a.privacy_version<>p.privacy_version then raise exception 'SIGNUP_ADMISSION_REQUIRED'; end if;
 select minimum_age into minimum from private.simple_signup_countries where country=a.country and enabled for share;
 if not found or minimum<>a.minimum_age then raise exception 'SIGNUP_POLICY_CHANGED'; end if;
 -- Existing users do not run the INSERT trigger. Verify their actual Google identity here.
 if not exists(select 1 from auth.identities i join auth.users u on u.id=i.user_id where i.user_id=p_user_id and i.provider='google'
 and i.identity_data->>'sub'=a.google_subject and i.identity_data->'email_verified'='true'::jsonb
 and encode(sha256(convert_to(lower(trim(u.email)),'UTF8')),'hex')=a.email_hash and not coalesce(u.is_anonymous,false))
 then raise exception 'SIGNUP_ACCOUNT_CHANGED'; end if;
 insert into private.simple_signup_declarations(user_id,policy_version,country,age_band,minimum_age_at_declaration,terms_version,privacy_version)
 values(p_user_id,a.policy_version,a.country,a.age_band,a.minimum_age,a.terms_version,a.privacy_version)
 on conflict(user_id,policy_version) do nothing;
 select * into r from private.simple_signup_declarations where user_id=p_user_id and policy_version=a.policy_version;
 -- Retain the original signup receipt for returning users; getting older or moving
 -- does not rewrite that historical fact or prevent login. A new policy gets a new receipt.
 if r.terms_version<>a.terms_version or r.privacy_version<>a.privacy_version then raise exception 'SIGNUP_DECLARATION_CONFLICT'; end if;
 delete from private.simple_signup_admissions where id=p_id;
 return true;
end $$;

create or replace function public.record_simple_signup_declaration(p_expected_user_id uuid,p_country text,p_declared_age integer,p_declared_on date,
 p_policy_version text,p_terms_version text,p_privacy_version text,p_accept_terms boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 owner_id uuid := auth.uid();
 policy private.simple_signup_policy;
 minimum_age integer;
 band text;
 receipt private.simple_signup_declarations;
begin
 if owner_id is null or coalesce(auth.role(),'') <> 'authenticated' then raise exception 'AUTH_REQUIRED'; end if;
 if p_expected_user_id is distinct from owner_id then raise exception 'SIGNUP_ACCOUNT_CHANGED'; end if;
 if not exists(select 1 from auth.users where id=owner_id and coalesce(is_anonymous,false)=false) then raise exception 'AUTH_REQUIRED'; end if;
 select * into policy from private.simple_signup_policy where singleton for share;
 if not found or not policy.enabled then raise exception 'SIGNUP_SERVICE_UNAVAILABLE'; end if;
 if p_policy_version is distinct from policy.policy_version or p_terms_version is distinct from policy.terms_version
 or p_privacy_version is distinct from policy.privacy_version then raise exception 'SIGNUP_POLICY_CHANGED'; end if;
 if p_accept_terms is distinct from true then raise exception 'TERMS_REQUIRED'; end if;
 select c.minimum_age into minimum_age from private.simple_signup_countries c where country=p_country and c.enabled for share;
 if not found then raise exception 'COUNTRY_NOT_READY'; end if;
 -- A local calendar date may differ from the server UTC date by one day.
 if p_declared_age is null or p_declared_age not between 0 and 120 or p_declared_on is null
 or p_declared_on not between (current_timestamp at time zone 'UTC')::date-1 and (current_timestamp at time zone 'UTC')::date+1
 then raise exception 'SIGNUP_DETAILS_EXPIRED'; end if;
 if p_declared_age<minimum_age then raise exception 'BELOW_MINIMUM_AGE'; end if;
 band := case when p_declared_age<18 then 'UNDER_18' else '18_PLUS' end;
 insert into private.simple_signup_declarations(user_id,policy_version,country,age_band,minimum_age_at_declaration,terms_version,privacy_version)
 values(owner_id,policy.policy_version,p_country,band,minimum_age,policy.terms_version,policy.privacy_version)
 on conflict(user_id,policy_version) do nothing;
 select * into receipt from private.simple_signup_declarations where user_id=owner_id and policy_version=policy.policy_version;
 -- Do not silently replace a teen declaration with an adult claim during retries.
 if receipt.country<>p_country or receipt.age_band<>band or receipt.terms_version<>p_terms_version
 or receipt.privacy_version<>p_privacy_version then raise exception 'SIGNUP_DECLARATION_CONFLICT'; end if;
 return jsonb_build_object('recorded',true,'recordedAt',receipt.recorded_at,'policyVersion',receipt.policy_version);
end $$;

create or replace function private.moemoa_admin_signup_state() returns jsonb
language sql stable security definer set search_path='' as $$
 with country_rows as (
  select coalesce(jsonb_agg(jsonb_build_object('country',country,'minimumAge',minimum_age) order by country),'[]'::jsonb) countries
  from private.simple_signup_countries where enabled
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

comment on column private.simple_signup_countries.enabled is
 'Reviewed new-signup eligibility only. Disabled rows and historical receipts remain preserved.';

