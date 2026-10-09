-- Global reserved-byte ceiling supplements, rather than replaces, owner quotas.
-- Inactive until the release-specific operating budget is configured.
create table private.memory_public_storage_policy (
 singleton boolean primary key default true check(singleton),
 enabled boolean not null default false,
 max_reserved_bytes bigint not null default 0 check(max_reserved_bytes >= 0)
);
insert into private.memory_public_storage_policy(singleton) values(true);
alter table private.memory_public_storage_policy enable row level security;
revoke all on private.memory_public_storage_policy from public,anon,authenticated;

create function private.guard_memory_public_storage_budget() returns trigger
language plpgsql security definer set search_path='' as $$
declare policy private.memory_public_storage_policy%rowtype;
 previous_bytes bigint := 0;
 next_bytes bigint;
 total_bytes bigint;
begin
 if tg_op='UPDATE' and old.state<>'DELETED' then previous_bytes:=old.reserved_bytes; end if;
 next_bytes:=case when new.state='DELETED' then 0 else new.reserved_bytes end;
 if next_bytes<0 then raise exception 'IMAGE_QUOTA_EXCEEDED'; end if;
 -- Completion/retirement must remain possible at capacity. Failed and deleting
 -- rows still reserve space; the existing finalizer releases it after removal.
 if next_bytes<=previous_bytes then return new; end if;
 select * into policy from private.memory_public_storage_policy where singleton;
 if not found then raise exception 'IMAGE_QUOTA_EXCEEDED'; end if;
 if not policy.enabled then return new; end if;
 -- Unlike per-owner reservation locks this also serializes different accounts.
 perform pg_catalog.pg_advisory_xact_lock(20261010,103);
 select coalesce(sum(reserved_bytes),0) into total_bytes
 from private.memory_public_assets where state<>'DELETED';
 if total_bytes-previous_bytes+next_bytes>policy.max_reserved_bytes then
  raise exception 'IMAGE_QUOTA_EXCEEDED';
 end if;
 return new;
end $$;
revoke all on function private.guard_memory_public_storage_budget() from public,anon,authenticated;
create trigger memory_public_storage_budget
before insert or update on private.memory_public_assets
for each row execute function private.guard_memory_public_storage_budget();
