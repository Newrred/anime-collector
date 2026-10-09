-- Additive, default OFF. A self-declaration receipt is NOT an Auth admission hook,
-- verified age, guardian consent, public publishing permission or eligibility grant.
create schema if not exists private;
create table private.simple_signup_policy (
 singleton boolean primary key default true check(singleton),
 enabled boolean not null default false,
 policy_version text not null,
 terms_version text not null,
 privacy_version text not null
);
insert into private.simple_signup_policy values(true,false,'simple-signup-2026-10-09','terms-2026-10-09-draft','privacy-2026-10-09-draft');
create table private.simple_signup_countries (
 country text primary key check(country ~ '^[A-Z]{2}$'),
 minimum_age integer not null check(minimum_age between 13 and 20)
);
-- Existing product decisions and US/UK working baseline; no unreviewed EU-wide fallback.
-- Europe is selectable in the UI, but each country needs its own reviewed row before rollout.
insert into private.simple_signup_countries values('KR',14),('PH',13),('TH',13),('US',13),('GB',13);
create table private.simple_signup_declarations (
 user_id uuid not null references auth.users(id) on delete cascade,
 policy_version text not null,
 country text not null,
 age_band text not null check(age_band in ('UNDER_18','18_PLUS')),
 minimum_age_at_declaration integer not null check(minimum_age_at_declaration between 13 and 20),
 terms_version text not null,
 privacy_version text not null,
 recorded_at timestamptz not null default clock_timestamp(),
 primary key(user_id,policy_version)
);
alter table private.simple_signup_policy enable row level security;
alter table private.simple_signup_countries enable row level security;
alter table private.simple_signup_declarations enable row level security;
revoke all on private.simple_signup_policy,private.simple_signup_countries,private.simple_signup_declarations from public,anon,authenticated;

create function public.get_simple_signup_policy() returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('enabled',p.enabled,'version',p.policy_version,'termsVersion',p.terms_version,
 'privacyVersion',p.privacy_version,'countries',coalesce((select jsonb_agg(jsonb_build_object('country',c.country,'minimumAge',c.minimum_age) order by c.country)
 from private.simple_signup_countries c),'[]'::jsonb))
 from private.simple_signup_policy p where singleton;
$$;
revoke all on function public.get_simple_signup_policy() from public;
grant execute on function public.get_simple_signup_policy() to anon,authenticated;

create function public.record_simple_signup_declaration(p_expected_user_id uuid,p_country text,p_declared_age integer,p_declared_on date,
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
 select c.minimum_age into minimum_age from private.simple_signup_countries c where country=p_country for share;
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
revoke all on function public.record_simple_signup_declaration(uuid,text,integer,date,text,text,text,boolean) from public,anon;
grant execute on function public.record_simple_signup_declaration(uuid,text,integer,date,text,text,text,boolean) to authenticated;
comment on table private.simple_signup_declarations is 'Self-declared age band and terms receipt only. No DOB, identity verification, guardian consent or cloud/public entitlement.';
