-- Candidate only. Enable server + policy + Auth hook together after hosted verification.
alter table private.simple_signup_policy add column admission_enabled boolean not null default false;
create table private.simple_signup_admissions (
 id uuid primary key default gen_random_uuid(),
 google_subject text not null unique check(google_subject ~ '^[0-9]{1,255}$'),
 email_hash text not null check(email_hash ~ '^[a-f0-9]{64}$'),
 country text not null, age_band text not null check(age_band in ('UNDER_18','18_PLUS')),
 minimum_age integer not null, policy_version text not null, terms_version text not null, privacy_version text not null,
 expires_at timestamptz not null default clock_timestamp()+interval '5 minutes',
 claimed_user uuid references auth.users(id) on delete cascade
);
create table private.simple_signup_handoffs (
 key_hash text primary key check(key_hash ~ '^[a-f0-9]{64}$'),
 cipher text not null check(length(cipher) between 40 and 24000),
 expires_at timestamptz not null default clock_timestamp()+interval '2 minutes'
);
alter table private.simple_signup_admissions enable row level security;
alter table private.simple_signup_handoffs enable row level security;
revoke all on private.simple_signup_admissions,private.simple_signup_handoffs from public,anon,authenticated;

create or replace function public.get_simple_signup_policy() returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('enabled',p.enabled,'serverAdmission',p.admission_enabled,'version',p.policy_version,
 'termsVersion',p.terms_version,'privacyVersion',p.privacy_version,'countries',coalesce((select jsonb_agg(jsonb_build_object(
 'country',c.country,'minimumAge',c.minimum_age) order by c.country) from private.simple_signup_countries c),'[]'::jsonb))
 from private.simple_signup_policy p where singleton;
$$;

create function public.issue_simple_signup_admission(p_subject text,p_email_hash text,p_declaration jsonb) returns uuid
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
 select minimum_age into minimum from private.simple_signup_countries where country=p_declaration->>'country' for share;
 if not found then raise exception 'COUNTRY_NOT_READY'; end if;
 if age<minimum then raise exception 'BELOW_MINIMUM_AGE'; end if;
 delete from private.simple_signup_admissions where expires_at<clock_timestamp();
 delete from private.simple_signup_handoffs where expires_at<clock_timestamp();
 insert into private.simple_signup_admissions(google_subject,email_hash,country,age_band,minimum_age,policy_version,terms_version,privacy_version)
 values(p_subject,p_email_hash,p_declaration->>'country',case when age<18 then 'UNDER_18' else '18_PLUS' end,minimum,p.policy_version,p.terms_version,p.privacy_version)
 returning id into result;
 return result;
end $$;

-- Hook payload IDs can be provisional. Do not bind approval to that ID.
-- The transactional INSERT trigger below binds the real auth.users ID instead.
create function public.check_simple_signup_admission(event jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare p private.simple_signup_policy;
begin
 select * into p from private.simple_signup_policy where singleton;
 if not found or not p.admission_enabled then return '{}'::jsonb; end if;
 if p.enabled and event->'user'->'app_metadata'->>'provider'='google'
 and event->'user'->'user_metadata'->'email_verified'='true'::jsonb
 and coalesce((event->'user'->>'is_anonymous')::boolean,false)=false
 and exists(select 1 from private.simple_signup_admissions a join private.simple_signup_countries c on c.country=a.country
 where a.google_subject=event->'user'->'user_metadata'->>'sub'
 and a.email_hash=encode(sha256(convert_to(lower(trim(event->'user'->>'email')),'UTF8')),'hex')
 and a.claimed_user is null and a.expires_at>clock_timestamp() and a.policy_version=p.policy_version
 and a.terms_version=p.terms_version and a.privacy_version=p.privacy_version and a.minimum_age=c.minimum_age)
 then return '{}'::jsonb; end if;
 return '{"error":{"http_code":403,"message":"Complete signup at MOEMOA before creating an account."}}'::jsonb;
end $$;

create function private.apply_simple_signup_admission() returns trigger
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
 select minimum_age into minimum from private.simple_signup_countries where country=a.country for share;
 if not found or minimum<>a.minimum_age then raise exception 'SIGNUP_POLICY_CHANGED'; end if;
 update private.simple_signup_admissions set claimed_user=new.id where id=a.id;
 insert into private.simple_signup_declarations(user_id,policy_version,country,age_band,minimum_age_at_declaration,terms_version,privacy_version)
 values(new.id,a.policy_version,a.country,a.age_band,a.minimum_age,a.terms_version,a.privacy_version);
 return new;
end $$;
create trigger apply_simple_signup_admission after insert on auth.users for each row execute function private.apply_simple_signup_admission();

create function public.finish_simple_signup_admission(p_id uuid,p_user_id uuid) returns boolean
language plpgsql security definer set search_path='' as $$
declare a private.simple_signup_admissions; p private.simple_signup_policy; r private.simple_signup_declarations; minimum integer;
begin
 select * into p from private.simple_signup_policy where singleton for share;
 if not found or not p.enabled or not p.admission_enabled then raise exception 'SIGNUP_DISABLED'; end if;
 select * into a from private.simple_signup_admissions where id=p_id for update;
 if not found or a.expires_at<=clock_timestamp() or (a.claimed_user is not null and a.claimed_user<>p_user_id)
 or a.policy_version<>p.policy_version or a.terms_version<>p.terms_version or a.privacy_version<>p.privacy_version then raise exception 'SIGNUP_ADMISSION_REQUIRED'; end if;
 select minimum_age into minimum from private.simple_signup_countries where country=a.country for share;
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

create function public.store_simple_signup_handoff(p_key_hash text,p_cipher text) returns void
language plpgsql security definer set search_path='' as $$
begin
 delete from private.simple_signup_handoffs where expires_at<clock_timestamp();
 insert into private.simple_signup_handoffs(key_hash,cipher) values(p_key_hash,p_cipher);
end $$;
create function public.abandon_simple_signup_admission(p_id uuid) returns void
language sql security definer set search_path='' as $$
 delete from private.simple_signup_admissions where id=p_id;
$$;
create function public.consume_simple_signup_handoff(p_key_hash text) returns text
language plpgsql security definer set search_path='' as $$
declare result text;
begin
 delete from private.simple_signup_handoffs where key_hash=p_key_hash and expires_at>clock_timestamp() returning cipher into result;
 delete from private.simple_signup_handoffs where expires_at<clock_timestamp();
 return result;
end $$;
-- Expired ciphertext is unusable immediately. Schedule this purge in hosted rollout
-- (at least hourly) for removal even when no one signs in; no expiry-only deletion claim.
create function public.purge_simple_signup_transients() returns void
language sql security definer set search_path='' as $$
 delete from private.simple_signup_admissions where expires_at<clock_timestamp();
 delete from private.simple_signup_handoffs where expires_at<clock_timestamp();
$$;
revoke all on function private.apply_simple_signup_admission() from public,anon,authenticated;
revoke all on function public.check_simple_signup_admission(jsonb) from public,anon,authenticated,service_role;
grant execute on function public.check_simple_signup_admission(jsonb) to supabase_auth_admin;
revoke all on function public.issue_simple_signup_admission(text,text,jsonb),public.finish_simple_signup_admission(uuid,uuid),
 public.store_simple_signup_handoff(text,text),public.consume_simple_signup_handoff(text),public.purge_simple_signup_transients(),public.abandon_simple_signup_admission(uuid) from public,anon,authenticated;
grant execute on function public.issue_simple_signup_admission(text,text,jsonb),public.finish_simple_signup_admission(uuid,uuid),
 public.store_simple_signup_handoff(text,text),public.consume_simple_signup_handoff(text),public.purge_simple_signup_transients(),public.abandon_simple_signup_admission(uuid) to service_role;
