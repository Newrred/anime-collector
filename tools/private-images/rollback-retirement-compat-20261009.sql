-- Restore the pre-install missing-RPC state only; retain all deletion fences,
-- cleanup work and source tombstones. Never restore a deleted private photo.
begin;
set local lock_timeout='5s';
do $$
declare implementation text;
begin
  select prosrc into strict implementation from pg_proc
    where oid=to_regprocedure('public.retire_memory_card_publications(uuid)');
  if position('A later public rollout' in implementation)=0
    or to_regclass('private.memory_publications') is not null
    or to_regclass('private.memory_public_cards') is not null then
    raise exception 'RETIREMENT_ROLLBACK_PREFLIGHT_FAILED';
  end if;
end $$;
drop function public.retire_memory_card_publications(uuid);
delete from supabase_migrations.schema_migrations
 where version='20261009090000' and name='private_card_retirement_compat';
notify pgrst,'reload schema';
commit;
