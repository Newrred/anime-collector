select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
set role authenticated;
select public.reserve_memory_public_asset((select id from public.memory_visual_assets where card_id='cccccccc-cccc-4ccc-8ccc-000000000002'),1,:'operation'::uuid,'TEST_ONLY');
