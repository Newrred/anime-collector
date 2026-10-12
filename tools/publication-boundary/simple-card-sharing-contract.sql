-- Disposable DB, synthetic data only. Run after public-signup-contract.sql.
create function pg_temp.ok(v boolean,label text) returns void language plpgsql as $$
begin if v is distinct from true then raise exception 'FAIL: %',label; end if; raise notice 'PASS: %',label; end $$;
create function pg_temp.fails(statement text,expected text,label text) returns void language plpgsql as $$
begin begin execute statement; exception when others then if position(expected in sqlerrm)>0 then perform pg_temp.ok(true,label);return;end if;raise;end;raise exception 'Unexpected success: %',label;end $$;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
update private.memory_publication_settings set writes_enabled=true,reads_enabled=true,signup_declaration_required=false,
 policy_revision='LOCAL_SIMPLE',content_policy_revision='LOCAL_SIMPLE',general_publication_policy_revision='LOCAL_SIMPLE';
begin;
insert into public.memory_cards(id,user_id,catalog_anime_id,title_snapshot,status,note,client_updated_at)
select ('cccccccc-cccc-4ccc-8ccc-'||lpad(n::text,12,'0'))::uuid,auth.uid(),'anime:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Synthetic title','COMPLETE_PRIVATE','PRIVATE NOTE',now() from generate_series(1,2)n;
insert into public.memory_visual_assets(id,user_id,card_id,asset_type,state,rights_basis,is_current,client_updated_at,design_spec)
select gen_random_uuid(),auth.uid(),id,'SYSTEM_DESIGN','READY','SYSTEM_GENERATED',true,now(),
 '{"version":1,"templateId":"memory-gradient","titleLayout":"CENTER","paletteId":"blue","patternSeed":"synthetic","genreTokens":[]}' from public.memory_cards;
insert into public.memory_board_cards(id,user_id,board_id,card_id,position_key,client_updated_at)
select gen_random_uuid(),auth.uid(),'bbbbbbbb-bbbb-4bbb-8bbb-000000000001',id,id::text,now() from public.memory_cards;
commit;
select set_config('simple.selection','{"title":"Synthetic sharing","description":"","cards":[{"cardId":"cccccccc-cccc-4ccc-8ccc-000000000001","fields":[]},{"cardId":"cccccccc-cccc-4ccc-8ccc-000000000002","fields":[]}]}',false);
create function pg_temp.publish_board() returns jsonb language plpgsql as $$
declare r jsonb;p jsonb;begin
 r:=public.get_memory_publication('bbbbbbbb-bbbb-4bbb-8bbb-000000000001');
 p:=public.prepare_memory_publication('bbbbbbbb-bbbb-4bbb-8bbb-000000000001',(r->>'revision')::bigint,current_setting('simple.selection')::jsonb);
 return public.publish_memory_publication((p->>'id')::uuid,(p->>'revision')::bigint,p->>'reviewHash',p->>'policyRevision',gen_random_uuid());end $$;
set role authenticated;
select pg_temp.ok(not (public.get_memory_card_sharing('cccccccc-cccc-4ccc-8ccc-000000000001')->>'published')::boolean,'new card starts private');
select pg_temp.publish_board();
select pg_temp.ok((public.get_memory_card_sharing('cccccccc-cccc-4ccc-8ccc-000000000001')->>'visible')::boolean,'published card visible through authoritative reader');
reset role;
insert into public.memory_boards(id,user_id,title,client_updated_at) values('bbbbbbbb-bbbb-4bbb-8bbb-000000000002',auth.uid(),'Second synthetic placement',now());
insert into private.memory_publications(id,user_id,board_id,revision,state,published_snapshot,general_consent_hash,general_consent_policy,policy_revision)
select 'aaaaaaaa-aaaa-4aaa-8aaa-000000000002',user_id,'bbbbbbbb-bbbb-4bbb-8bbb-000000000002',revision,state,published_snapshot,general_consent_hash,general_consent_policy,policy_revision from private.memory_publications where board_id='bbbbbbbb-bbbb-4bbb-8bbb-000000000001';
set role authenticated;
select set_config('simple.preview',public.prepare_memory_publication('bbbbbbbb-bbbb-4bbb-8bbb-000000000001',(public.get_memory_publication('bbbbbbbb-bbbb-4bbb-8bbb-000000000001')->>'revision')::bigint,current_setting('simple.selection')::jsonb)::text,false);
select public.make_memory_card_private('cccccccc-cccc-4ccc-8ccc-000000000001');
select pg_temp.ok(not (public.get_memory_card_sharing('cccccccc-cccc-4ccc-8ccc-000000000001')->>'published')::boolean,'private removes all active card references');
select pg_temp.ok((public.get_memory_card_sharing('cccccccc-cccc-4ccc-8ccc-000000000002')->>'visible')::boolean,'removing one card preserves consent and visibility of the other');
reset role;
select pg_temp.ok((select count(*)=2 from private.memory_publications where jsonb_array_length(published_snapshot->'cards')=1),'all Board placements remove only selected card');
select pg_temp.ok((select count(*)=0 from private.memory_publications p cross join lateral jsonb_array_elements(p.published_snapshot->'cards') c join private.memory_public_cards pc on pc.id::text=c->>'id' where pc.card_id='cccccccc-cccc-4ccc-8ccc-000000000001'),'no remaining snapshot exposes private card');
set role authenticated;
select pg_temp.fails($q$select public.publish_memory_publication((current_setting('simple.preview')::jsonb->>'id')::uuid,(current_setting('simple.preview')::jsonb->>'revision')::bigint,current_setting('simple.preview')::jsonb->>'reviewHash','LOCAL_SIMPLE',gen_random_uuid())$q$,'PUBLICATION_CONFLICT','old pending preview cannot re-expose private card');
select pg_temp.publish_board();
select pg_temp.ok((public.get_memory_card_sharing('cccccccc-cccc-4ccc-8ccc-000000000001')->>'visible')::boolean,'fresh consent permits republishing after private');
reset role;
select pg_temp.ok((select count(*)=2 from public.memory_cards where note='PRIVATE NOTE') and (select count(*)=2 from public.memory_visual_assets),'original cards and assets survive visibility changes');
update private.memory_publication_settings set reads_enabled=false,writes_enabled=false;
set role authenticated;
select pg_temp.ok(not(public.get_memory_card_sharing('cccccccc-cccc-4ccc-8ccc-000000000001')->>'visible')::boolean,'kill switch reflected in owner status');
select public.make_memory_card_private('cccccccc-cccc-4ccc-8ccc-000000000001');
select pg_temp.ok(not(public.get_memory_card_sharing('cccccccc-cccc-4ccc-8ccc-000000000001')->>'published')::boolean,'withdrawal remains possible with publishing disabled');
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false);
select pg_temp.fails($q$select public.get_memory_card_sharing('cccccccc-cccc-4ccc-8ccc-000000000002')$q$,'NOT_FOUND','other owner cannot inspect card');
select pg_temp.fails($q$select public.make_memory_card_private('cccccccc-cccc-4ccc-8ccc-000000000002')$q$,'NOT_FOUND','other owner cannot withdraw card');
reset role;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
update private.memory_public_cards set revoked=true,hidden=true where card_id='cccccccc-cccc-4ccc-8ccc-000000000002';
set role authenticated;
select public.make_memory_card_private('cccccccc-cccc-4ccc-8ccc-000000000002');
reset role;
select pg_temp.ok((select revoked and hidden from private.memory_public_cards where card_id='cccccccc-cccc-4ccc-8ccc-000000000002'),'privacy switch never clears retirement or moderation fences');
set role anon;
select pg_temp.fails($q$select public.make_memory_card_private('cccccccc-cccc-4ccc-8ccc-000000000002')$q$,'permission denied','anonymous withdrawal denied');
reset role;

select pg_temp.ok((select proargnames = array['p_id','p_expected_revision','p_review_hash','p_policy_revision','p_operation_id'] from pg_proc where oid='public.publish_memory_publication(uuid,bigint,text,text,uuid)'::regprocedure),'PostgREST publish argument names remain compatible');
