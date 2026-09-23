-- Read-only operator checks. Run in the Supabase SQL editor as an administrator.
-- Contains no notes, private Board names, image paths, email addresses, or tokens.
begin read only;

select release_id, updated_at from public.catalog_active_release;
select release_id, count(*) as title_count
from public.catalog_anime_search
where release_id = (select release_id from public.catalog_active_release)
group by release_id;

select c.relname as table_name, c.relrowsecurity as rls_enabled,
  has_table_privilege('anon', c.oid, 'SELECT') as anon_can_select,
  has_table_privilege('authenticated', c.oid, 'INSERT') as authenticated_can_insert,
  has_table_privilege('authenticated', c.oid, 'UPDATE') as authenticated_can_update,
  has_table_privilege('authenticated', c.oid, 'DELETE') as authenticated_can_delete
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
  and c.relname in ('user_profiles', 'memory_cards', 'memory_visual_assets', 'memory_boards', 'memory_board_cards', 'sync_operations');

select p.proname, pg_get_function_identity_arguments(p.oid) as arguments,
  has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_execute,
  has_function_privilege('service_role', p.oid, 'EXECUTE') as service_execute
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname in
  ('activate_catalog_release', 'apply_memory_card_mutation', 'apply_board_mutation', 'promote_guest_memory', 'pull_memory_changes');

-- Legacy social tables should not be assumed to exist or to be launch-ready.
select to_regclass('public.user_follows') as legacy_follows,
  to_regclass('public.user_showcase_public') as legacy_showcase;
rollback;
