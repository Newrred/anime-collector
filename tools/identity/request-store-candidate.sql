-- LOCAL prototype. No adult-access or guardian-consent grant; no remote apply.
create schema if not exists private;
create table private.memory_identity_policies (
 purpose text primary key check(purpose in ('ADULT_IDENTITY','GUARDIAN_IDENTITY')),
 enabled boolean not null default false, revision text not null default 'UNCONFIGURED',
 provider text, channel text, ttl_seconds integer not null default 300 check(ttl_seconds between 1 and 900),
 daily_limit integer not null default 0 check(daily_limit between 0 and 100)
);
insert into private.memory_identity_policies(purpose) values('ADULT_IDENTITY'),('GUARDIAN_IDENTITY');
create table private.memory_identity_requests (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 session_id uuid not null, purpose text not null references private.memory_identity_policies(purpose),
 provider text not null, channel text not null, policy_revision text not null,
 provider_request_id uuid not null unique default gen_random_uuid(),
 revision bigint not null default 0, status text not null default 'PENDING' check(status in ('PENDING','RECORDED')),
 created_at timestamptz not null default clock_timestamp(), expires_at timestamptz not null, recorded_at timestamptz
);
create index memory_identity_request_owner_time on private.memory_identity_requests(user_id,created_at);
alter table private.memory_identity_policies enable row level security;
alter table private.memory_identity_requests enable row level security;
revoke all on private.memory_identity_policies,private.memory_identity_requests from public,anon,authenticated,service_role;
create function private.memory_identity_request_dto(r private.memory_identity_requests) returns jsonb
language sql immutable set search_path='' as $$
 select jsonb_build_object('id',r.id,'userId',r.user_id,'sessionId',r.session_id,'purpose',r.purpose,
 'provider',r.provider,'channel',r.channel,'policyRevision',r.policy_revision,'providerRequestId',r.provider_request_id,
 'revision',r.revision,'status',r.status,'expiresAt',floor(extract(epoch from r.expires_at)*1000)::bigint)
$$;
revoke all on function private.memory_identity_request_dto(private.memory_identity_requests) from public,anon,authenticated,service_role;
create function public.issue_memory_identity_request(p_user uuid,p_session uuid,p_purpose text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare policy private.memory_identity_policies; r private.memory_identity_requests;
begin
 select * into policy from private.memory_identity_policies where purpose=p_purpose for share;
 if not found or not policy.enabled or policy.revision='UNCONFIGURED' or coalesce(policy.provider,'')='' or coalesce(policy.channel,'')='' then raise exception 'VERIFICATION_POLICY_CHANGED'; end if;
 -- Serialize issuance per account, including separate tabs and sessions.
 perform 1 from auth.users where id=p_user for update;
 if not found then raise exception 'AUTH_REQUIRED'; end if;
 perform 1 from auth.sessions where id=p_session and user_id=p_user and (not_after is null or not_after>clock_timestamp()) for share;
 if not found then raise exception 'AUTH_REQUIRED'; end if;
 select * into r from private.memory_identity_requests where user_id=p_user and session_id=p_session and purpose=p_purpose
 and policy_revision=policy.revision and provider=policy.provider and channel=policy.channel and status='PENDING' and expires_at>clock_timestamp() order by created_at desc limit 1;
 if found then return private.memory_identity_request_dto(r); end if;
 if (select count(*) from private.memory_identity_requests where user_id=p_user and created_at>clock_timestamp()-interval '24 hours')>=policy.daily_limit then raise exception 'VERIFICATION_RATE_LIMITED'; end if;
 insert into private.memory_identity_requests(user_id,session_id,purpose,provider,channel,policy_revision,expires_at)
 values(p_user,p_session,p_purpose,policy.provider,policy.channel,policy.revision,clock_timestamp()+make_interval(secs=>policy.ttl_seconds)) returning * into r;
 return private.memory_identity_request_dto(r);
end $$;
create function public.complete_memory_identity_request(p_expected jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare policy private.memory_identity_policies; r private.memory_identity_requests; expected jsonb;
begin
 select * into policy from private.memory_identity_policies where purpose=p_expected->>'purpose' for share;
 if not found or not policy.enabled then raise exception 'VERIFICATION_POLICY_CHANGED'; end if;
 perform 1 from auth.sessions where id=(p_expected->>'sessionId')::uuid and user_id=(p_expected->>'userId')::uuid and (not_after is null or not_after>clock_timestamp()) for share;
 if not found then raise exception 'AUTH_REQUIRED'; end if;
 select * into r from private.memory_identity_requests where id=(p_expected->>'requestId')::uuid for update;
 if not found then raise exception 'VERIFICATION_NOT_FOUND'; end if;
 expected:=(private.memory_identity_request_dto(r)-'id'-'status')||jsonb_build_object('requestId',r.id);
 if expected is distinct from p_expected then raise exception 'VERIFICATION_REQUEST_CHANGED'; end if;
 if policy.revision<>r.policy_revision or policy.provider is distinct from r.provider or policy.channel is distinct from r.channel then raise exception 'VERIFICATION_POLICY_CHANGED'; end if;
 if r.status<>'PENDING' then raise exception 'VERIFICATION_NOT_PENDING'; end if;
 if clock_timestamp()>=r.expires_at then raise exception 'VERIFICATION_EXPIRED'; end if;
 update private.memory_identity_requests set status='RECORDED',revision=revision+1,recorded_at=clock_timestamp() where id=r.id;
 return jsonb_build_object('requestId',r.id,'status','RECORDED');
end $$;
revoke all on function public.issue_memory_identity_request(uuid,uuid,text),public.complete_memory_identity_request(jsonb) from public,anon,authenticated,service_role;
grant execute on function public.issue_memory_identity_request(uuid,uuid,text),public.complete_memory_identity_request(jsonb) to service_role;
create function public.get_memory_identity_request(p_user uuid,p_session uuid,p_purpose text,p_request uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select private.memory_identity_request_dto(r) from private.memory_identity_requests r
 join auth.sessions s on s.id=r.session_id and s.user_id=r.user_id
 where r.id=p_request and r.user_id=p_user and r.session_id=p_session and r.purpose=p_purpose
 and (s.not_after is null or s.not_after>statement_timestamp())
$$;
create function public.get_memory_identity_policy(p_purpose text) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('enabled',enabled,'revision',revision,'provider',provider,'channel',channel)
 from private.memory_identity_policies where purpose=p_purpose
$$;
revoke all on function public.get_memory_identity_request(uuid,uuid,text,uuid),public.get_memory_identity_policy(text) from public,anon,authenticated,service_role;
grant execute on function public.get_memory_identity_request(uuid,uuid,text,uuid),public.get_memory_identity_policy(text) to service_role;
