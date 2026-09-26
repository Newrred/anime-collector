-- Local prototype only. No issuer API and no implicit grants from identity receipts.
create table private.memory_eligibility_policies (
 purpose text primary key check(purpose in ('CLOUD_WRITE','PUBLIC_PUBLISH','MATURE_VIEW')),
 enabled boolean not null default false,
 revision text not null default 'UNCONFIGURED'
);
insert into private.memory_eligibility_policies(purpose) values ('CLOUD_WRITE'),('PUBLIC_PUBLISH'),('MATURE_VIEW');
create table private.memory_eligibility_evidence (
 user_id uuid not null references auth.users(id) on delete cascade,
 purpose text not null references private.memory_eligibility_policies(purpose),
 policy_revision text not null,
 state text not null check(state in ('REQUIRED','GRANTED','REVOKED')),
 evidence_ref uuid not null,
 expires_at timestamptz not null,
 revision bigint not null default 0 check(revision>=0),
 primary key(user_id,purpose)
);
alter table private.memory_eligibility_policies enable row level security;
alter table private.memory_eligibility_evidence enable row level security;
revoke all on private.memory_eligibility_policies,private.memory_eligibility_evidence from public,anon,authenticated,service_role;

-- Must be called by the owning database operation IN THE SAME transaction as its write.
-- Lock order: policy then evidence. Revocation/renewal writers must use the same order.
-- This is an additional guard, not authentication or an ownership check.
create function private.require_memory_eligibility(p_user uuid,p_purpose text) returns bigint
 language plpgsql security definer set search_path='' as $$
declare p private.memory_eligibility_policies; e private.memory_eligibility_evidence;
begin
 select * into p from private.memory_eligibility_policies where purpose=p_purpose for share;
 if not found or not p.enabled or p.revision='UNCONFIGURED' then raise exception 'ELIGIBILITY_POLICY_UNAVAILABLE'; end if;
 select * into e from private.memory_eligibility_evidence where user_id=p_user and purpose=p_purpose for share;
 if not found then raise exception 'ELIGIBILITY_REQUIRED'; end if;
 if e.policy_revision<>p.revision then raise exception 'ELIGIBILITY_POLICY_CHANGED'; end if;
 if e.state<>'GRANTED' then raise exception 'ELIGIBILITY_REQUIRED'; end if;
 if e.expires_at<=clock_timestamp() then raise exception 'ELIGIBILITY_EXPIRED'; end if;
 return e.revision;
end $$;
revoke all on function private.require_memory_eligibility(uuid,text) from public,anon,authenticated,service_role;
