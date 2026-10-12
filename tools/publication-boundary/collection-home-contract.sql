-- Synthetic local fixtures only: zero Memory cards are needed for a public title shelf.
create function pg_temp.ok(value boolean,label text) returns void language plpgsql as $$
begin if value is distinct from true then raise exception 'FAIL: %',label; end if; raise notice 'PASS: %',label; end $$;
create function pg_temp.fails(statement text,expected text) returns void language plpgsql as $$
begin begin execute statement; exception when others then if position(expected in sqlerrm)>0 then raise notice 'PASS: rejects %',expected; return; end if; raise; end; raise exception 'FAIL: expected %',expected; end $$;
insert into auth.users(id) values('13131313-1313-4131-8131-131313131313'),('14141414-1414-4141-8141-141414141414');
insert into public.catalog_releases(id,profile,schema_version,policy_version,release_hash,target_count,people_page_count,status)
 values('collection-test','synthetic',2,'TEST_ONLY',repeat('c',64),1,0,'STAGING');
insert into public.catalog_assets(release_id,asset_id,anime_id,kind,availability,rights_basis,source_provider,bucket_id,object_path,checksum,byte_size,width,height,mime_type,row_hash)
 values('collection-test','asset:'||repeat('c',40),'anime:15151515-1515-4151-8151-151515151515','COVER_IMAGE','PREVIEW_STORAGE','USER_CONFIRMED_PREVIEW_PERMISSION','ANILIST','catalog-covers-preview','covers/anime-15151515-1515-4151-8151-151515151515/'||repeat('c',64)||'.png',repeat('c',64),100,200,300,'image/png',repeat('c',64));
insert into public.catalog_anime_search(release_id,anime_id,anilist_id,preferred_title,preferred_locale,search_text,readiness,cover_asset_id,row_hash)
 values('collection-test','anime:15151515-1515-4151-8151-151515151515',1313,'Synthetic title','en','synthetic','READY','asset:'||repeat('c',40),repeat('c',64));
insert into public.catalog_active_release(singleton,release_id) values(true,'collection-test') on conflict(singleton) do update set release_id=excluded.release_id;
select private.capture_catalog_cover_revisions('collection-test');
update private.memory_publication_settings set reads_enabled=true,writes_enabled=true,minihomes_enabled=true,
 policy_revision='TEST_ONLY',content_policy_revision='TEST_ONLY',general_publication_policy_revision='TEST_ONLY';
set role authenticated;
select set_config('request.jwt.claim.sub','13131313-1313-4131-8131-131313131313',false);
select public.apply_title_sync_entity('bookshelf','default','{"shelves":[{"id":"shelf-a","name":"PRIVATE SHELF NAME","titleKeys":["ANILIST:1313"]}],"layoutVersion":1,"sections":[{"kind":"TITLE_SHELF","sourceId":"shelf-a"}]}',0,false,gen_random_uuid());
select pg_temp.ok(public.list_memory_minihome_shelves()->>'enabled'='false','new public type defaults off');
reset role;
update private.memory_publication_settings set collection_home_enabled=true;
set role authenticated;
select set_config('test.shelf',(public.list_memory_minihome_shelves()->'shelves'->0)::text,false);
select set_config('test.selection',jsonb_build_object('schemaVersion',2,'nickname','Synthetic collection','bio','Public intro','entries',jsonb_build_array(jsonb_build_object('kind','TITLE_SHELF','sourceId','shelf-a','sourceVersion',1,'title','Public shelf','titles',jsonb_build_array(jsonb_build_object('titleKey','ANILIST:1313','animeId','anime:15151515-1515-4151-8151-151515151515','revisionId','asset:'||repeat('c',40),'catalogTitle','Synthetic title')))))::text,false);
select set_config('test.preview',public.prepare_memory_minihome(0,current_setting('test.selection')::jsonb)::text,false);
select set_config('test.home',current_setting('test.preview')::jsonb->>'id',false);
select pg_temp.ok(public.get_memory_minihome()->'selection'=current_setting('test.selection')::jsonb,'owner draft hydration preserves typed selection');
select pg_temp.ok(public.publish_memory_minihome(1,current_setting('test.preview')::jsonb->>'reviewHash','TEST_ONLY',gen_random_uuid())->>'published'='true','Memory0 title shelf publishes without fake Memory');
set role anon;
select pg_temp.ok(public.read_memory_minihome(current_setting('test.home')::uuid)-'id'=current_setting('test.preview')::jsonb->'snapshot','anonymous title shelf equals reviewed projection');
select pg_temp.ok(position('PRIVATE' in public.read_memory_minihome(current_setting('test.home')::uuid)::text)=0,'private shelf name and source metadata do not leak');
select pg_temp.ok(position('shelf-a' in public.read_memory_minihome(current_setting('test.home')::uuid)::text)=0,'private shelf ID is replaced by a stable public projection ID');
select pg_temp.fails('select public.list_memory_minihome_shelves()','permission denied');
select pg_temp.fails('select * from public.user_title_sync_entities','permission denied');
set role authenticated;
select set_config('request.jwt.claim.sub','14141414-1414-4141-8141-141414141414',false);
select pg_temp.ok(jsonb_array_length(public.list_memory_minihome_shelves()->'shelves')=0,'B cannot select A private shelves');
select pg_temp.fails($q$select public.prepare_memory_minihome(0,current_setting('test.selection')::jsonb)$q$,'PREVIEW_CHANGED');
select set_config('request.jwt.claim.sub','13131313-1313-4131-8131-131313131313',false);
select pg_temp.fails($q$select public.apply_title_sync_entity('bookshelf','default','{"shelves":[]}',1,false,gen_random_uuid())$q$,'COLLECTION_CLIENT_UPDATE_REQUIRED');
select pg_temp.fails($q$select public.apply_title_sync_entity('bookshelf','default','{}',1,true,gen_random_uuid())$q$,'COLLECTION_CLIENT_UPDATE_REQUIRED');
select pg_temp.fails($q$select public.apply_title_sync_entity('bookshelf','default','{"shelves":[],"layoutVersion":1,"sections":[{"kind":"UNKNOWN","sourceId":"x"}]}',1,false,gen_random_uuid())$q$,'COLLECTION_LAYOUT_INVALID');
select pg_temp.fails($q$select public.prepare_memory_minihome(2,'{"nickname":"Old client","bio":"","entries":[{"publicationId":"13131313-1313-4131-8131-131313131313"}]}')$q$,'NOT_FOUND');
select set_config('test.preview',public.prepare_memory_minihome(2,current_setting('test.selection')::jsonb)::text,false);
select public.apply_title_sync_entity('bookshelf','default','{"shelves":[{"id":"shelf-a","name":"PRIVATE NEW NAME","titleKeys":["ANILIST:1313"]}],"layoutVersion":1,"sections":[{"kind":"TITLE_SHELF","sourceId":"shelf-a"}]}',1,false,gen_random_uuid());
select pg_temp.fails($q$select public.publish_memory_minihome(3,current_setting('test.preview')::jsonb->>'reviewHash','TEST_ONLY',gen_random_uuid())$q$,'PREVIEW_CHANGED');
set role anon;
select pg_temp.ok(jsonb_array_length(public.read_memory_minihome(current_setting('test.home')::uuid)->'entries')=0,'private source changes never silently refresh or resurrect public shelves');
reset role;
select pg_temp.ok((select count(*)=0 from public.memory_cards where user_id='13131313-1313-4131-8131-131313131313'),'title sharing never creates fake Memory');
-- Add an independent public Board only after the Memory0 assertion above.
begin;
insert into public.memory_boards(id,user_id,title,description,client_updated_at) values('16161616-1616-4161-8161-161616161616','13131313-1313-4131-8131-131313131313','PRIVATE BOARD','PRIVATE DESCRIPTION',now());
insert into public.memory_cards(id,user_id,catalog_anime_id,title_snapshot,status,note,client_updated_at) values('17171717-1717-4171-8171-171717171717','13131313-1313-4131-8131-131313131313','anime:15151515-1515-4151-8151-151515151515','Catalog memory','COMPLETE_PRIVATE','PRIVATE NOTE',now());
insert into public.memory_board_cards(id,user_id,board_id,card_id,position_key,client_updated_at) values(gen_random_uuid(),'13131313-1313-4131-8131-131313131313','16161616-1616-4161-8161-161616161616','17171717-1717-4171-8171-171717171717','a',now());
insert into public.memory_visual_assets(id,user_id,card_id,asset_type,state,storage_scope,rights_basis,is_current,client_updated_at,catalog_cover_id,catalog_cover_revision_id,catalog_anime_id,permission_verified_at)
 select gen_random_uuid(),'13131313-1313-4131-8131-131313131313','17171717-1717-4171-8171-171717171717','CATALOG_COVER','READY','CATALOG_MANAGED','EXPLICIT_PERMISSION',true,now(),catalog_cover_id,catalog_cover_revision_id,catalog_anime_id,permission_verified_at from public.catalog_cover_revisions where catalog_cover_revision_id='asset:'||repeat('c',40);
commit;
set role authenticated;
select set_config('test.boardpreview',public.prepare_memory_publication('16161616-1616-4161-8161-161616161616',0,'{"title":"Public Board","description":"","cards":[{"cardId":"17171717-1717-4171-8171-171717171717","fields":[]}]}')::text,false);
select set_config('test.publication',current_setting('test.boardpreview')::jsonb->>'id',false);
select public.publish_memory_publication(current_setting('test.publication')::uuid,1,current_setting('test.boardpreview')::jsonb->>'reviewHash','TEST_ONLY',gen_random_uuid());
select pg_temp.ok(public.get_memory_publication('16161616-1616-4161-8161-161616161616')->'selection'->>'title'='Public Board','existing Board public selection is restored for the owner');
select set_config('test.selection',jsonb_set(jsonb_set(current_setting('test.selection')::jsonb,'{entries,0,sourceVersion}','2'),'{entries}',jsonb_build_array(jsonb_set(current_setting('test.selection')::jsonb->'entries'->0,'{sourceVersion}','2'),jsonb_build_object('kind','MEMORY_BOARD','publicationId',current_setting('test.publication'))))::text,false);
select set_config('test.preview',public.prepare_memory_minihome(3,current_setting('test.selection')::jsonb)::text,false);
select public.publish_memory_minihome(4,current_setting('test.preview')::jsonb->>'reviewHash','TEST_ONLY',gen_random_uuid());
select pg_temp.fails($q$select public.prepare_memory_minihome(5,jsonb_build_object('nickname','Old client','bio','','entries',jsonb_build_array(jsonb_build_object('publicationId',current_setting('test.publication')))))$q$,'COLLECTION_CLIENT_UPDATE_REQUIRED');
set role anon;
select pg_temp.ok(jsonb_array_length(public.read_memory_minihome(current_setting('test.home')::uuid)->'entries')=2,'same homeId displays both typed sources without replacing Board IDs');
reset role;
update public.catalog_cover_revisions set availability='REPLACE_REQUIRED' where catalog_cover_revision_id='asset:'||repeat('c',40);
set role anon;
select pg_temp.ok(jsonb_array_length(public.read_memory_minihome(current_setting('test.home')::uuid)->'entries')=0,'withdrawn cover rights remove both public placements');
reset role;
update public.catalog_cover_revisions set availability='READY' where catalog_cover_revision_id='asset:'||repeat('c',40);
update private.memory_minihomes set hidden=true where id=current_setting('test.home')::uuid;
set role anon;
select pg_temp.ok(public.read_memory_minihome(current_setting('test.home')::uuid) is null,'moderator hide still applies to typed Collection');
reset role;
update private.memory_minihomes set hidden=false where id=current_setting('test.home')::uuid;
set role authenticated;
select public.revoke_memory_minihome(5);
set role anon;
select pg_temp.ok(public.read_memory_minihome(current_setting('test.home')::uuid) is null,'withdrawal preserves old URL and makes it unreadable');
select pg_temp.ok(public.read_memory_publication(current_setting('test.publication')::uuid) is not null,'home withdrawal leaves independently published Board intact');
reset role;
select pg_temp.ok((select payload->'shelves'->0->>'name'='PRIVATE NEW NAME' from public.user_title_sync_entities where user_id='13131313-1313-4131-8131-131313131313' and entity_kind='bookshelf'),'withdrawal preserves original shelves');
