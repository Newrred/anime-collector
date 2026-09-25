-- Synthetic local PostgreSQL fixtures. No real OAuth or Storage service claim.
create temp table assertions(label text);
grant all on assertions to anon,authenticated,service_role;
create function pg_temp.ok(condition boolean,label text) returns void language plpgsql as $$
begin if condition is distinct from true then raise exception 'FAIL: %',label; end if;
 insert into assertions values(label); raise notice 'PASS: %',label; end $$;
create function pg_temp.fails(statement text,expected text,label text) returns void language plpgsql as $$
begin begin execute statement; exception when others then
 if position(expected in sqlerrm)>0 then perform pg_temp.ok(true,label); return; end if;
 raise exception 'Wrong failure for %: %',label,sqlerrm; end; raise exception 'Unexpected success: %',label; end $$;
begin;
insert into auth.users values('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222');
insert into public.memory_cards(id,user_id,catalog_anime_id,title_snapshot,status,client_updated_at)
 select ('cccccccc-cccc-4ccc-8ccc-'||lpad(n::text,12,'0'))::uuid,'11111111-1111-4111-8111-111111111111',
 'anime:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Synthetic private test','DRAFT',now() from generate_series(1,4) n;
insert into public.memory_visual_assets(id,user_id,card_id,asset_type,state,is_current,checksum_sha256,mime_type,byte_size,width,height,client_updated_at)
 select ('aaaaaaaa-aaaa-4aaa-8aaa-'||lpad(n::text,12,'0'))::uuid,'11111111-1111-4111-8111-111111111111',
 ('cccccccc-cccc-4ccc-8ccc-'||lpad(n::text,12,'0'))::uuid,'USER_IMAGE','READY',true,repeat('a',64),'image/png',500,10,10,now() from generate_series(1,4) n;
commit;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
set role authenticated;
select pg_temp.fails($q$select public.get_memory_private_image_policy('aaaaaaaa-aaaa-4aaa-8aaa-000000000001',1)$q$,'PRIVATE_IMAGE_DISABLED','default policy closed');
select pg_temp.fails('select * from private.memory_private_media','permission denied','raw manifest inaccessible');
select pg_temp.fails('update private.memory_private_media_policy set approved=true','permission denied','user cannot activate policy');
select pg_temp.fails($q$select public.complete_memory_private_image(gen_random_uuid())$q$,'permission denied','user cannot finalize arbitrary bytes');
reset role;
update private.memory_private_media_policy set enabled=true,approved=true,revision='LOCAL_TEST',observed_at=now(),quota_bytes=50000000,physical_bytes=100000000,preparations_per_day=10,decode_attempts_per_day=1,asset_count_max=1000,read_bytes_per_month=1000,global_read_bytes_per_month=10000;
set role authenticated;
select pg_temp.ok((public.get_memory_private_image_policy('aaaaaaaa-aaaa-4aaa-8aaa-000000000001',1)->>'quotaBytes')::bigint=50000000,'owner reads active quota');
select public.authorize_memory_private_image_attempt('aaaaaaaa-aaaa-4aaa-8aaa-000000000001',1,'LOCAL_TEST');
select pg_temp.fails($q$select public.authorize_memory_private_image_attempt('aaaaaaaa-aaaa-4aaa-8aaa-000000000001',1,'LOCAL_TEST')$q$,'PRIVATE_IMAGE_RATE_LIMITED','decode attempts rate limited separately before image processing');
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false);
select pg_temp.fails($q$select public.get_memory_private_image_policy('aaaaaaaa-aaaa-4aaa-8aaa-000000000001',1)$q$,'NOT_FOUND','B cannot inspect A asset');
reset role;
set role anon;
select pg_temp.fails($q$select public.read_memory_private_image('aaaaaaaa-aaaa-4aaa-8aaa-000000000001',1,'main')$q$,'permission denied','anon has no read API');
reset role;
-- Service-role RPC supplies measured bytes; identity belongs to authenticated HTTP user.
update private.memory_private_media_policy set quota_bytes=1000,physical_bytes=1000;
create function pg_temp.reserve(op uuid default 'ffffffff-ffff-4fff-8fff-000000000001',main_size integer default 800,input_hash text default repeat('b',64)) returns jsonb language sql as $$
 select public.reserve_memory_private_image('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-000000000001',1,op,'LOCAL_TEST',input_hash,repeat('c',64),repeat('d',64),main_size,200,10,10)
$$;
grant execute on function pg_temp.reserve(uuid,integer,text) to service_role,authenticated;
set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
select public.cancel_memory_private_image('ffffffff-ffff-4fff-8fff-000000000099');
select public.cancel_memory_private_image('ffffffff-ffff-4fff-8fff-000000000099');
select pg_temp.fails('select pg_temp.reserve()','permission denied','user cannot reserve trusted byte counts');
reset role;
set role service_role;
select pg_temp.fails($q$select pg_temp.reserve('ffffffff-ffff-4fff-8fff-000000000099')$q$,'PRIVATE_IMAGE_RETIRED','cancel before reservation fences delayed upload');
select pg_temp.ok(pg_temp.reserve()->>'state'='PREPARING','server reserves measured main and thumb');
select pg_temp.ok(pg_temp.reserve()->>'state'='PREPARING','same operation replay remains preparing');
select pg_temp.fails($q$select pg_temp.reserve('ffffffff-ffff-4fff-8fff-000000000001',801)$q$,'OPERATION_MISMATCH','replay changed bytes rejected');
select pg_temp.fails($q$select pg_temp.reserve('ffffffff-ffff-4fff-8fff-000000000001',800,repeat('f',64))$q$,'OPERATION_MISMATCH','replay changed input hash rejected');
select pg_temp.fails($q$select pg_temp.reserve('ffffffff-ffff-4fff-8fff-000000000002')$q$,'PRIVATE_IMAGE_CONFLICT','different operation cannot duplicate representation');
select public.complete_memory_private_image((pg_temp.reserve()->>'id')::uuid);
select pg_temp.ok(pg_temp.reserve()->>'state'='READY','lost completion response recovers same ready representation');
reset role;
create function pg_temp.reserve_second() returns jsonb language sql as $$
 select public.reserve_memory_private_image('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-000000000002',1,
 'ffffffff-ffff-4fff-8fff-000000000010','LOCAL_TEST',repeat('b',64),repeat('c',64),repeat('d',64),800,200,10,10)
$$;
grant execute on function pg_temp.reserve_second() to service_role;
set role service_role;
select pg_temp.fails('select pg_temp.reserve_second()','PRIVATE_IMAGE_QUOTA_EXCEEDED','full exact-byte quota rejects another asset');
reset role;
update private.memory_private_media_policy set quota_bytes=50000000;
set role service_role;
select pg_temp.fails('select pg_temp.reserve_second()','PRIVATE_IMAGE_CAPACITY_EXCEEDED','global physical limit rejects independently of owner quota');
reset role;
update private.memory_private_media_policy set physical_bytes=100000000,preparations_per_day=1;
set role service_role;
select pg_temp.fails('select pg_temp.reserve_second()','PRIVATE_IMAGE_RATE_LIMITED','new preparations budget rejects without reservation');
reset role;
update private.memory_private_media_policy set preparations_per_day=10;
select pg_temp.ok((select preparations=1 from private.memory_private_media_meter where owner_id='11111111-1111-4111-8111-111111111111'),'replays do not double preparations');
select pg_temp.ok((select checksum_sha256=repeat('a',64) and storage_scope='LOCAL_ONLY' and cloud_object_path is null from public.memory_visual_assets where id='aaaaaaaa-aaaa-4aaa-8aaa-000000000001'),'original checksum and storage fields unchanged');
select pg_temp.ok((select not public from storage.buckets where id='memory-private-representations'),'private bucket is not public');
select pg_temp.ok(exists(select 1 from pg_policies where schemaname='storage' and policyname='memory_private_media_no_direct_access' and permissive='RESTRICTIVE'),'restrictive bucket policy installed');
select pg_temp.ok(not exists(select 1 from pg_proc f join pg_namespace n on n.oid=f.pronamespace where n.nspname='public' and f.proname like '%memory_private_image%' and has_function_privilege('anon',f.oid,'EXECUTE')),'anonymous execute grants absent on every private image RPC');
grant usage on schema storage to authenticated,anon;
grant select,insert on storage.objects to authenticated,anon;
create policy simulated_old_permissive_policy on storage.objects for all to authenticated,anon using(true) with check(true);
insert into storage.objects(bucket_id,name) values('memory-private-representations','synthetic-object');
set role authenticated;
select pg_temp.ok((select count(*)=0 from storage.objects where bucket_id='memory-private-representations'),'restrictive RLS blocks raw Storage read despite legacy permissive policy');
select pg_temp.fails($q$insert into storage.objects(bucket_id,name) values('memory-private-representations','bypass')$q$,'row-level security','restrictive RLS blocks direct Storage upload');
reset role;
set role anon;
select pg_temp.ok((select count(*)=0 from storage.objects where bucket_id='memory-private-representations'),'anonymous raw Storage read also blocked');
reset role;
drop policy simulated_old_permissive_policy on storage.objects;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
set role authenticated;
select pg_temp.ok((public.read_memory_private_image('aaaaaaaa-aaaa-4aaa-8aaa-000000000001',1,'main')->>'bytes')::int=800,'owner can resolve ready main and charge bytes');
select pg_temp.ok(public.get_memory_private_image_policy('aaaaaaaa-aaaa-4aaa-8aaa-000000000001',1)->'representation'->>'mainHash'=repeat('c',64),'owner policy exposes verified ready hash');
select pg_temp.ok(not (public.get_memory_private_image_policy('aaaaaaaa-aaaa-4aaa-8aaa-000000000001',1)->'representation' ?| array['ownerId','mainPath','inputHash']),'owner policy does not expose internal paths or ownership fields');
select public.revoke_memory_card_publications('cccccccc-cccc-4ccc-8ccc-000000000001');
select pg_temp.ok(public.get_memory_private_image_policy('aaaaaaaa-aaaa-4aaa-8aaa-000000000001',1)->'representation'->>'state'='READY','public withdrawal preserves private image copy');
select pg_temp.fails($q$select public.read_memory_private_image('aaaaaaaa-aaaa-4aaa-8aaa-000000000001',1,'main')$q$,'PRIVATE_IMAGE_RATE_LIMITED','monthly owner delivery budget enforced');
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false);
select pg_temp.fails($q$select public.read_memory_private_image('aaaaaaaa-aaaa-4aaa-8aaa-000000000001',1,'main',false)$q$,'NOT_FOUND','B cannot resolve even uncharged read');
reset role;
update private.memory_private_media_policy set paused=true;
set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
select pg_temp.fails($q$select public.read_memory_private_image('aaaaaaaa-aaaa-4aaa-8aaa-000000000001',1,'thumb')$q$,'PRIVATE_IMAGE_PAUSED','paused policy blocks delivery');
reset role;
update private.memory_private_media_policy set paused=false,observed_at=now()-interval '25 hours';
set role authenticated;
select pg_temp.fails($q$select public.get_memory_private_image_policy('aaaaaaaa-aaaa-4aaa-8aaa-000000000001',1)$q$,'PRIVATE_IMAGE_POLICY_STALE','stale observations fail closed');
reset role;
update private.memory_private_media_policy set observed_at=now();
set role authenticated;
select public.retire_memory_card_publications('cccccccc-cccc-4ccc-8ccc-000000000001');
select pg_temp.fails($q$select public.read_memory_private_image('aaaaaaaa-aaaa-4aaa-8aaa-000000000001',1,'main',false)$q$,'NOT_FOUND','local card deletion fence denies reads before metadata tombstone');
reset role;
select pg_temp.ok((select state='DELETING' from private.memory_private_media limit 1),'local deletion fence retires private representation');
select pg_temp.ok((select deleted_at is null from public.memory_cards where id='cccccccc-cccc-4ccc-8ccc-000000000001'),'deletion fence protection does not wait for metadata sync');
-- Source tombstone immediately retires private representation; restoring source cannot restore old media.
update public.memory_cards set deleted_at=now(),status='DELETED' where id='cccccccc-cccc-4ccc-8ccc-000000000001';
select pg_temp.ok((select state='DELETING' from private.memory_private_media limit 1),'card deletion queues cleanup');
update public.memory_cards set deleted_at=null,status='DRAFT' where id='cccccccc-cccc-4ccc-8ccc-000000000001';
set role authenticated;
select pg_temp.fails($q$select public.read_memory_private_image('aaaaaaaa-aaaa-4aaa-8aaa-000000000001',1,'main',false)$q$,'NOT_FOUND','restored source cannot revive retired representation');
reset role;
select pg_temp.ok((select sum(main_bytes+thumb_bytes)=1000 from private.memory_private_media where state<>'DELETED'),'deleting objects still reserve physical quota');
set role service_role;
select pg_temp.ok(jsonb_array_length(public.claim_memory_private_image_cleanup())=0,'cleanup waits for outstanding writer deadline');
reset role;
update private.memory_private_media set cleanup_after=now()-interval '1 second';
set role service_role;
select pg_temp.ok(jsonb_array_length(public.claim_memory_private_image_cleanup())=1,'eligible cleanup claimed');
select public.complete_memory_private_image_cleanup((public.claim_memory_private_image_cleanup()->0->>'id')::uuid);
reset role;
select pg_temp.ok((select count(*)=0 from private.memory_private_media where state<>'DELETED'),'confirmed cleanup releases logical and physical quota');
set role service_role;
select pg_temp.reserve_second();
reset role;
update private.memory_private_media set expires_at=now()-interval '1 second' where operation_id='ffffffff-ffff-4fff-8fff-000000000010';
select set_config('test.expired_id',(select id::text from private.memory_private_media where operation_id='ffffffff-ffff-4fff-8fff-000000000010'),false);
set role service_role;
select pg_temp.fails($q$select public.complete_memory_private_image(current_setting('test.expired_id')::uuid)$q$,'PRIVATE_IMAGE_RETIRED','expired upload cannot finalize');
select pg_temp.ok(jsonb_array_length(public.claim_memory_private_image_cleanup())=0,'expired upload is retired before delayed cleanup');
reset role;
update private.memory_private_media set cleanup_after=now()-interval '1 second' where operation_id='ffffffff-ffff-4fff-8fff-000000000010';
set role service_role;
select public.complete_memory_private_image_cleanup(current_setting('test.expired_id')::uuid);
reset role;
select pg_temp.ok((select count(*)=0 from private.memory_private_media where state<>'DELETED'),'expired upload cleanup releases reservation');
select count(*) as private_assertions_passed from assertions;
