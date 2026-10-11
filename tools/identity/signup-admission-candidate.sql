-- LOCAL C02 candidate only. No deployment, consent issuer or cloud access grant.
-- The trusted intake/reviewer must supply evidence AFTER the actual consent check.
-- Before User Created runs after OAuth data reaches Auth, not before collection.
create schema if not exists private;
create table private.memory_signup_policy (
 singleton boolean primary key default true check(singleton),
 enabled boolean not null default false,
 revision text not null default 'UNCONFIGURED'
);
insert into private.memory_signup_policy(singleton) values(true);
create table private.memory_signup_admissions (
 email_sha256 text primary key check(email_sha256 ~ '^[a-f0-9]{64}$'),
 request_id uuid not null unique,
 evidence_ref uuid not null,
 policy_revision text not null,
 country text not null check(country in ('KR','PH','TH')),
 purpose text not null check(purpose='ACCOUNT_CREATE'),
 state text not null check(state in ('APPROVED','BOUND','REVOKED')),
 expires_at timestamptz not null,
 bound_user_id uuid unique,
 bound_at timestamptz,
 revoked_at timestamptz,
 check((bound_user_id is null)=(bound_at is null)),
 check(state<>'APPROVED' or bound_user_id is null),
 check(state<>'BOUND' or bound_user_id is not null),
 check((state='REVOKED')=(revoked_at is not null))
);
-- No auth.users FK: the admitted account does not exist at hook time.
alter table private.memory_signup_policy enable row level security;
alter table private.memory_signup_admissions enable row level security;
revoke all on private.memory_signup_policy,private.memory_signup_admissions from public,anon,authenticated,service_role;

create function public.memory_before_user_created(event jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 p private.memory_signup_policy;
 a private.memory_signup_admissions;
 account_id uuid;
 email_hash text;
 denied constant jsonb := '{"error":{"http_code":403,"message":"SIGNUP_APPROVAL_REQUIRED"}}';
begin
 -- app_metadata.provider is supplied by Auth. Never trust user_metadata approval.
 if jsonb_typeof(event) is distinct from 'object'
 or event->'user'->'app_metadata'->>'provider' is distinct from 'google'
 or coalesce(event->'user'->>'is_anonymous','false')<>'false'
 or coalesce(event->'user'->>'id','') !~* '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
 or length(coalesce(event->'user'->>'email','')) not between 3 and 320
 or btrim(event->'user'->>'email') !~ '^[^[:space:]@]+@[^[:space:]@]+$'
 then return denied; end if;
 account_id := (event->'user'->>'id')::uuid;
 email_hash := encode(sha256(convert_to(lower(btrim(event->'user'->>'email')),'UTF8')),'hex');
 -- All future issuer/revoker paths must use this same policy -> admission lock order.
 select * into p from private.memory_signup_policy where singleton for share;
 if not found or not p.enabled or p.revision='UNCONFIGURED' then return denied; end if;
 select * into a from private.memory_signup_admissions where email_sha256=email_hash for update;
 if not found or a.state='REVOKED' or a.policy_revision<>p.revision
 or a.expires_at<=clock_timestamp() then return denied; end if;
 if a.state='BOUND' then
  -- Only an identical Auth retry is idempotent; never transfer approval to another ID.
  if a.bound_user_id=account_id then return '{}'::jsonb; end if;
  return denied;
 end if;
 if exists(select 1 from private.memory_signup_admissions where bound_user_id=account_id) then return denied; end if;
 update private.memory_signup_admissions set state='BOUND',bound_user_id=account_id,bound_at=clock_timestamp()
 where email_sha256=email_hash;
 return '{}'::jsonb;
end $$;
revoke all on function public.memory_before_user_created(jsonb) from public,anon,authenticated,service_role;
-- supabase_auth_admin exists in hosted Auth; the disposable harness creates it explicitly.
grant execute on function public.memory_before_user_created(jsonb) to supabase_auth_admin;
comment on function public.memory_before_user_created(jsonb) is
 'LOCAL ONLY: admission binding is not guardian verification, cloud eligibility, or OAuth pre-collection consent.';
