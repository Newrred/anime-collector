-- Additive, opt-in rollout. A signup receipt is not verified age or image rights.
alter table private.memory_publication_settings
 add column signup_declaration_required boolean not null default false;

create or replace function private.require_publication_writer() returns uuid
language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_publication_writer_v1(); p private.simple_signup_policy;
begin
 if exists(select 1 from private.memory_account_sanctions where user_id=u and active) then
  raise exception 'PUBLICATION_RESTRICTED';
 end if;
 -- Keep policy stable through publication. Withdrawal, read, block, report,
 -- export and private sync deliberately do not use this check.
 if (select signup_declaration_required from private.memory_publication_settings where singleton for share) then
  select * into p from private.simple_signup_policy where singleton for share;
  if not found or not p.enabled then raise exception 'PUBLIC_SIGNUP_UNAVAILABLE'; end if;
  perform 1 from private.simple_signup_declarations d
   join private.simple_signup_countries c on c.country=d.country
   where d.user_id=u and d.policy_version=p.policy_version
    and d.terms_version=p.terms_version and d.privacy_version=p.privacy_version
    and d.minimum_age_at_declaration>=c.minimum_age
   for share of d,c;
  if not found then raise exception 'PUBLIC_SIGNUP_REQUIRED'; end if;
 end if;
 return u;
end $$;
revoke all on function private.require_publication_writer() from public,anon,authenticated;
comment on column private.memory_publication_settings.signup_declaration_required is
 'Enable with reviewed signup policy before public rollout. Missing/old receipts block new public writes, never withdrawal. Not age verification.';
