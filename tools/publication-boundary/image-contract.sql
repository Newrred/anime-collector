-- Real PostgreSQL roles, synthetic auth.uid()/Storage tables; NOT hosted Supabase verification.
create temp table assertions(label text);
grant all on assertions to anon,authenticated,service_role;
create function pg_temp.ok(condition boolean,label text) returns void language plpgsql as $$
begin
 if condition is distinct from true then raise exception 'FAIL: %',label; end if;
 insert into assertions values(label);
 raise notice 'PASS: %',label;
end $$;
create function pg_temp.fails(statement text,expected text,label text) returns void language plpgsql as $$
begin
 begin
  execute statement;
 exception when others then
  if position(expected in sqlerrm)>0 then perform pg_temp.ok(true,label); return; end if;
  raise exception 'Wrong failure for %: %',label,sqlerrm;
 end;
 raise exception 'Unexpected success: %',label;
end $$;
insert into public.user_profiles(user_id,display_name) values('11111111-1111-4111-8111-111111111111','Test A');
update private.memory_publication_settings set reads_enabled=true,writes_enabled=true,images_enabled=true,policy_revision='TEST_ONLY',asset_limit=1,asset_bytes_limit=4194304;
update public.memory_visual_assets set asset_type='USER_IMAGE',storage_scope='LOCAL_ONLY',rights_basis='UNKNOWN',checksum_sha256=repeat('b',64)
 where card_id='cccccccc-cccc-4ccc-8ccc-000000000002';
select set_config('test.source',(select id::text from public.memory_visual_assets where card_id='cccccccc-cccc-4ccc-8ccc-000000000002'),false);
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
set role authenticated;
select pg_temp.fails($q$select public.reserve_memory_public_asset(current_setting('test.source')::uuid,1,'eeeeeeee-eeee-4eee-8eee-000000000001','TEST_ONLY')$q$,'IMAGE_RIGHTS_REQUIRED','rights self-claim cannot authorize public image');
select pg_temp.fails('select * from private.memory_public_image_rights','permission denied','client cannot read rights evidence');
select pg_temp.fails($q$select public.complete_memory_public_asset(null,null,null,null,null,null,null)$q$,'permission denied','client cannot mark unprocessed bytes ready');
select pg_temp.fails($q$select public.resolve_memory_public_image(null,null,'full')$q$,'permission denied','client cannot resolve private storage coordinates');
reset role;
insert into private.memory_public_image_rights(user_id,asset_id,source_version,image_type,evidence_ref)
 values('11111111-1111-4111-8111-111111111111',current_setting('test.source')::uuid,1,'USER_ORIGINAL','test-only-approved');
set role authenticated;
select set_config('test.reservation',public.reserve_memory_public_asset(current_setting('test.source')::uuid,1,'eeeeeeee-eeee-4eee-8eee-000000000001','TEST_ONLY')::text,false);
select pg_temp.ok(current_setting('test.reservation')::jsonb->>'state'='PREPARING','approved image reserves private staging');
select pg_temp.fails($q$select public.reserve_memory_public_asset(current_setting('test.source')::uuid,1,'eeeeeeee-eeee-4eee-8eee-000000000001','TEST_ONLY')$q$,'ASSET_OPERATION_UNAVAILABLE','parallel duplicate does not create second upload');
select pg_temp.fails($q$select public.reserve_memory_public_asset(current_setting('test.source')::uuid,1,'eeeeeeee-eeee-4eee-8eee-000000000002','TEST_ONLY')$q$,'IMAGE_QUOTA_EXCEEDED','pending upload consumes server quota');
select pg_temp.ok(public.resolve_memory_image_preview((current_setting('test.reservation')::jsonb->>'id')::uuid,'full') is null,'preparing image cannot be previewed');
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false);
select pg_temp.fails($q$select public.cancel_memory_public_asset((current_setting('test.reservation')::jsonb->>'id')::uuid)$q$,'NOT_FOUND','B cannot cancel A upload');
select pg_temp.fails($q$select public.reserve_memory_public_asset(current_setting('test.source')::uuid,1,'eeeeeeee-eeee-4eee-8eee-000000000002','TEST_ONLY')$q$,'AUTH_REQUIRED','B cannot reserve A source');
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
select public.cancel_memory_public_asset((current_setting('test.reservation')::jsonb->>'id')::uuid);
set role service_role;
select pg_temp.fails($q$select public.complete_memory_public_asset((current_setting('test.reservation')::jsonb->>'id')::uuid,repeat('c',64),repeat('d',64),100,50,10,10)$q$,'ASSET_OPERATION_UNAVAILABLE','late completed upload cannot revive cancellation');
select pg_temp.ok(jsonb_array_length(public.claim_memory_image_cleanup())=1,'cancelled upload is queued for cleanup');
select public.complete_memory_image_cleanup((current_setting('test.reservation')::jsonb->>'id')::uuid);
reset role;
set role authenticated;
select set_config('test.reservation',public.reserve_memory_public_asset(current_setting('test.source')::uuid,1,'eeeeeeee-eeee-4eee-8eee-000000000002','TEST_ONLY')::text,false);
set role service_role;
select pg_temp.fails($q$select public.complete_memory_public_asset((current_setting('test.reservation')::jsonb->>'id')::uuid,repeat('c',64),repeat('d',64),null,50,10,10)$q$,'INVALID_ASSET','incomplete derivative metadata rejected');
select public.complete_memory_public_asset((current_setting('test.reservation')::jsonb->>'id')::uuid,repeat('c',64),repeat('d',64),100,50,10,10);
select pg_temp.ok(public.resolve_memory_public_image(gen_random_uuid(),(current_setting('test.reservation')::jsonb->>'id')::uuid,'full') is null,'ready image without published placement remains private');
set role authenticated;
select pg_temp.ok(public.reserve_memory_public_asset(current_setting('test.source')::uuid,1,'eeeeeeee-eeee-4eee-8eee-000000000002','TEST_ONLY')->>'id'=current_setting('test.reservation')::jsonb->>'id','ready upload retry reuses same asset');
select pg_temp.ok(public.resolve_memory_image_preview((current_setting('test.reservation')::jsonb->>'id')::uuid,'full') is not null,'owner may preview processed private image');
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false);
select pg_temp.ok(public.resolve_memory_image_preview((current_setting('test.reservation')::jsonb->>'id')::uuid,'full') is null,'B cannot preview A processed image');
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
select set_config('test.preview',public.prepare_memory_publication('bbbbbbbb-bbbb-4bbb-8bbb-000000000001',8,
 '{"title":"Image board","description":"","cards":[{"cardId":"cccccccc-cccc-4ccc-8ccc-000000000002","fields":[]}]}')::text,false);
select public.publish_memory_publication((current_setting('test.preview')::jsonb->>'id')::uuid,9,current_setting('test.preview')::jsonb->>'reviewHash','TEST_ONLY','eeeeeeee-eeee-4eee-8eee-000000000003');
select pg_temp.fails($q$select public.cancel_memory_public_asset((current_setting('test.reservation')::jsonb->>'id')::uuid)$q$,'ASSET_IN_USE','upload cancel cannot remove an already published image');
set role anon;
select pg_temp.ok(public.read_memory_publication((current_setting('test.preview')::jsonb->>'id')::uuid)->'cards'->0->'visual'->>'type'='USER_IMAGE','visitor receives approved derivative reference');
select pg_temp.fails($q$select public.resolve_memory_image_preview(null,'full')$q$,'permission denied','anon cannot call private preview RPC');
set role service_role;
select pg_temp.ok(public.resolve_memory_public_image((current_setting('test.preview')::jsonb->>'id')::uuid,(current_setting('test.reservation')::jsonb->>'id')::uuid,'thumb')->>'path' like '%/thumb.webp','trusted reader resolves thumbnail after current state check');
reset role;
update private.memory_public_assets set expires_at=now()-interval '1 day';
set role service_role;
select pg_temp.ok(jsonb_array_length(public.claim_memory_image_cleanup())=0,'cleanup preserves referenced ready derivative');
reset role;
update private.memory_public_image_rights set revoked_at=now();
set role service_role;
select pg_temp.ok(public.resolve_memory_public_image((current_setting('test.preview')::jsonb->>'id')::uuid,(current_setting('test.reservation')::jsonb->>'id')::uuid,'full') is null,'rights withdrawal immediately blocks full image');
reset role;
update private.memory_public_image_rights set revoked_at=null;
set role authenticated;
select public.revoke_memory_publication((current_setting('test.preview')::jsonb->>'id')::uuid,10);
set role service_role;
select pg_temp.ok(public.resolve_memory_public_image((current_setting('test.preview')::jsonb->>'id')::uuid,(current_setting('test.reservation')::jsonb->>'id')::uuid,'thumb') is null,'revoked board blocks previous thumbnail URL');
select pg_temp.ok(jsonb_array_length(public.claim_memory_image_cleanup())=1,'unreferenced expired derivative becomes cleanup candidate');
reset role;
-- Design publication: no raw seeds, genres or arbitrary input keys leave the boundary.
begin;
insert into public.memory_boards(id,user_id,title,client_updated_at) values('bbbbbbbb-bbbb-4bbb-8bbb-000000000004','11111111-1111-4111-8111-111111111111','Private design board',now());
insert into public.memory_cards(id,user_id,catalog_anime_id,title_snapshot,status,client_updated_at)
 values('cccccccc-cccc-4ccc-8ccc-000000000004','11111111-1111-4111-8111-111111111111','anime:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Design title','COMPLETE_PRIVATE',now());
insert into public.memory_visual_assets(id,user_id,card_id,asset_type,state,rights_basis,is_current,client_updated_at,design_spec)
 values(gen_random_uuid(),'11111111-1111-4111-8111-111111111111','cccccccc-cccc-4ccc-8ccc-000000000004','SYSTEM_DESIGN','READY','SYSTEM_GENERATED',true,now(),
 '{"version":1,"templateId":"memory-gradient","titleLayout":"CENTER","paletteId":"blue","patternSeed":"private-seed","genreTokens":["private-tag"],"extra":"private value"}');
insert into public.memory_board_cards(id,user_id,board_id,card_id,position_key,client_updated_at)
 values(gen_random_uuid(),'11111111-1111-4111-8111-111111111111','bbbbbbbb-bbbb-4bbb-8bbb-000000000004','cccccccc-cccc-4ccc-8ccc-000000000004','a',now());
commit;
set role authenticated;
select set_config('test.design',public.prepare_memory_publication('bbbbbbbb-bbbb-4bbb-8bbb-000000000004',0,
 '{"title":"Public design","description":"","cards":[{"cardId":"cccccccc-cccc-4ccc-8ccc-000000000004","fields":[]}]}')::text,false);
select pg_temp.ok((current_setting('test.design')::jsonb->'snapshot'->'cards'->0->'visual')-array['type','rendererVersion','patternToken']='{}'::jsonb,'design publishes only reproducible render parameters');
select pg_temp.ok(current_setting('test.design') not like '%private%','design does not expose raw private seed or genres');
select pg_temp.ok(current_setting('test.design')::jsonb->'snapshot'->'cards'->0->'visual'->>'patternToken'='8828270b','public design exactly matches existing private renderer token');
reset role;
-- A deliberately broad legacy policy cannot override the restrictive bucket boundary.
grant usage on schema storage to anon,authenticated;
grant select,insert on storage.objects to anon,authenticated;
create policy synthetic_legacy_allow_all on storage.objects for all to anon,authenticated using(true) with check(true);
insert into storage.objects(bucket_id,name) values('memory-public-derivatives','synthetic-private.webp');
set role anon;
select pg_temp.ok((select count(*)=0 from storage.objects where bucket_id='memory-public-derivatives'),'legacy permissive Storage policy cannot expose private derivatives');
select pg_temp.fails($q$insert into storage.objects(bucket_id,name) values('memory-public-derivatives','forged.webp')$q$,'row-level security','direct Storage upload bypass is denied');
reset role;
select pg_temp.ok((select not public from storage.buckets where id='memory-public-derivatives'),'derivative bucket is private');
select count(*) as passed_image_assertions from assertions;
