-- Read-only aggregate preflight. No user IDs, notes, keys or image object paths.
begin read only;
select jsonb_build_object(
  'checkedAt', now(),
  'migrations', (select jsonb_agg(version order by version) from supabase_migrations.schema_migrations),
  'publicSchemaInstalled', to_regclass('private.memory_publication_settings') is not null,
  'resourcePoliciesInstalled', to_regclass('private.memory_resource_policies') is not null,
  'cardClassificationInstalled', exists(select 1 from information_schema.columns where table_schema='public' and table_name='memory_cards' and column_name='classification'),
  'privatePolicy', (select to_jsonb(p)-'id' from private.memory_private_media_policy p where id),
  'privateObjects', (select count(*) from storage.objects where bucket_id='memory-private-representations'),
  'storedBytes', (select coalesce(sum((metadata->>'size')::bigint),0) from storage.objects where bucket_id='memory-private-representations'),
  'reservedBytes', (select coalesce(sum(main_bytes+thumb_bytes),0) from private.memory_private_media where state<>'DELETED'),
  'privateMediaStates', (select jsonb_object_agg(state,n) from (select state,count(*) n from private.memory_private_media group by state) s),
  'retirementFunctionInstalled', to_regprocedure('public.retire_memory_card_publications(uuid)') is not null,
  'databaseBytes', pg_database_size(current_database())
) as preflight;
rollback;
