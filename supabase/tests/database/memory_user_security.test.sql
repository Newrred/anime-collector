begin;

create extension if not exists pgtap with schema extensions;

select plan(30);

insert into auth.users (id)
values
  ('11111111-1111-4111-8111-111111111111'),
  ('22222222-2222-4222-8222-222222222222');

insert into public.user_devices (
  id,
  user_id,
  installation_id,
  platform,
  app_version
)
values (
  '11111111-aaaa-4aaa-8aaa-111111111111',
  '11111111-1111-4111-8111-111111111111',
  '11111111-bbbb-4bbb-8bbb-111111111111',
  'WEB',
  'security-test'
);

insert into public.memory_private_titles (
  id,
  user_id,
  display_title,
  normalized_title,
  client_updated_at
)
values (
  '22222222-aaaa-4aaa-8aaa-222222222222',
  '22222222-2222-4222-8222-222222222222',
  'User B title',
  'user b title',
  now()
);

insert into public.memory_cards (
  id,
  user_id,
  catalog_anime_id,
  title_snapshot,
  status,
  watched_at_precision,
  visibility,
  client_updated_at
)
values
  (
    '11111111-cccc-4ccc-8ccc-111111111111',
    '11111111-1111-4111-8111-111111111111',
    'anime:11111111-1111-4111-8111-111111111111',
    'User A card',
    'DRAFT',
    'UNKNOWN',
    'PRIVATE',
    now()
  ),
  (
    '22222222-cccc-4ccc-8ccc-222222222222',
    '22222222-2222-4222-8222-222222222222',
    'anime:22222222-2222-4222-8222-222222222222',
    'User B card',
    'DRAFT',
    'UNKNOWN',
    'PRIVATE',
    now()
  );

select is(
  (select relrowsecurity from pg_class where oid = 'public.user_profiles'::regclass),
  true,
  'user_profiles has RLS enabled'
);
select is(
  (select relrowsecurity from pg_class where oid = 'public.user_devices'::regclass),
  true,
  'user_devices has RLS enabled'
);
select is(
  (select relrowsecurity from pg_class where oid = 'public.user_account_promotions'::regclass),
  true,
  'user_account_promotions has RLS enabled'
);
select is(
  (select relrowsecurity from pg_class where oid = 'public.user_preferences'::regclass),
  true,
  'user_preferences has RLS enabled'
);
select is(
  (select relrowsecurity from pg_class where oid = 'public.memory_private_titles'::regclass),
  true,
  'memory_private_titles has RLS enabled'
);
select is(
  (select relrowsecurity from pg_class where oid = 'public.memory_cards'::regclass),
  true,
  'memory_cards has RLS enabled'
);
select is(
  (select relrowsecurity from pg_class where oid = 'public.memory_visual_assets'::regclass),
  true,
  'memory_visual_assets has RLS enabled'
);
select is(
  (select relrowsecurity from pg_class where oid = 'public.memory_boards'::regclass),
  true,
  'memory_boards has RLS enabled'
);
select is(
  (select relrowsecurity from pg_class where oid = 'public.memory_board_cards'::regclass),
  true,
  'memory_board_cards has RLS enabled'
);
select is(
  (select relrowsecurity from pg_class where oid = 'public.sync_operations'::regclass),
  true,
  'sync_operations has RLS enabled'
);
select is(
  (select relrowsecurity from pg_class where oid = 'public.sync_changes'::regclass),
  true,
  'sync_changes has RLS enabled'
);

set local role anon;
select throws_ok(
  $$ select * from public.memory_cards $$,
  '42501',
  'permission denied for table memory_cards',
  'anonymous users cannot read memory cards'
);

set local role authenticated;
set local "request.jwt.claims" = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';

select is(
  (select count(*)::integer from public.memory_cards),
  1,
  'user A reads only one owned card'
);
select is(
  (select count(*)::integer from public.memory_cards where user_id = '22222222-2222-4222-8222-222222222222'),
  0,
  'user A cannot read user B cards'
);
select throws_ok(
  $$
    insert into public.memory_cards (
      id,
      user_id,
      catalog_anime_id,
      title_snapshot,
      status,
      watched_at_precision,
      visibility,
      client_updated_at
    ) values (
      '11111111-dddd-4ddd-8ddd-111111111111',
      '11111111-1111-4111-8111-111111111111',
      'anime:33333333-3333-4333-8333-333333333333',
      'Direct insert',
      'DRAFT',
      'UNKNOWN',
      'PRIVATE',
      now()
    )
  $$,
  '42501',
  'permission denied for table memory_cards',
  'authenticated users cannot directly insert memory rows'
);
select is(
  (select count(*)::integer from public.memory_private_titles where id = '22222222-aaaa-4aaa-8aaa-222222222222'),
  0,
  'user A cannot read user B private titles'
);
select is(
  (
    select public.apply_memory_card_mutation(
      '11111111-eeee-4eee-8eee-111111111111',
      '11111111-aaaa-4aaa-8aaa-111111111111',
      'MEMORY_CARD',
      '11111111-ffff-4fff-8fff-111111111111',
      'UPSERT',
      0,
      repeat('a', 64),
      jsonb_build_object(
        'privateTitleId', '22222222-aaaa-4aaa-8aaa-222222222222',
        'titleSnapshot', 'Cross-owner reference',
        'status', 'DRAFT',
        'watchedAtPrecision', 'UNKNOWN',
        'visibility', 'PRIVATE',
        'clientUpdatedAt', now()
      )
    ) ->> 'errorCode'
  ),
  'FOREIGN_OWNER_REFERENCE',
  'user A cannot reference user B private title'
);

set local role anon;
set local "request.jwt.claims" = '{"role":"anon"}';

select throws_ok(
  $$ select public.ensure_user_profile() $$,
  '42501',
  'permission denied for function ensure_user_profile',
  'anon cannot execute ensure_user_profile'
);
select throws_ok(
  $$ select public.register_user_device(
    'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa',
    'aaaaaaaa-2222-4222-8222-aaaaaaaaaaaa',
    'WEB',
    'security-test'
  ) $$,
  '42501',
  'permission denied for function register_user_device',
  'anon cannot execute register_user_device'
);
select throws_ok(
  $$ select public.promote_guest_memory(
    'aaaaaaaa-3333-4333-8333-aaaaaaaaaaaa',
    'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa',
    'guest:aaaaaaaa-4444-4444-8444-aaaaaaaaaaaa',
    repeat('a', 64),
    '{}'::jsonb
  ) $$,
  '42501',
  'permission denied for function promote_guest_memory',
  'anon cannot execute promote_guest_memory'
);
select throws_ok(
  $$ select public.apply_memory_card_mutation(
    'aaaaaaaa-5555-4555-8555-aaaaaaaaaaaa',
    'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa',
    'MEMORY_CARD',
    'aaaaaaaa-6666-4666-8666-aaaaaaaaaaaa',
    'UPSERT',
    0,
    repeat('b', 64),
    '{}'::jsonb
  ) $$,
  '42501',
  'permission denied for function apply_memory_card_mutation',
  'anon cannot execute card mutation RPC'
);
select throws_ok(
  $$ select public.apply_board_mutation(
    'aaaaaaaa-7777-4777-8777-aaaaaaaaaaaa',
    'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa',
    'MEMORY_BOARD',
    'aaaaaaaa-8888-4888-8888-aaaaaaaaaaaa',
    'UPSERT',
    0,
    repeat('c', 64),
    '{}'::jsonb
  ) $$,
  '42501',
  'permission denied for function apply_board_mutation',
  'anon cannot execute board mutation RPC'
);
select throws_ok(
  $$ select public.pull_memory_changes() $$,
  '42501',
  'permission denied for function pull_memory_changes',
  'anon cannot execute pull_memory_changes'
);
select throws_ok(
  $$ select public.resolve_memory_conflict(
    'aaaaaaaa-9999-4999-8999-aaaaaaaaaaaa',
    'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa',
    'MEMORY_CARD',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    1,
    repeat('d', 64),
    '{}'::jsonb
  ) $$,
  '42501',
  'permission denied for function resolve_memory_conflict',
  'anon cannot execute conflict resolution RPC'
);

reset role;
reset "request.jwt.claims";

select is(
  (
    select count(*)::integer
    from unnest(array[
      'public.user_profiles',
      'public.user_devices',
      'public.user_account_promotions',
      'public.user_preferences',
      'public.memory_private_titles',
      'public.memory_cards',
      'public.memory_visual_assets',
      'public.memory_boards',
      'public.memory_board_cards',
      'public.sync_operations',
      'public.sync_changes'
    ]) as owned_table(table_name)
    where has_table_privilege('authenticated', table_name, 'SELECT')
  ),
  11,
  'authenticated has SELECT on all eleven owner tables'
);
select is(
  (
    select count(*)::integer
    from unnest(array[
      'public.user_profiles',
      'public.user_devices',
      'public.user_account_promotions',
      'public.user_preferences',
      'public.memory_private_titles',
      'public.memory_cards',
      'public.memory_visual_assets',
      'public.memory_boards',
      'public.memory_board_cards',
      'public.sync_operations',
      'public.sync_changes'
    ]) as owned_table(table_name)
    where has_table_privilege('authenticated', table_name, 'INSERT')
       or has_table_privilege('authenticated', table_name, 'UPDATE')
       or has_table_privilege('authenticated', table_name, 'DELETE')
  ),
  0,
  'authenticated has no direct write grant on owner tables'
);
select is(
  (
    select count(distinct routine_name)::integer
    from information_schema.routine_privileges
    where specific_schema = 'public'
      and grantee = 'authenticated'
      and privilege_type = 'EXECUTE'
      and routine_name in (
        'ensure_user_profile',
        'register_user_device',
        'promote_guest_memory',
        'apply_memory_card_mutation',
        'apply_board_mutation',
        'pull_memory_changes',
        'resolve_memory_conflict'
      )
  ),
  7,
  'authenticated can execute exactly the seven memory RPC names'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.purge_expired_memory_tombstones(timestamp with time zone)',
    'EXECUTE'
  ),
  'authenticated has no retention maintenance execute privilege'
);
select ok(
  has_table_privilege('anon', 'public.catalog_anime_search', 'SELECT'),
  'catalog anonymous read grant remains unchanged'
);

set local role authenticated;
set local "request.jwt.claims" = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
select throws_ok(
  $$ select public.purge_expired_memory_tombstones(now()) $$,
  '42501',
  'permission denied for function purge_expired_memory_tombstones',
  'authenticated cannot invoke retention maintenance'
);

reset role;
reset "request.jwt.claims";

select * from finish();

rollback;
