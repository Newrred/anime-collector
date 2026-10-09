-- Synthetic fixtures on the selective production schema, never hosted data.
create temp table assertions(label text);
grant all on assertions to anon,authenticated;
create function pg_temp.ok(condition boolean,label text) returns void language plpgsql as $$
begin
  if condition is distinct from true then raise exception 'FAIL: %',label; end if;
  insert into assertions values(label); raise notice 'PASS: %',label;
end $$;
create function pg_temp.fails(statement text,expected text,label text) returns void language plpgsql as $$
begin
  begin execute statement;
  exception when others then
    if position(expected in sqlerrm)>0 then perform pg_temp.ok(true,label); return; end if;
    raise exception 'Wrong failure for %: %',label,sqlerrm;
  end;
  raise exception 'Unexpected success: %',label;
end $$;

select pg_temp.ok(to_regprocedure('public.retire_memory_card_publications(uuid)') is null,'reproduced selective schema missing retirement RPC');
select pg_temp.fails('select public.retire_memory_card_publications(gen_random_uuid())','does not exist','unpatched selective schema blocks card deletion');
\ir ../../supabase/migrations/20261009090000_private_card_retirement_compat.sql
select pg_temp.ok(to_regprocedure('public.retire_memory_card_publications(uuid)') is not null,'compatibility RPC installed');
select pg_temp.ok(to_regclass('private.memory_publications') is null and to_regclass('private.memory_public_cards') is null,'publication schema remains absent');
select pg_temp.ok(not has_function_privilege('anon','public.retire_memory_card_publications(uuid)','EXECUTE'),'anonymous retirement denied');
select pg_temp.ok(has_function_privilege('authenticated','public.retire_memory_card_publications(uuid)','EXECUTE'),'authenticated retirement available');

insert into auth.users values('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222');
insert into public.memory_cards(id,user_id,catalog_anime_id,title_snapshot,status,client_updated_at)
values('cccccccc-cccc-4ccc-8ccc-000000000001','11111111-1111-4111-8111-111111111111',
 'anime:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Synthetic private test','DRAFT',now());
insert into public.memory_visual_assets(id,user_id,card_id,asset_type,state,is_current,checksum_sha256,mime_type,byte_size,width,height,client_updated_at)
values('aaaaaaaa-aaaa-4aaa-8aaa-000000000001','11111111-1111-4111-8111-111111111111',
 'cccccccc-cccc-4ccc-8ccc-000000000001','USER_IMAGE','READY',true,repeat('a',64),'image/png',500,10,10,now());
update private.memory_private_media_policy set enabled=true,approved=true,revision='LOCAL_TEST',observed_at=now(),
 quota_bytes=50000000,physical_bytes=100000000,preparations_per_day=10,decode_attempts_per_day=10,
 asset_count_max=100,read_bytes_per_month=10000,global_read_bytes_per_month=100000;
select public.reserve_memory_private_image('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-000000000001',1,
 'ffffffff-ffff-4fff-8fff-000000000001','LOCAL_TEST',repeat('b',64),repeat('c',64),repeat('d',64),800,200,10,10);
select public.complete_memory_private_image((select id from private.memory_private_media limit 1));

set role authenticated;
select pg_temp.fails('select public.retire_memory_card_publications(gen_random_uuid())','AUTH_REQUIRED','missing identity fails closed');
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
select pg_temp.fails('select public.retire_memory_card_publications(null)','INVALID_SELECTION','null card rejected');
select pg_temp.ok(public.read_memory_private_image('aaaaaaaa-aaaa-4aaa-8aaa-000000000001',1,'main',false) is not null,'owner reads before retirement');
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false);
select public.retire_memory_card_publications('cccccccc-cccc-4ccc-8ccc-000000000001');
reset role;
select pg_temp.ok((select state='READY' from private.memory_private_media limit 1),'B cannot retire A representation');
select pg_temp.ok(not exists(select 1 from private.memory_publication_delete_fences where user_id='11111111-1111-4111-8111-111111111111'),'B cannot create A fence');
set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
select public.retire_memory_card_publications('cccccccc-cccc-4ccc-8ccc-000000000001');
select public.retire_memory_card_publications('cccccccc-cccc-4ccc-8ccc-000000000001');
select pg_temp.fails($q$select public.read_memory_private_image('aaaaaaaa-aaaa-4aaa-8aaa-000000000001',1,'main',false)$q$,'NOT_FOUND','retirement immediately denies fresh photo read');
select public.retire_memory_card_publications('cccccccc-cccc-4ccc-8ccc-000000000099');
reset role;
select pg_temp.ok((select count(*)=1 from private.memory_publication_delete_fences where user_id='11111111-1111-4111-8111-111111111111' and card_id='cccccccc-cccc-4ccc-8ccc-000000000001'),'retirement replay is idempotent');
select pg_temp.ok((select state='DELETING' from private.memory_private_media limit 1),'retirement queues private copy cleanup');
select pg_temp.ok((select deleted_at is null from public.memory_cards limit 1),'fence precedes metadata tombstone');
select pg_temp.ok(exists(select 1 from private.memory_publication_delete_fences where user_id='11111111-1111-4111-8111-111111111111' and card_id='cccccccc-cccc-4ccc-8ccc-000000000099'),'retirement fences a delayed source insert');

create temp table installed as select oid,pg_get_functiondef(oid) as definition,proacl::text as acl from pg_proc where oid='public.retire_memory_card_publications(uuid)'::regprocedure;
\ir ../../supabase/migrations/20261009090000_private_card_retirement_compat.sql
select pg_temp.ok((select i.oid=p.oid and i.definition=pg_get_functiondef(p.oid) and i.acl=p.proacl::text from installed i join pg_proc p on p.oid=i.oid),'replay preserves installed implementation and ACL');
create table private.memory_publications(dummy integer);
set role authenticated;
select pg_temp.fails($q$select public.retire_memory_card_publications('cccccccc-cccc-4ccc-8ccc-000000000098')$q$,'PUBLICATION_WITHDRAWAL_UNCONFIRMED','partial public rollout fails closed');
reset role;
select pg_temp.ok(not exists(select 1 from private.memory_publication_delete_fences where card_id='cccccccc-cccc-4ccc-8ccc-000000000098'),'failed public withdrawal leaves source untouched');
drop table private.memory_publications;
create schema supabase_migrations;
create table supabase_migrations.schema_migrations(version text primary key,name text);
insert into supabase_migrations.schema_migrations values('20261009090000','private_card_retirement_compat');
\ir rollback-retirement-compat-20261009.sql
select pg_temp.ok(to_regprocedure('public.retire_memory_card_publications(uuid)') is null,'rollback restores missing RPC without touching user data');
select pg_temp.ok((select count(*)=3 from private.memory_publication_delete_fences),'rollback retains every retirement fence');
\ir activate-retirement-compat-20261009.sql
select pg_temp.ok(to_regprocedure('public.retire_memory_card_publications(uuid)') is not null,'guarded rollout installs RPC');
select pg_temp.ok(exists(select 1 from supabase_migrations.schema_migrations where version='20261009090000'),'guarded rollout records migration');
select count(*) as retirement_assertions_passed from assertions;
