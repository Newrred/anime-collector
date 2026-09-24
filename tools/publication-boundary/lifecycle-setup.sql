-- Reset only synthetic fixtures for independent concurrent lifecycle scenarios.
update private.memory_publication_settings set reads_enabled=true,writes_enabled=true,policy_revision='TEST_ONLY';
update private.memory_publication_accounts set hidden=false,write_blocked=false;
delete from private.memory_publication_delete_fences where user_id='11111111-1111-4111-8111-111111111111' and card_id='cccccccc-cccc-4ccc-8ccc-000000000001';
update public.memory_cards set deleted_at=null,status='COMPLETE_PRIVATE' where id='cccccccc-cccc-4ccc-8ccc-000000000001';
update private.memory_public_cards set revoked=false,hidden=false where card_id='cccccccc-cccc-4ccc-8ccc-000000000001';
select revision as revision from private.memory_publications where board_id='bbbbbbbb-bbbb-4bbb-8bbb-000000000001' \gset
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
set role authenticated;
select public.prepare_memory_publication('bbbbbbbb-bbbb-4bbb-8bbb-000000000001',:revision,
  '{"title":"Lifecycle","description":"","cards":[{"cardId":"cccccccc-cccc-4ccc-8ccc-000000000001","fields":[]}]}');
