-- Synthetic data only. Tests preservation across the two compatibility adaptations.
create function pg_temp.ok(condition boolean,label text) returns void language plpgsql as $$
begin
 if condition is distinct from true then raise exception 'FAIL: %',label; end if;
 raise notice 'PASS: %',label;
end $$;
insert into auth.users values('11111111-1111-4111-8111-111111111111');
insert into public.memory_cards(id,user_id,catalog_anime_id,title_snapshot,status,client_updated_at,classification)
values('cccccccc-cccc-4ccc-8ccc-000000000001','11111111-1111-4111-8111-111111111111',
 'anime:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Synthetic upgrade fixture','DRAFT',now(),
 '{"version":1,"tags":["synthetic"],"characters":[]}');
insert into public.memory_visual_assets(id,user_id,card_id,asset_type,state,is_current,checksum_sha256,mime_type,byte_size,width,height,client_updated_at)
values('aaaaaaaa-aaaa-4aaa-8aaa-000000000001','11111111-1111-4111-8111-111111111111',
 'cccccccc-cccc-4ccc-8ccc-000000000001','USER_IMAGE','READY',true,repeat('a',64),'image/png',500,10,10,now());
update private.memory_private_media_policy set enabled=true,approved=true,revision='LOCAL_TEST',observed_at=now(),
 quota_bytes=50000000,physical_bytes=100000000,preparations_per_day=10,decode_attempts_per_day=10,
 asset_count_max=100,read_bytes_per_month=10000,global_read_bytes_per_month=100000;
select public.reserve_memory_private_image('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-000000000001',1,
 'ffffffff-ffff-4fff-8fff-000000000001','LOCAL_TEST',repeat('b',64),repeat('c',64),repeat('d',64),800,200,10,10);
select public.complete_memory_private_image((select id from private.memory_private_media limit 1));
create temp table before_card as select to_jsonb(c) value from public.memory_cards c;
create temp table before_media as select to_jsonb(m) value from private.memory_private_media m;
insert into private.memory_publication_delete_fences values
 ('11111111-1111-4111-8111-111111111111','cccccccc-cccc-4ccc-8ccc-000000000099');
create temp table before_policy as select to_jsonb(p) value from private.memory_private_media_policy p;
create temp table before_functions as select oid,pg_get_functiondef(oid) definition from pg_proc
 where pronamespace='public'::regnamespace and proname in ('push_memory_changes','pull_memory_changes');
set moemoa.local_rehearsal='yes';
\ir ../../.cache/public-upgrade-rehearsal/candidate.sql
select pg_temp.ok((select count(*)=1 from private.memory_publication_delete_fences),'existing deletion fence retained');
select pg_temp.ok((select value=to_jsonb(p) from before_policy,private.memory_private_media_policy p),'private policy unchanged');
select pg_temp.ok((select value=to_jsonb(c) from before_card,public.memory_cards c),'existing card and its classification unchanged');
select pg_temp.ok((select value=to_jsonb(m) from before_media,private.memory_private_media m),'ready private representation and quota reservation unchanged');
select pg_temp.ok(not exists(select 1 from before_functions b join pg_proc p using(oid) where b.definition<>pg_get_functiondef(p.oid)),'private sync functions unchanged');
select pg_temp.ok(exists(select 1 from pg_trigger where tgname='memory_visual_assets_normalize_json_null'),'latest JSON null compatibility trigger retained');
select pg_temp.ok(not exists(select 1 from private.memory_publication_settings where reads_enabled or writes_enabled),'public publishing and reads remain disabled');
select pg_temp.ok(not has_function_privilege('anon','public.retire_memory_card_publications(uuid)','execute'),'anonymous retirement denied after upgrade');
select pg_temp.ok(has_function_privilege('authenticated','public.retire_memory_card_publications(uuid)','execute'),'owner retirement grant retained');
set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
select public.retire_memory_card_publications('cccccccc-cccc-4ccc-8ccc-000000000098');
select pg_temp.ok(public.read_memory_private_image('aaaaaaaa-aaaa-4aaa-8aaa-000000000001',1,'main',false) is not null,'existing owner photo readable after upgrade');
select public.retire_memory_card_publications('cccccccc-cccc-4ccc-8ccc-000000000001');
reset role;
select pg_temp.ok((select count(*)=3 from private.memory_publication_delete_fences),'full public retirement accepts owner deletion without partial-install failure');
select pg_temp.ok((select state='DELETING' from private.memory_private_media limit 1),'existing photo retires safely after upgrade');
select pg_temp.ok(position('revoke_memory_card_publications' in pg_get_functiondef('public.retire_memory_card_publications(uuid)'::regprocedure))>0,'full publication withdrawal implementation installed');
