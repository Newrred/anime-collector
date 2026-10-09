-- Release MOEMOA_PRIVATE_RETIREMENT_20261009_01. Only the missing private-only
-- RPC is installed; do not enable publication or modify user rows/policies.
-- For SQL Editor, inline the exact version-controlled migration at the \ir.
begin isolation level repeatable read;
set local lock_timeout='5s';
create temp table retirement_before on commit drop as
select (select count(*) from public.memory_cards) as cards,
 (select count(*) from private.memory_publication_delete_fences) as fences,
 (select md5(to_jsonb(p)::text) from private.memory_private_media_policy p where id) as policy_hash;
alter table retirement_before enable row level security;
revoke all on retirement_before from public,anon,authenticated;
do $$
begin
  if to_regprocedure('public.retire_memory_card_publications(uuid)') is not null
    or to_regclass('private.memory_publications') is not null
    or to_regclass('private.memory_public_cards') is not null
    or not exists(select 1 from pg_trigger where tgname='memory_private_media_local_delete_fence')
    or exists(select 1 from supabase_migrations.schema_migrations where version='20261009090000') then
    raise exception 'RETIREMENT_ROLLOUT_PREFLIGHT_FAILED';
  end if;
end $$;
\ir ../../supabase/migrations/20261009090000_private_card_retirement_compat.sql
insert into supabase_migrations.schema_migrations(version,name)
values('20261009090000','private_card_retirement_compat');
do $$
begin
  if not exists(select 1 from retirement_before b where
    b.cards=(select count(*) from public.memory_cards)
    and b.fences=(select count(*) from private.memory_publication_delete_fences)
    and b.policy_hash=(select md5(to_jsonb(p)::text) from private.memory_private_media_policy p where id)) then
    raise exception 'RETIREMENT_ROLLOUT_UNEXPECTED_DATA_CHANGE';
  end if;
end $$;
notify pgrst,'reload schema';
select json_build_object('releaseId','MOEMOA_PRIVATE_RETIREMENT_20261009_01',
 'rpcInstalled',to_regprocedure('public.retire_memory_card_publications(uuid)') is not null,
 'anonymousDenied',not has_function_privilege('anon','public.retire_memory_card_publications(uuid)','EXECUTE'),
 'authenticatedAllowed',has_function_privilege('authenticated','public.retire_memory_card_publications(uuid)','EXECUTE'),
 'publicSchemaAbsent',to_regclass('private.memory_publications') is null,
 'sourceRowsAndPolicyUnchanged',true) as retirement_rollout;
commit;
