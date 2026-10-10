-- Disposable local fixtures only. This is SQL cascade/fencing, not hosted Auth or Storage.
-- Roll back this independent scenario so optional later suites keep their prior fixtures/policy.
begin;
create temp table account_delete_assertions(label text);
grant all on account_delete_assertions to authenticated,service_role;
create function pg_temp.ok(value boolean,label text) returns void language plpgsql as $$
begin if value is distinct from true then raise exception 'FAIL: %',label; end if;
 insert into account_delete_assertions values(label); raise notice 'PASS: %',label; end $$;
create function pg_temp.fails(statement text,expected text,label text) returns void language plpgsql as $$
begin begin execute statement; exception when others then
 if sqlerrm=expected then perform pg_temp.ok(true,label); return; end if; raise;
 end; raise exception 'Unexpected success: %',label; end $$;
insert into auth.users(id) values('77777777-7777-4777-8777-777777777777'),('88888888-8888-4888-8888-888888888888');
insert into public.memory_cards(id,user_id,catalog_anime_id,title_snapshot,status,client_updated_at) values
 ('77777777-7777-4777-8777-000000000001','77777777-7777-4777-8777-777777777777','anime:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Synthetic account deletion','DRAFT',now()),
 ('77777777-7777-4777-8777-000000000002','77777777-7777-4777-8777-777777777777','anime:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Synthetic pending upload','DRAFT',now()),
 ('88888888-8888-4888-8888-000000000001','88888888-8888-4888-8888-888888888888','anime:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Synthetic other account','DRAFT',now());
insert into public.memory_visual_assets(id,user_id,card_id,asset_type,state,is_current,checksum_sha256,mime_type,byte_size,width,height,client_updated_at) values
 ('77777777-7777-4777-8777-100000000001','77777777-7777-4777-8777-777777777777','77777777-7777-4777-8777-000000000001','USER_IMAGE','READY',true,repeat('a',64),'image/png',500,10,10,now()),
 ('77777777-7777-4777-8777-100000000002','77777777-7777-4777-8777-777777777777','77777777-7777-4777-8777-000000000002','USER_IMAGE','READY',true,repeat('a',64),'image/png',500,10,10,now()),
 ('88888888-8888-4888-8888-100000000001','88888888-8888-4888-8888-888888888888','88888888-8888-4888-8888-000000000001','USER_IMAGE','READY',true,repeat('a',64),'image/png',500,10,10,now());
update private.memory_private_media_policy set enabled=true,approved=true,paused=false,revision='LOCAL_ACCOUNT_DELETE',observed_at=now(),
 quota_bytes=100000000,physical_bytes=100000000,preparations_per_day=100,decode_attempts_per_day=100,asset_count_max=1000,
 read_bytes_per_month=100000000,global_read_bytes_per_month=100000000;
create function pg_temp.reserve(owner_id uuid,asset_id uuid,operation_id uuid) returns jsonb language sql as $$
 select public.reserve_memory_private_image(owner_id,asset_id,1,operation_id,'LOCAL_ACCOUNT_DELETE',repeat('b',64),repeat('c',64),repeat('d',64),800,200,10,10)
$$;
grant execute on function pg_temp.reserve(uuid,uuid,uuid) to service_role;
set role service_role;
select set_config('test.delete_ready',pg_temp.reserve('77777777-7777-4777-8777-777777777777','77777777-7777-4777-8777-100000000001','77777777-7777-4777-8777-200000000001')->>'id',false);
select public.complete_memory_private_image(current_setting('test.delete_ready')::uuid);
select set_config('test.delete_pending',pg_temp.reserve('77777777-7777-4777-8777-777777777777','77777777-7777-4777-8777-100000000002','77777777-7777-4777-8777-200000000002')->>'id',false);
select set_config('test.keep_ready',pg_temp.reserve('88888888-8888-4888-8888-888888888888','88888888-8888-4888-8888-100000000001','88888888-8888-4888-8888-200000000001')->>'id',false);
select public.complete_memory_private_image(current_setting('test.keep_ready')::uuid);
reset role;
-- A future writer deadline represents an already-authorized PUT still in progress.
update private.memory_private_media set write_until=now()+interval '10 minutes' where owner_id='77777777-7777-4777-8777-777777777777';
create temp table deleted_media_before as select id,to_jsonb(m)-array['state','cleanup_after'] as immutable_fields from private.memory_private_media m where owner_id='77777777-7777-4777-8777-777777777777';
create temp table other_media_before as select to_jsonb(m) as original from private.memory_private_media m where owner_id='88888888-8888-4888-8888-888888888888';
select pg_temp.ok((select count(*)=2 and bool_or(state='READY') and bool_or(state='PREPARING') from private.memory_private_media where owner_id='77777777-7777-4777-8777-777777777777'),'account fixture has ready and in-flight private representations');
select set_config('request.jwt.claim.sub','77777777-7777-4777-8777-777777777777',false);
select set_config('request.jwt.claim.role','authenticated',false);
set role authenticated;
select pg_temp.ok(public.read_memory_private_image('77777777-7777-4777-8777-100000000001',1,'main',false) is not null,'owner can resolve private image before deletion');
reset role;
delete from auth.users where id='77777777-7777-4777-8777-777777777777';
select pg_temp.ok(not exists(select 1 from public.memory_cards where user_id='77777777-7777-4777-8777-777777777777')
 and not exists(select 1 from public.memory_visual_assets where user_id='77777777-7777-4777-8777-777777777777'),'synthetic Auth deletion cascades only its source records');
select pg_temp.ok((select count(*)=2 and bool_and(state='DELETING') from private.memory_private_media where owner_id='77777777-7777-4777-8777-777777777777'),'account deletion retires both ready and preparing images without losing manifests');
select pg_temp.ok((select bool_and(to_jsonb(m)-array['state','cleanup_after']=b.immutable_fields) from private.memory_private_media m join deleted_media_before b using(id)),'retirement preserves IDs, hashes, byte counts and writer deadlines for cleanup');
select pg_temp.ok((select bool_and(cleanup_after>=write_until+interval '60 seconds' and cleanup_after>now()) from private.memory_private_media where owner_id='77777777-7777-4777-8777-777777777777'),'cleanup waits at least 60 seconds beyond every outstanding writer deadline');
select pg_temp.ok((select to_jsonb(m)=b.original from private.memory_private_media m cross join other_media_before b where owner_id='88888888-8888-4888-8888-888888888888'),'another account representation is unchanged');

-- Keep the old JWT sub in the session: source existence, not token expiry, fences access.
set role authenticated;
select pg_temp.ok(auth.uid()='77777777-7777-4777-8777-777777777777'::uuid,'deleted owner JWT claim is deliberately still present');
select pg_temp.fails($q$select public.get_memory_private_image_policy('77777777-7777-4777-8777-100000000001',1)$q$,'NOT_FOUND','stale owner JWT cannot request new image policy');
select pg_temp.fails($q$select public.read_memory_private_image('77777777-7777-4777-8777-100000000001',1,'main',false)$q$,'NOT_FOUND','stale owner JWT cannot resolve new private bytes');
select pg_temp.fails($q$select public.authorize_memory_private_image_attempt('77777777-7777-4777-8777-100000000002',1,'LOCAL_ACCOUNT_DELETE')$q$,'NOT_FOUND','stale owner JWT cannot authorize a new upload attempt');
reset role;
set role service_role;
select pg_temp.fails($q$select pg_temp.reserve('77777777-7777-4777-8777-777777777777','77777777-7777-4777-8777-100000000002','77777777-7777-4777-8777-200000000003')$q$,'NOT_FOUND','trusted server cannot reserve a new upload after account deletion');
select pg_temp.fails($q$select public.complete_memory_private_image(current_setting('test.delete_pending')::uuid)$q$,'NOT_FOUND','delayed PUT completion cannot revive a deleted account image');
select pg_temp.fails($q$select public.complete_memory_private_image(current_setting('test.delete_ready')::uuid)$q$,'NOT_FOUND','old ready-operation retry cannot revive a deleted account image');
select pg_temp.ok(jsonb_array_length(public.claim_memory_private_image_cleanup())=0,'cleanup does not claim an object while its writer may still be running');
select public.complete_memory_private_image_cleanup(current_setting('test.delete_pending')::uuid);
reset role;
select pg_temp.ok((select state='DELETING' from private.memory_private_media where id=current_setting('test.delete_pending')::uuid),'premature cleanup confirmation cannot release the manifest');

-- Advance synthetic deadlines; no real sleep or real Storage object deletion is used.
update private.memory_private_media set write_until=now()-interval '2 minutes',cleanup_after=now()-interval '1 second' where owner_id='77777777-7777-4777-8777-777777777777';
set role service_role;
select pg_temp.ok(jsonb_array_length(public.claim_memory_private_image_cleanup())=2,'both retired representations become claimable after their deadlines');
select public.complete_memory_private_image_cleanup(current_setting('test.delete_ready')::uuid);
select public.complete_memory_private_image_cleanup(current_setting('test.delete_pending')::uuid);
reset role;
select pg_temp.ok((select count(*)=2 and bool_and(state='DELETED') from private.memory_private_media where owner_id='77777777-7777-4777-8777-777777777777'),'confirmed local cleanup releases both representations without erasing cleanup identity');
select pg_temp.ok((select count(*)=0 from private.memory_private_media where owner_id='77777777-7777-4777-8777-777777777777' and state<>'DELETED'),'deleted account has no remaining private byte reservation');
select set_config('request.jwt.claim.sub','88888888-8888-4888-8888-888888888888',false);
set role authenticated;
select pg_temp.ok(public.read_memory_private_image('88888888-8888-4888-8888-100000000001',1,'main',false) is not null,'other account still resolves its original image after cleanup');
reset role;
select count(*) as account_delete_assertions_passed from account_delete_assertions;
rollback;
