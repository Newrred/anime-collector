begin;

create extension if not exists pgtap with schema extensions;

select plan(43);

insert into auth.users (id)
values
  ('31111111-1111-4111-8111-111111111111'),
  ('32222222-2222-4222-8222-222222222222');

set local role authenticated;
set local "request.jwt.claims" = '{"sub":"31111111-1111-4111-8111-111111111111","role":"authenticated"}';

select lives_ok(
  $$ select public.ensure_user_profile('Test A', 'ko-KR', 'Asia/Seoul') $$,
  'ensure_user_profile creates a profile'
);
select lives_ok(
  $$ select public.ensure_user_profile('Ignored duplicate', 'en', 'UTC') $$,
  'ensure_user_profile is safe to call twice'
);
select is(
  (select count(*)::integer from public.user_profiles),
  1,
  'profile initialization creates one profile'
);
select is(
  (select count(*)::integer from public.user_preferences),
  1,
  'profile initialization creates one default preference row'
);

select lives_ok(
  $$ select public.register_user_device(
    '31111111-aaaa-4aaa-8aaa-111111111111',
    '31111111-bbbb-4bbb-8bbb-111111111111',
    'WEB',
    'rpc-test'
  ) $$,
  'user A registers a device'
);

set local "request.jwt.claims" = '{"sub":"32222222-2222-4222-8222-222222222222","role":"authenticated"}';
select lives_ok(
  $$ select public.ensure_user_profile('Test B', 'en', 'UTC') $$,
  'user B initializes a profile'
);
select lives_ok(
  $$ select public.register_user_device(
    '32222222-aaaa-4aaa-8aaa-222222222222',
    '32222222-bbbb-4bbb-8bbb-222222222222',
    'ANDROID',
    'rpc-test'
  ) $$,
  'user B registers a device'
);

set local "request.jwt.claims" = '{"sub":"31111111-1111-4111-8111-111111111111","role":"authenticated"}';
select throws_ok(
  $$ select public.register_user_device(
    '32222222-aaaa-4aaa-8aaa-222222222222',
    '31111111-cccc-4ccc-8ccc-111111111111',
    'WEB',
    'rpc-test'
  ) $$,
  'P0001',
  'DEVICE_OWNERSHIP_CONFLICT',
  'a device ID owned by another user is rejected'
);

create temporary table rpc_results (
  name text primary key,
  result jsonb not null
) on commit drop;

insert into rpc_results (name, result)
select 'private-title-first', public.apply_memory_card_mutation(
  '31111111-1000-4000-8000-111111111111',
  '31111111-aaaa-4aaa-8aaa-111111111111',
  'PRIVATE_TITLE',
  '31111111-1001-4001-8001-111111111111',
  'UPSERT',
  0,
  repeat('a', 64),
  jsonb_build_object(
    'displayTitle', 'First title',
    'normalizedTitle', 'first title',
    'optionalGenres', jsonb_build_array('Action'),
    'clientUpdatedAt', now()
  )
);

insert into rpc_results (name, result)
select 'private-title-replay', public.apply_memory_card_mutation(
  '31111111-1000-4000-8000-111111111111',
  '31111111-aaaa-4aaa-8aaa-111111111111',
  'PRIVATE_TITLE',
  '31111111-1001-4001-8001-111111111111',
  'UPSERT',
  0,
  repeat('a', 64),
  jsonb_build_object(
    'displayTitle', 'First title',
    'normalizedTitle', 'first title',
    'optionalGenres', jsonb_build_array('Action'),
    'clientUpdatedAt', now()
  )
);

select is(
  (select result from rpc_results where name = 'private-title-replay'),
  (select result from rpc_results where name = 'private-title-first'),
  'same operation ID and request hash returns the stored result'
);
select is(
  (select count(*)::integer from public.memory_private_titles where id = '31111111-1001-4001-8001-111111111111'),
  1,
  'idempotent replay does not duplicate the entity'
);
select is(
  (
    select public.apply_memory_card_mutation(
      '31111111-1000-4000-8000-111111111111',
      '31111111-aaaa-4aaa-8aaa-111111111111',
      'PRIVATE_TITLE',
      '31111111-1001-4001-8001-111111111111',
      'UPSERT',
      0,
      repeat('b', 64),
      '{}'::jsonb
    ) ->> 'errorCode'
  ),
  'OPERATION_HASH_MISMATCH',
  'same operation ID with a different hash is rejected'
);
select is(
  (
    select public.apply_memory_card_mutation(
      '31111111-1002-4002-8002-111111111111',
      '31111111-aaaa-4aaa-8aaa-111111111111',
      'PRIVATE_TITLE',
      '31111111-1001-4001-8001-111111111111',
      'UPSERT',
      0,
      repeat('c', 64),
      jsonb_build_object(
        'displayTitle', 'Conflict title',
        'normalizedTitle', 'conflict title',
        'clientUpdatedAt', now()
      )
    ) ->> 'status'
  ),
  'CONFLICT',
  'base version mismatch returns CONFLICT'
);
select is(
  (select version from public.memory_private_titles where id = '31111111-1001-4001-8001-111111111111'),
  1::bigint,
  'a conflict does not change the row version'
);

select is(
  (
    select public.apply_memory_card_mutation(
      '31111111-1003-4003-8003-111111111111',
      '31111111-aaaa-4aaa-8aaa-111111111111',
      'PRIVATE_TITLE',
      '31111111-1001-4001-8001-111111111111',
      'UPSERT',
      1,
      repeat('d', 64),
      jsonb_build_object(
        'displayTitle', 'Updated title',
        'normalizedTitle', 'updated title',
        'optionalGenres', jsonb_build_array('Drama'),
        'clientUpdatedAt', now()
      )
    ) ->> 'status'
  ),
  'APPLIED',
  'a matching base version applies successfully'
);
select is(
  (select version from public.memory_private_titles where id = '31111111-1001-4001-8001-111111111111'),
  2::bigint,
  'successful mutation increments the entity version'
);
select is(
  (
    select public.apply_memory_card_mutation(
      '31111111-1000-4000-8000-111111111111',
      '31111111-aaaa-4aaa-8aaa-111111111111',
      'PRIVATE_TITLE',
      '31111111-1001-4001-8001-111111111111',
      'UPSERT',
      0,
      repeat('a', 64),
      jsonb_build_object(
        'displayTitle', 'First title',
        'normalizedTitle', 'first title',
        'optionalGenres', jsonb_build_array('Action'),
        'clientUpdatedAt', now()
      )
    )
  ),
  (select result from rpc_results where name = 'private-title-first'),
  'an old operation replay stays identical after later entity changes'
);
select is(
  (
    select count(*)::integer
    from public.sync_changes
    where entity_id = '31111111-1001-4001-8001-111111111111'
      and entity_version = 2
  ),
  1,
  'successful mutation appends exactly one matching sync change'
);

select is(
  (
    select public.apply_memory_card_mutation(
      '31111111-1004-4004-8004-111111111111',
      '31111111-aaaa-4aaa-8aaa-111111111111',
      'PRIVATE_TITLE',
      '31111111-1001-4001-8001-111111111111',
      'DELETE',
      2,
      repeat('e', 64),
      jsonb_build_object('clientUpdatedAt', now())
    ) ->> 'status'
  ),
  'APPLIED',
  'delete mutation creates a tombstone'
);
select is(
  (
    select public.apply_memory_card_mutation(
      '31111111-1005-4005-8005-111111111111',
      '31111111-aaaa-4aaa-8aaa-111111111111',
      'PRIVATE_TITLE',
      '31111111-1001-4001-8001-111111111111',
      'UPSERT',
      2,
      repeat('f', 64),
      jsonb_build_object(
        'displayTitle', 'Stale resurrection',
        'normalizedTitle', 'stale resurrection',
        'clientUpdatedAt', now()
      )
    ) ->> 'errorCode'
  ),
  'TOMBSTONE_WINS',
  'stale UPSERT after tombstone is rejected'
);
select is(
  (select version from public.memory_private_titles where id = '31111111-1001-4001-8001-111111111111'),
  3::bigint,
  'tombstone rejection leaves the deleted row unchanged'
);

select lives_ok(
  $$
    select public.apply_memory_card_mutation(
      '31111111-1100-4100-8100-111111111111',
      '31111111-aaaa-4aaa-8aaa-111111111111',
      'MEMORY_CARD',
      '31111111-1101-4101-8101-111111111111',
      'UPSERT',
      0,
      repeat('1', 64),
      jsonb_build_object(
        'catalogAnimeId', 'anime:31111111-1102-4102-8102-111111111111',
        'titleSnapshot', 'Draft card',
        'status', 'DRAFT',
        'note', 'draft',
        'watchedAtPrecision', 'UNKNOWN',
        'emotionTags', jsonb_build_array(),
        'visibility', 'PRIVATE',
        'clientUpdatedAt', now()
      )
    )
  $$,
  'draft card mutation succeeds without an asset'
);
select throws_ok(
  $$
    select public.apply_memory_card_mutation(
      '31111111-1103-4103-8103-111111111111',
      '31111111-aaaa-4aaa-8aaa-111111111111',
      'MEMORY_CARD',
      '31111111-1101-4101-8101-111111111111',
      'UPSERT',
      1,
      repeat('2', 64),
      jsonb_build_object(
        'catalogAnimeId', 'anime:31111111-1102-4102-8102-111111111111',
        'titleSnapshot', 'Invalid complete card',
        'status', 'COMPLETE_PRIVATE',
        'watchedAtPrecision', 'UNKNOWN',
        'emotionTags', jsonb_build_array(),
        'visibility', 'PRIVATE',
        'clientUpdatedAt', now()
      )
    )
  $$,
  'P0001',
  'COMPLETE_CARD_ASSET_REQUIRED',
  'complete card without one current ready asset fails'
);
select is(
  (select status from public.memory_cards where id = '31111111-1101-4101-8101-111111111111'),
  'DRAFT',
  'failed complete transition rolls back the card change'
);
select lives_ok(
  $$
    select public.apply_memory_card_mutation(
      '31111111-1104-4104-8104-111111111111',
      '31111111-aaaa-4aaa-8aaa-111111111111',
      'VISUAL_ASSET',
      '31111111-1105-4105-8105-111111111111',
      'UPSERT',
      0,
      repeat('3', 64),
      jsonb_build_object(
        'cardId', '31111111-1101-4101-8101-111111111111',
        'assetType', 'SYSTEM_DESIGN',
        'state', 'READY',
        'storageScope', 'LOCAL_ONLY',
        'visibility', 'PRIVATE',
        'rightsBasis', 'SYSTEM_GENERATED',
        'designSpec', jsonb_build_object('template', 'classic'),
        'isCurrent', true,
        'clientUpdatedAt', now()
      )
    )
  $$,
  'ready asset mutation succeeds before card completion'
);
select lives_ok(
  $$
    select public.apply_memory_card_mutation(
      '31111111-1106-4106-8106-111111111111',
      '31111111-aaaa-4aaa-8aaa-111111111111',
      'MEMORY_CARD',
      '31111111-1101-4101-8101-111111111111',
      'UPSERT',
      1,
      repeat('4', 64),
      jsonb_build_object(
        'catalogAnimeId', 'anime:31111111-1102-4102-8102-111111111111',
        'titleSnapshot', 'Valid complete card',
        'status', 'COMPLETE_PRIVATE',
        'watchedAtPrecision', 'UNKNOWN',
        'emotionTags', jsonb_build_array(),
        'visibility', 'PRIVATE',
        'clientUpdatedAt', now()
      )
    )
  $$,
  'complete card succeeds after its ready asset exists'
);

select lives_ok(
  $$
    select public.apply_board_mutation(
      '31111111-1200-4200-8200-111111111111',
      '31111111-aaaa-4aaa-8aaa-111111111111',
      'MEMORY_BOARD',
      '31111111-1201-4201-8201-111111111111',
      'UPSERT',
      0,
      repeat('5', 64),
      jsonb_build_object(
        'title', 'Board',
        'description', 'Test board',
        'visibility', 'PRIVATE',
        'clientUpdatedAt', now()
      )
    )
  $$,
  'board mutation accepts the board entity family'
);
select is(
  (
    select public.apply_board_mutation(
      '31111111-1202-4202-8202-111111111111',
      '31111111-aaaa-4aaa-8aaa-111111111111',
      'MEMORY_CARD',
      '31111111-1203-4203-8203-111111111111',
      'UPSERT',
      0,
      repeat('6', 64),
      '{}'::jsonb
    ) ->> 'errorCode'
  ),
  'ENTITY_FAMILY_MISMATCH',
  'board RPC rejects a cross-family entity type'
);
select is(
  (
    select public.resolve_memory_conflict(
      '31111111-1204-4204-8204-111111111111',
      '31111111-aaaa-4aaa-8aaa-111111111111',
      'MEMORY_BOARD',
      '31111111-1201-4201-8201-111111111111',
      1,
      repeat('7', 64),
      jsonb_build_object(
        'title', 'Resolved board',
        'description', 'Resolved',
        'visibility', 'PRIVATE',
        'clientUpdatedAt', now()
      )
    ) ->> 'status'
  ),
  'APPLIED',
  'resolve_memory_conflict applies an explicit resolution'
);

set local "request.jwt.claims" = '{"sub":"32222222-2222-4222-8222-222222222222","role":"authenticated"}';
select lives_ok(
  $$
    select public.apply_board_mutation(
      '32222222-1200-4200-8200-222222222222',
      '32222222-aaaa-4aaa-8aaa-222222222222',
      'MEMORY_BOARD',
      '32222222-1201-4201-8201-222222222222',
      'UPSERT',
      0,
      repeat('8', 64),
      jsonb_build_object(
        'title', 'User B board',
        'description', '',
        'visibility', 'PRIVATE',
        'clientUpdatedAt', now()
      )
    )
  $$,
  'user B creates an independent sync change'
);

set local "request.jwt.claims" = '{"sub":"31111111-1111-4111-8111-111111111111","role":"authenticated"}';
select is(
  jsonb_array_length(public.pull_memory_changes(0, 1) -> 'changes'),
  1,
  'bounded pull returns one caller-owned change'
);
select is(
  (public.pull_memory_changes(0, 1) ->> 'nextSyncSeq')::bigint,
  (public.pull_memory_changes(0, 1) #>> '{changes,0,syncSeq}')::bigint,
  'nextSyncSeq equals the last returned row in a bounded page'
);
select ok(
  (public.pull_memory_changes(0, 1) ->> 'nextSyncSeq')::bigint
    < (select max(sync_seq) from public.sync_changes where user_id = '31111111-1111-4111-8111-111111111111'),
  'bounded nextSyncSeq does not jump to an unreturned later row'
);
select is(
  (
    select count(*)::integer
    from jsonb_array_elements(public.pull_memory_changes(0, 500) -> 'changes') as change_row
    where change_row ->> 'entityId' = '32222222-1201-4201-8201-222222222222'
  ),
  0,
  'pull never returns another users changes'
);

select lives_ok(
  $$
    select public.promote_guest_memory(
      '31111111-1300-4300-8300-111111111111',
      '31111111-aaaa-4aaa-8aaa-111111111111',
      'guest:31111111-1301-4301-8301-111111111111',
      repeat('9', 64),
      jsonb_build_object(
        'privateTitles', jsonb_build_array(),
        'cards', jsonb_build_array(jsonb_build_object(
          'id', '31111111-1302-4302-8302-111111111111',
          'catalogAnimeId', 'anime:31111111-1303-4303-8303-111111111111',
          'titleSnapshot', 'Promoted complete card',
          'status', 'COMPLETE_PRIVATE',
          'watchedAtPrecision', 'UNKNOWN',
          'emotionTags', jsonb_build_array(),
          'visibility', 'PRIVATE',
          'version', 1,
          'clientUpdatedAt', now()
        )),
        'visualAssets', jsonb_build_array(jsonb_build_object(
          'id', '31111111-1304-4304-8304-111111111111',
          'cardId', '31111111-1302-4302-8302-111111111111',
          'assetType', 'SYSTEM_DESIGN',
          'state', 'READY',
          'storageScope', 'LOCAL_ONLY',
          'visibility', 'PRIVATE',
          'rightsBasis', 'SYSTEM_GENERATED',
          'designSpec', jsonb_build_object('template', 'promotion'),
          'isCurrent', true,
          'version', 1,
          'clientUpdatedAt', now()
        )),
        'boards', jsonb_build_array(),
        'boardCards', jsonb_build_array()
      )
    )
  $$,
  'promotion supports card-before-asset insertion in one transaction'
);
select lives_ok(
  $$
    select public.promote_guest_memory(
      '31111111-1305-4305-8305-111111111111',
      '31111111-aaaa-4aaa-8aaa-111111111111',
      'guest:31111111-1301-4301-8301-111111111111',
      repeat('9', 64),
      jsonb_build_object(
        'privateTitles', jsonb_build_array(),
        'cards', jsonb_build_array(),
        'visualAssets', jsonb_build_array(),
        'boards', jsonb_build_array(),
        'boardCards', jsonb_build_array()
      )
    )
  $$,
  'repeating the same guest owner promotion is idempotent'
);
select is(
  (select count(*)::integer from public.memory_cards where id = '31111111-1302-4302-8302-111111111111'),
  1,
  'repeated promotion does not duplicate cards'
);
select throws_ok(
  $$
    select public.promote_guest_memory(
      '31111111-1306-4306-8306-111111111111',
      '31111111-aaaa-4aaa-8aaa-111111111111',
      'guest:31111111-1307-4307-8307-111111111111',
      repeat('a', 64),
      jsonb_build_object('padding', repeat('x', 2097153))
    )
  $$,
  'P0001',
  'PROMOTION_BUNDLE_TOO_LARGE',
  'promotion bundle larger than 2 MiB is rejected'
);

reset role;
reset "request.jwt.claims";

update public.user_profiles
set minimum_retained_sync_seq = (
  select min(sync_seq)
  from public.sync_changes
  where user_id = '31111111-1111-4111-8111-111111111111'
) + 1
where user_id = '31111111-1111-4111-8111-111111111111';

set local role authenticated;
set local "request.jwt.claims" = '{"sub":"31111111-1111-4111-8111-111111111111","role":"authenticated"}';
select is(
  public.pull_memory_changes(0, 200) ->> 'requiresFullResync',
  'true',
  'cursor below the retained watermark requires a full resync'
);
select is(
  jsonb_array_length(public.pull_memory_changes(0, 200) -> 'changes'),
  0,
  'full-resync response never returns a partial change page'
);

reset role;
reset "request.jwt.claims";

insert into public.memory_boards (
  id,
  user_id,
  title,
  description,
  visibility,
  version,
  client_updated_at,
  server_updated_at,
  deleted_at
)
values
  (
    '31111111-1400-4400-8400-111111111111',
    '31111111-1111-4111-8111-111111111111',
    'Old tombstone',
    '',
    'PRIVATE',
    2,
    now() - interval '31 days',
    now() - interval '31 days',
    now() - interval '31 days'
  ),
  (
    '31111111-1401-4401-8401-111111111111',
    '31111111-1111-4111-8111-111111111111',
    'Recent tombstone',
    '',
    'PRIVATE',
    2,
    now() - interval '29 days',
    now() - interval '29 days',
    now() - interval '29 days'
  );

insert into public.sync_changes (
  user_id,
  entity_type,
  entity_id,
  operation_type,
  entity_version,
  changed_at
)
values
  (
    '31111111-1111-4111-8111-111111111111',
    'MEMORY_BOARD',
    '31111111-1400-4400-8400-111111111111',
    'DELETE',
    2,
    now() - interval '31 days'
  ),
  (
    '31111111-1111-4111-8111-111111111111',
    'MEMORY_BOARD',
    '31111111-1401-4401-8401-111111111111',
    'DELETE',
    2,
    now() - interval '29 days'
  );

create temporary table retention_result (result jsonb not null) on commit drop;
insert into retention_result
select public.purge_expired_memory_tombstones(now());

select is(
  (select count(*)::integer from public.memory_boards where id = '31111111-1400-4400-8400-111111111111'),
  0,
  '31-day tombstone is physically purged'
);
select is(
  (select count(*)::integer from public.memory_boards where id = '31111111-1401-4401-8401-111111111111'),
  1,
  '29-day tombstone remains retained'
);
select ok(
  (select minimum_retained_sync_seq > 0 from public.user_profiles where user_id = '31111111-1111-4111-8111-111111111111'),
  'retention advances the user sync watermark'
);
select is(
  (select result ? 'purgedChanges' from retention_result),
  true,
  'retention returns aggregate counts without content rows'
);

select * from finish();

rollback;
