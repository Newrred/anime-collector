create function pg_temp.ok(value boolean,label text) returns void language plpgsql as $$begin if value is distinct from true then raise exception 'FAIL: %',label;end if;raise notice 'PASS: %',label;end $$;
create function pg_temp.fails(statement text,expected text,label text) returns void language plpgsql as $$begin begin execute statement;exception when others then if position(expected in sqlerrm)>0 then perform pg_temp.ok(true,label);return;end if;raise;end;raise exception 'Unexpected success: %',label;end $$;
insert into auth.users values('77777777-7777-4777-8777-777777777777');
select set_config('request.jwt.claim.sub','77777777-7777-4777-8777-777777777777',false);
set role authenticated;
select public.ensure_user_profile('Synthetic eligibility','en','UTC');
select public.register_user_device('77777777-7777-4777-8777-777777777770','77777777-7777-4777-8777-777777777771','WEB','local-contract');
reset role;
update private.memory_eligibility_policies set enabled=true,revision='LOCAL_ONLY' where purpose='CLOUD_WRITE';
insert into private.memory_eligibility_evidence values('77777777-7777-4777-8777-777777777777','CLOUD_WRITE','LOCAL_ONLY','GRANTED',gen_random_uuid(),clock_timestamp()+interval '1 hour',1);
set role authenticated;
select set_config('test.eligibility.result',public.apply_memory_card_mutation(
 '77777777-7777-4777-8777-777777777772','77777777-7777-4777-8777-777777777770','PRIVATE_TITLE','77777777-7777-4777-8777-777777777773',
 'UPSERT',0,repeat('a',64),'{"displayTitle":"Synthetic title","normalizedTitle":"synthetic title","clientUpdatedAt":"2026-09-27T00:00:00Z"}')::text,false);
select pg_temp.ok(current_setting('test.eligibility.result')::jsonb->>'status'='APPLIED','eligible public RPC writes actual private title');
reset role;
update private.memory_eligibility_evidence set state='REVOKED',revision=2;
set role authenticated;
select pg_temp.fails($q$select public.apply_memory_card_mutation(
 '77777777-7777-4777-8777-777777777774','77777777-7777-4777-8777-777777777770','PRIVATE_TITLE','77777777-7777-4777-8777-777777777773',
 'UPSERT',1,repeat('b',64),'{"displayTitle":"Changed","normalizedTitle":"changed","clientUpdatedAt":"2026-09-27T00:00:00Z"}')$q$,'ELIGIBILITY_REQUIRED','revocation rejects new RPC write');
select pg_temp.ok(public.apply_memory_card_mutation(
 '77777777-7777-4777-8777-777777777772','77777777-7777-4777-8777-777777777770','PRIVATE_TITLE','77777777-7777-4777-8777-777777777773',
 'UPSERT',0,repeat('a',64),'{"displayTitle":"Synthetic title","normalizedTitle":"synthetic title","clientUpdatedAt":"2026-09-27T00:00:00Z"}')=current_setting('test.eligibility.result')::jsonb,'revoked owner can recover exact prior result');
select pg_temp.ok(public.apply_memory_card_mutation(
 '77777777-7777-4777-8777-777777777772','77777777-7777-4777-8777-777777777770','PRIVATE_TITLE','77777777-7777-4777-8777-777777777773',
 'UPSERT',0,repeat('b',64),'{}')->>'status'='REJECTED','changed replay hash stays rejected');
select pg_temp.ok(public.apply_memory_card_mutation(
 '77777777-7777-4777-8777-777777777775','77777777-7777-4777-8777-777777777770','PRIVATE_TITLE','77777777-7777-4777-8777-777777777773',
 'DELETE',1,repeat('c',64),'{}')->>'status'='APPLIED','revoked owner can delete existing title');
reset role;
select pg_temp.ok((select deleted_at is not null and version=2 from public.memory_private_titles where id='77777777-7777-4777-8777-777777777773'),'actual record tombstone and version preserved');
select pg_temp.ok((select count(*)=2 from public.sync_operations where user_id='77777777-7777-4777-8777-777777777777'),'denied write and retries add no operations');
set role authenticated;
select pg_temp.fails($q$select private.apply_memory_mutation_without_eligibility(null,null,null,null,null,null,null,null,'{}')$q$,'permission denied','client cannot bypass guard via renamed implementation');
reset role;
insert into auth.users values('88888888-8888-4888-8888-888888888888');
select set_config('request.jwt.claim.sub','88888888-8888-4888-8888-888888888888',false);
set role authenticated;
select public.ensure_user_profile('Synthetic B','en','UTC');
select public.register_user_device('88888888-8888-4888-8888-888888888880','88888888-8888-4888-8888-888888888881','WEB','local-contract');
select pg_temp.ok(public.apply_memory_card_mutation(
 '88888888-8888-4888-8888-888888888882','88888888-8888-4888-8888-888888888880','PRIVATE_TITLE','77777777-7777-4777-8777-777777777773',
 'DELETE',2,repeat('d',64),'{}')->>'status'='REJECTED','DELETE exemption does not bypass ownership');
select pg_temp.ok(public.apply_memory_card_mutation(
 '77777777-7777-4777-8777-777777777772','88888888-8888-4888-8888-888888888880','PRIVATE_TITLE','77777777-7777-4777-8777-777777777773',
 'UPSERT',0,repeat('a',64),'{}')->>'status'='REJECTED','replay exemption does not expose another account result');
reset role;
-- Exercise MEMORY_CARD separately; a draft is not a complete visual Memory Card.
select set_config('request.jwt.claim.sub','77777777-7777-4777-8777-777777777777',false);
update private.memory_eligibility_evidence set state='GRANTED',revision=3;
set role authenticated;
select set_config('test.card.payload','{"catalogAnimeId":"anime:77777777-7777-4777-8777-777777777779","titleSnapshot":"Synthetic draft","status":"DRAFT","note":"synthetic","watchedAtPrecision":"UNKNOWN","emotionTags":[],"visibility":"PRIVATE","clientUpdatedAt":"2026-09-27T00:00:00Z"}',false);
select set_config('test.card.result',public.apply_memory_card_mutation(
 '77777777-7777-4777-8777-777777777776','77777777-7777-4777-8777-777777777770','MEMORY_CARD','77777777-7777-4777-8777-777777777778',
 'UPSERT',0,repeat('1',64),current_setting('test.card.payload')::jsonb)::text,false);
select pg_temp.ok(current_setting('test.card.result')::jsonb->>'status'='APPLIED','eligible RPC creates actual draft card');
reset role;
update private.memory_eligibility_evidence set state='REVOKED',revision=4;
set role authenticated;
select pg_temp.fails($q$select public.apply_memory_card_mutation(
 '77777777-7777-4777-8777-777777777779','77777777-7777-4777-8777-777777777770','MEMORY_CARD','77777777-7777-4777-8777-777777777778',
 'UPSERT',1,repeat('2',64),current_setting('test.card.payload')::jsonb)$q$,'ELIGIBILITY_REQUIRED','revocation rejects actual draft update');
select pg_temp.ok(public.apply_memory_card_mutation(
 '77777777-7777-4777-8777-777777777776','77777777-7777-4777-8777-777777777770','MEMORY_CARD','77777777-7777-4777-8777-777777777778',
 'UPSERT',0,repeat('1',64),current_setting('test.card.payload')::jsonb)=current_setting('test.card.result')::jsonb,'draft replay after revocation preserves receipt');
select pg_temp.ok(public.apply_memory_card_mutation(
 '77777777-7777-4777-8777-777777777780','77777777-7777-4777-8777-777777777770','MEMORY_CARD','77777777-7777-4777-8777-777777777778',
 'DELETE',1,repeat('3',64),'{}')->>'status'='APPLIED','revoked owner deletes draft');
reset role;
select pg_temp.ok((select deleted_at is not null and version=2 from public.memory_cards where id='77777777-7777-4777-8777-777777777778'),'draft deletion writes actual tombstone');
set role authenticated;
select pg_temp.fails($q$select public.promote_guest_memory('77777777-7777-4777-8777-777777777790','77777777-7777-4777-8777-777777777770',
 'guest:77777777-7777-4777-8777-777777777791',repeat('4',64),'{}')$q$,'ELIGIBILITY_REQUIRED','revoked owner cannot create even empty promotion');
reset role;
update private.memory_eligibility_evidence set state='GRANTED',revision=5;
set role authenticated;
select pg_temp.ok(public.promote_guest_memory('77777777-7777-4777-8777-777777777790','77777777-7777-4777-8777-777777777770',
 'guest:77777777-7777-4777-8777-777777777791',repeat('4',64),'{"privateTitles":[{"id":"77777777-7777-4777-8777-777777777792","displayTitle":"Imported synthetic","normalizedTitle":"imported synthetic"}]}')->>'status'='COMPLETED','eligible promotion imports actual title');
select pg_temp.ok(public.apply_board_mutation('77777777-7777-4777-8777-777777777793','77777777-7777-4777-8777-777777777770','MEMORY_BOARD',
 '77777777-7777-4777-8777-777777777794','UPSERT',0,repeat('5',64),'{"title":"Synthetic board","clientUpdatedAt":"2026-09-27T00:00:00Z"}')->>'status'='APPLIED','eligible board RPC writes');
reset role;
update private.memory_eligibility_evidence set state='REVOKED',revision=6;
set role authenticated;
select pg_temp.ok(public.promote_guest_memory('77777777-7777-4777-8777-777777777790','77777777-7777-4777-8777-777777777770',
 'guest:77777777-7777-4777-8777-777777777791',repeat('4',64),'{}')->>'status'='COMPLETED','revoked owner recovers completed promotion');
select pg_temp.fails($q$select public.promote_guest_memory('77777777-7777-4777-8777-777777777790','77777777-7777-4777-8777-777777777770',
 'guest:77777777-7777-4777-8777-777777777791',repeat('6',64),'{}')$q$,'PROMOTION_SOURCE_HASH_MISMATCH','promotion retry preserves hash check');
select pg_temp.fails($q$select public.promote_guest_memory_without_eligibility(null,null,null,null,'{}')$q$,'permission denied','client cannot call unguarded promotion');
select pg_temp.fails($q$select public.apply_board_mutation('77777777-7777-4777-8777-777777777795','77777777-7777-4777-8777-777777777770','MEMORY_BOARD',
 '77777777-7777-4777-8777-777777777794','UPSERT',1,repeat('6',64),'{"title":"Changed"}')$q$,'ELIGIBILITY_REQUIRED','revoked owner cannot update board');
select pg_temp.ok(public.apply_board_mutation('77777777-7777-4777-8777-777777777796','77777777-7777-4777-8777-777777777770','MEMORY_BOARD',
 '77777777-7777-4777-8777-777777777794','DELETE',1,repeat('7',64),'{}')->>'status'='APPLIED','revoked owner deletes board');
reset role;
select pg_temp.ok((select count(*)=1 from public.user_account_promotions where user_id='77777777-7777-4777-8777-777777777777'),'promotion retries do not duplicate ledger');
