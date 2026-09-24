-- Synthetic catalog only. No remote requests or licensed bytes.
create function pg_temp.catalog_ok(value boolean,label text) returns void language plpgsql as $$
begin if value is distinct from true then raise exception 'FAIL: %',label; end if; raise notice 'PASS: %',label; end $$;
create function pg_temp.catalog_fails(statement text,expected text) returns void language plpgsql as $$
begin
 begin execute statement; exception when others then
  if position(expected in sqlerrm)>0 then raise notice 'PASS: catalog rejects %',expected; return; end if; raise;
 end;
 raise exception 'FAIL: expected %',expected;
end $$;
-- Hosted service_role already has Storage access; bootstrap intentionally starts minimal.
grant usage on schema storage to service_role;
grant select on storage.objects to service_role;
insert into public.catalog_releases(id,profile,schema_version,policy_version,release_hash,target_count,people_page_count)
select 'w16-'||label,'synthetic',2,'fixture',repeat(digit,64),2,0 from (values('a','1'),('b','2'),('c','3'),('broken','4')) x(label,digit);
insert into public.catalog_assets(release_id,asset_id,anime_id,kind,availability,rights_basis,source_provider,bucket_id,object_path,checksum,byte_size,width,height,mime_type,row_hash)
select r.id,'asset:'||repeat(case when n=1 then '6' else '7' end,40),'anime:16161616-1616-4161-8161-16161616161'||n,
'COVER_IMAGE','PREVIEW_STORAGE','USER_CONFIRMED_PREVIEW_PERMISSION','ANILIST','catalog-covers-preview',
'covers/anime-16161616-1616-4161-8161-16161616161'||n||'/'||repeat('a',64)||'.png',repeat('a',64),12,1,1,'image/png',repeat('b',64)
from public.catalog_releases r cross join generate_series(1,2) n where r.id like 'w16-%';
insert into storage.objects(bucket_id,name) select distinct bucket_id,object_path from public.catalog_assets where release_id='w16-a';
insert into public.catalog_anime_search(release_id,anime_id,preferred_title,preferred_locale,search_text,readiness,cover_asset_id,row_hash)
select release_id,anime_id,'Synthetic season '||right(anime_id,1),'en','synthetic season '||right(anime_id,1),'READY',asset_id,row_hash from public.catalog_assets where release_id like 'w16-%';
insert into public.catalog_anime_details(release_id,anime_id,payload,row_hash)
select release_id,anime_id,jsonb_build_object('title',preferred_title),row_hash from public.catalog_anime_search where release_id like 'w16-%' and release_id<>'w16-broken';
set role anon;
select pg_temp.catalog_fails($q$select public.activate_catalog_release_checked('w16-a',repeat('1',64),null)$q$,'permission denied');
reset role;
set role authenticated;
select pg_temp.catalog_fails($q$select public.activate_catalog_release('w16-a',repeat('1',64))$q$,'permission denied');
reset role;
set role service_role;
select public.activate_catalog_release('w16-a',repeat('1',64));
select pg_temp.catalog_ok((select release_id='w16-a' from public.catalog_active_release),'catalog initial activation');
select public.activate_catalog_release_checked('w16-a',repeat('1',64),null);
select pg_temp.catalog_ok((select count(*)=1 from public.catalog_releases where status='ACTIVE'),'catalog replay keeps single active release');
select pg_temp.catalog_fails($q$select public.activate_catalog_release_checked('w16-broken',repeat('4',64),'w16-a')$q$,'CATALOG_RELEASE_INCOMPLETE');
select pg_temp.catalog_fails($q$select public.activate_catalog_release_checked('w16-b',repeat('f',64),'w16-a')$q$,'CATALOG_RELEASE_INVALID');
select pg_temp.catalog_ok((select release_id='w16-a' from public.catalog_active_release),'catalog failed candidate preserves active release');
select public.activate_catalog_release_checked('w16-b',repeat('2',64),'w16-a');
select pg_temp.catalog_fails($q$select public.activate_catalog_release_checked('w16-c',repeat('3',64),'w16-a')$q$,'CATALOG_RELEASE_CONFLICT');
select public.activate_catalog_release_checked('w16-a',repeat('1',64),'w16-b');
select pg_temp.catalog_ok((select release_id='w16-a' from public.catalog_active_release),'catalog A to B to A rollback');
select pg_temp.catalog_ok((select count(*)=2 from public.catalog_cover_revisions where catalog_anime_id like 'anime:16161616-%'),'catalog rollback preserves immutable cover revisions');
select pg_temp.catalog_ok((select count(*)=8 from public.catalog_anime_search where release_id like 'w16-%'),'catalog transitions preserve all staged and retired rows');
reset role;
set role anon;
select pg_temp.catalog_ok((select count(*)=2 from public.catalog_anime_search),'anonymous catalog exposes only active titles, separate seasons');
reset role;
-- Broken storage and mismatched cover identity must not replace the active release.
delete from storage.objects where name like '%161616161612/%';
set role service_role;
select pg_temp.catalog_fails($q$select public.activate_catalog_release_checked('w16-c',repeat('3',64),'w16-a')$q$,'CATALOG_RELEASE_INCOMPLETE');
reset role;
insert into storage.objects(bucket_id,name) select bucket_id,object_path from public.catalog_assets where release_id='w16-c' and anime_id like '%2';
update public.catalog_anime_search set cover_asset_id='asset:'||repeat('7',40) where release_id='w16-c' and anime_id like '%1';
set role service_role;
select pg_temp.catalog_fails($q$select public.activate_catalog_release_checked('w16-c',repeat('3',64),'w16-a')$q$,'CATALOG_RELEASE_IDENTITY_INVALID');
reset role;
update public.catalog_anime_search set cover_asset_id='asset:'||repeat('6',40) where release_id='w16-c' and anime_id like '%1';
