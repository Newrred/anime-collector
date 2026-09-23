select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
set role authenticated;
select public.prepare_memory_publication('bbbbbbbb-bbbb-4bbb-8bbb-000000000001',7,
 '{"title":"Concurrent public selection","description":"","cards":[{"cardId":"cccccccc-cccc-4ccc-8ccc-000000000002","fields":[]}]}');
