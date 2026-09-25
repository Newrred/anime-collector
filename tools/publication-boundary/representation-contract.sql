-- Synthetic local-only provenance fixture. Never creates real rights approvals.
create function pg_temp.ok(condition boolean,label text) returns void language plpgsql as $$
begin if condition is distinct from true then raise exception 'FAIL: %',label; end if; raise notice 'PASS: %',label; end $$;
create function pg_temp.fails(statement text,expected text,label text) returns void language plpgsql as $$
begin begin execute statement; exception when others then
 if position(expected in sqlerrm)>0 then perform pg_temp.ok(true,label); return; end if;
 raise exception 'Wrong failure for %: %',label,sqlerrm; end; raise exception 'Unexpected success: %',label; end $$;
begin;
update private.memory_publication_settings set reads_enabled=true,writes_enabled=true,images_enabled=true,policy_revision='TEST_ONLY',asset_limit=20,asset_bytes_limit=100000000;
insert into public.memory_boards(id,user_id,title,client_updated_at) values('bbbbbbbb-bbbb-4bbb-8bbb-000000000006','11111111-1111-4111-8111-111111111111','Synthetic private source',now());
insert into public.memory_cards(id,user_id,catalog_anime_id,title_snapshot,status,client_updated_at) values
 ('cccccccc-cccc-4ccc-8ccc-000000000006','11111111-1111-4111-8111-111111111111','anime:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Synthetic card','COMPLETE_PRIVATE',now());
insert into public.memory_board_cards(id,user_id,board_id,card_id,position_key,client_updated_at) values
 (gen_random_uuid(),'11111111-1111-4111-8111-111111111111','bbbbbbbb-bbbb-4bbb-8bbb-000000000006','cccccccc-cccc-4ccc-8ccc-000000000006','a',now());
insert into public.memory_visual_assets(id,user_id,card_id,asset_type,state,is_current,checksum_sha256,mime_type,byte_size,width,height,client_updated_at) values
 ('aaaaaaaa-aaaa-4aaa-8aaa-000000000006','11111111-1111-4111-8111-111111111111','cccccccc-cccc-4ccc-8ccc-000000000006','USER_IMAGE','READY',true,repeat('b',64),'image/png',100,10,10,now());
insert into private.memory_private_media(id,owner_id,asset_id,source_version,operation_id,policy_revision,pipeline,input_hash,main_hash,thumb_hash,main_bytes,thumb_bytes,width,height,state) values
 ('dddddddd-dddd-4ddd-8ddd-000000000006','11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-000000000006',1,gen_random_uuid(),'PRIVATE_TEST','private-webp-v1',repeat('c',64),repeat('d',64),repeat('e',64),100,50,10,10,'READY');
create function pg_temp.reserve_rep(hash text default repeat('d',64),policy text default 'TEST_ONLY') returns jsonb language sql as $$
 select public.reserve_memory_public_asset_from_private('aaaaaaaa-aaaa-4aaa-8aaa-000000000006',1,'ffffffff-ffff-4fff-8fff-000000000006',policy,'dddddddd-dddd-4ddd-8ddd-000000000006',hash)
$$;
grant execute on function pg_temp.reserve_rep(text,text) to authenticated,anon;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
set role authenticated;
select pg_temp.fails('select * from private.memory_representation_public_rights','permission denied','client cannot read raw representation approvals');
select pg_temp.fails('update private.memory_representation_public_rights set revoked_at=null','permission denied','client cannot approve own rendition');
select pg_temp.fails('select pg_temp.reserve_rep()','IMAGE_RIGHTS_REQUIRED','private storage alone is not public approval');
reset role;
insert into private.memory_representation_public_rights(representation_id,user_id,asset_id,source_version,representation_hash,policy_revision,image_type,evidence_ref) values
 ('dddddddd-dddd-4ddd-8ddd-000000000006','11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-000000000006',1,repeat('d',64),'TEST_ONLY','USER_ORIGINAL','SYNTHETIC_ONLY');
set role authenticated;
select pg_temp.fails('select pg_temp.reserve_rep()','IMAGE_RIGHTS_REQUIRED','representation approval does not bypass original source rights gate');
reset role;
insert into private.memory_public_image_rights(user_id,asset_id,source_version,image_type,evidence_ref) values
 ('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-000000000006',1,'USER_ORIGINAL','SYNTHETIC_ONLY');
set role authenticated;
select pg_temp.fails($q$select pg_temp.reserve_rep(repeat('f',64))$q$,'PUBLIC_VISUAL_NOT_READY','wrong rendition hash is rejected');
select pg_temp.fails($q$select pg_temp.reserve_rep(repeat('d',64),'OLD_POLICY')$q$,'IMAGE_RIGHTS_REQUIRED','rights policy mismatch is rejected');
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false);
select pg_temp.fails('select pg_temp.reserve_rep()','PUBLIC_VISUAL_NOT_READY','B cannot use A private source');
set role anon;
select pg_temp.fails('select pg_temp.reserve_rep()','permission denied','anonymous cannot reserve private source');
set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
select set_config('test.rep_asset',(pg_temp.reserve_rep()->>'id'),false);
select pg_temp.fails('select pg_temp.reserve_rep()','ASSET_OPERATION_UNAVAILABLE','in-flight duplicate retains original operation');
reset role;
select pg_temp.ok((select source_hash=repeat('b',64) and representation_hash=repeat('d',64) from private.memory_public_assets where id=current_setting('test.rep_asset')::uuid),'original hash preserved separately from optimized input hash');
update private.memory_representation_public_rights set revoked_at=now() where representation_id='dddddddd-dddd-4ddd-8ddd-000000000006';
set role service_role;
select pg_temp.fails($q$select public.complete_memory_public_asset(current_setting('test.rep_asset')::uuid,repeat('f',64),repeat('a',64),100,50,10,10)$q$,'IMAGE_RIGHTS_REQUIRED','rights revoked during processing denies completion');
reset role;
update private.memory_representation_public_rights set revoked_at=null where representation_id='dddddddd-dddd-4ddd-8ddd-000000000006';
update private.memory_private_media set state='DELETING' where id='dddddddd-dddd-4ddd-8ddd-000000000006';
set role service_role;
select pg_temp.fails($q$select public.complete_memory_public_asset(current_setting('test.rep_asset')::uuid,repeat('f',64),repeat('a',64),100,50,10,10)$q$,'PUBLIC_VISUAL_NOT_READY','private cancellation during processing denies completion');
reset role;
update private.memory_private_media set state='READY' where id='dddddddd-dddd-4ddd-8ddd-000000000006';
set role service_role;
select public.complete_memory_public_asset(current_setting('test.rep_asset')::uuid,repeat('f',64),repeat('a',64),100,50,10,10);
set role authenticated;
select pg_temp.ok(pg_temp.reserve_rep()->>'state'='READY','same representation operation recovers READY');
select set_config('test.rep_preview',public.prepare_memory_publication('bbbbbbbb-bbbb-4bbb-8bbb-000000000006',0,
 '{"title":"Synthetic public","description":"","cards":[{"cardId":"cccccccc-cccc-4ccc-8ccc-000000000006","fields":[]}]}')::text,false);
reset role;
update private.memory_representation_public_rights set revoked_at=now() where representation_id='dddddddd-dddd-4ddd-8ddd-000000000006';
set role authenticated;
select pg_temp.ok(public.resolve_memory_image_preview(current_setting('test.rep_asset')::uuid,'full') is null,'representation rights withdrawal blocks owner preview');
select pg_temp.fails($q$select public.publish_memory_publication((current_setting('test.rep_preview')::jsonb->>'id')::uuid,(current_setting('test.rep_preview')::jsonb->>'revision')::bigint,current_setting('test.rep_preview')::jsonb->>'reviewHash','TEST_ONLY','ffffffff-ffff-4fff-8fff-000000000007')$q$,'IMAGE_RIGHTS_REQUIRED','rights withdrawn after review block publish');
reset role;
update private.memory_representation_public_rights set revoked_at=null where representation_id='dddddddd-dddd-4ddd-8ddd-000000000006';
set role authenticated;
select public.publish_memory_publication((current_setting('test.rep_preview')::jsonb->>'id')::uuid,(current_setting('test.rep_preview')::jsonb->>'revision')::bigint,current_setting('test.rep_preview')::jsonb->>'reviewHash','TEST_ONLY','ffffffff-ffff-4fff-8fff-000000000007');
set role anon;
select pg_temp.ok(jsonb_array_length(public.read_memory_publication((current_setting('test.rep_preview')::jsonb->>'id')::uuid)->'cards')=1,'approved private rendition appears in published snapshot');
reset role;
update private.memory_private_media set state='DELETED' where id='dddddddd-dddd-4ddd-8ddd-000000000006';
set role anon;
select pg_temp.ok(jsonb_array_length(public.read_memory_publication((current_setting('test.rep_preview')::jsonb->>'id')::uuid)->'cards')=1,'private-only copy removal does not implicitly withdraw public copy');
reset role;
update private.memory_representation_public_rights set revoked_at=now() where representation_id='dddddddd-dddd-4ddd-8ddd-000000000006';
set role anon;
select pg_temp.ok(jsonb_array_length(public.read_memory_publication((current_setting('test.rep_preview')::jsonb->>'id')::uuid)->'cards')=0,'representation approval revocation removes visitor card');
set role service_role;
select pg_temp.ok(public.resolve_memory_public_image((current_setting('test.rep_preview')::jsonb->>'id')::uuid,current_setting('test.rep_asset')::uuid,'full') is null,'representation rights withdrawal blocks actual image resolver');
reset role;
rollback;
