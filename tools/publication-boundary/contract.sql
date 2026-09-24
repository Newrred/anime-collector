-- Real PostgreSQL roles, synthetic auth.uid()/Storage tables; NOT hosted Supabase verification.
create temp table assertions(label text);
grant all on assertions to anon,authenticated;
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
begin;
insert into auth.users values('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222');
insert into public.memory_boards(id,user_id,title,description,client_updated_at)
select ('bbbbbbbb-bbbb-4bbb-8bbb-'||lpad(n::text,12,'0'))::uuid,
 case when n=3 then '22222222-2222-4222-8222-222222222222'::uuid else '11111111-1111-4111-8111-111111111111'::uuid end,
 'PRIVATE BOARD NAME','PRIVATE DESCRIPTION',now() from generate_series(1,3) n;
insert into public.memory_cards(id,user_id,catalog_anime_id,title_snapshot,status,note,scene_cue,client_updated_at)
select ('cccccccc-cccc-4ccc-8ccc-'||lpad(n::text,12,'0'))::uuid,
 case when n=3 then '22222222-2222-4222-8222-222222222222'::uuid else '11111111-1111-4111-8111-111111111111'::uuid end,
 'anime:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Chosen title '||n,'COMPLETE_PRIVATE',
 'PRIVATE NOTE '||n,'PRIVATE SCENE',now() from generate_series(1,3) n;
insert into public.memory_board_cards(id,user_id,board_id,card_id,position_key,client_updated_at)
select gen_random_uuid(),c.user_id,b.id,c.id,c.id::text,now() from public.memory_boards b
 join public.memory_cards c on c.user_id=b.user_id;
insert into public.catalog_cover_revisions values(
 'asset:'||repeat('a',40),'cover:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','anime:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 'READY','EXPLICIT_PERMISSION',now(),'synthetic permission','ANILIST','synthetic','test-release','catalog-covers-preview',
 'covers/anime-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/'||repeat('a',64)||'.jpg',repeat('a',64),'image/jpeg',100,10,10,now());
insert into public.memory_visual_assets(id,user_id,card_id,asset_type,state,storage_scope,rights_basis,is_current,client_updated_at,
 catalog_cover_id,catalog_cover_revision_id,catalog_anime_id,permission_verified_at)
select gen_random_uuid(),c.user_id,c.id,'CATALOG_COVER','READY','CATALOG_MANAGED','EXPLICIT_PERMISSION',true,now(),
 cr.catalog_cover_id,cr.catalog_cover_revision_id,cr.catalog_anime_id,cr.permission_verified_at
 from public.memory_cards c cross join public.catalog_cover_revisions cr;
commit;
select set_config('test.selection','{"title":"Public display","description":"Explicit public description","cards":[{"cardId":"cccccccc-cccc-4ccc-8ccc-000000000001","fields":[]}]}',false);
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
set role authenticated;
select pg_temp.fails($q$select public.prepare_memory_publication('bbbbbbbb-bbbb-4bbb-8bbb-000000000001',0,current_setting('test.selection')::jsonb)$q$,'PUBLICATION_DISABLED','server default denies publish preparation');
select pg_temp.fails('select * from private.memory_publications','permission denied','authenticated cannot read raw public staging');
select pg_temp.fails('update private.memory_publication_settings set writes_enabled=true','permission denied','client cannot enable public gate');
select pg_temp.fails($q$select private.build_memory_publication(null,null,null)$q$,'permission denied','private projection function unavailable');
reset role;
update private.memory_publication_settings set writes_enabled=true,reads_enabled=true,policy_revision='TEST_ONLY';
set role authenticated;
select pg_temp.fails($q$select public.prepare_memory_publication('bbbbbbbb-bbbb-4bbb-8bbb-000000000003',0,current_setting('test.selection')::jsonb)$q$,'NOT_FOUND','A cannot prepare B board');
select pg_temp.fails($q$select public.prepare_memory_publication('bbbbbbbb-bbbb-4bbb-8bbb-000000000001',0,jsonb_set(current_setting('test.selection')::jsonb,'{cards,0,cardId}','"cccccccc-cccc-4ccc-8ccc-000000000003"'))$q$,'NOT_FOUND','A cannot select B card');
select pg_temp.fails($q$select public.prepare_memory_publication('bbbbbbbb-bbbb-4bbb-8bbb-000000000001',0,current_setting('test.selection')::jsonb||'{"ownerId":"spoof"}')$q$,'INVALID_SELECTION','unapproved input fields rejected');
select set_config('test.preview',public.prepare_memory_publication('bbbbbbbb-bbbb-4bbb-8bbb-000000000001',0,current_setting('test.selection')::jsonb)::text,false);
select pg_temp.ok((current_setting('test.preview')::jsonb->'snapshot'->'cards'->0) - array['id','title','animeId','visual']='{}'::jsonb,'public card exact allowlist; no private note, IDs, counts or localRef');
select pg_temp.ok(jsonb_array_length(current_setting('test.preview')::jsonb->'snapshot'->'cards')=1,'unselected cards absent');
select pg_temp.ok(current_setting('test.preview') not like '%PRIVATE%','private board title/description/note not copied');
select set_config('test.id',current_setting('test.preview')::jsonb->>'id',false);
select pg_temp.ok(public.read_memory_publication(current_setting('test.id')::uuid) is null,'preview is not public');
select pg_temp.fails($q$select public.publish_memory_publication(current_setting('test.id')::uuid,1,'wrong','TEST_ONLY','dddddddd-dddd-4ddd-8ddd-000000000001')$q$,'CONSENT_MISMATCH','wrong consent hash blocked');
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false);
select pg_temp.ok(public.get_memory_publication('bbbbbbbb-bbbb-4bbb-8bbb-000000000001') is null,'B cannot read A preview');
select pg_temp.fails($q$select public.publish_memory_publication(current_setting('test.id')::uuid,1,current_setting('test.preview')::jsonb->>'reviewHash','TEST_ONLY','dddddddd-dddd-4ddd-8ddd-000000000001')$q$,'NOT_FOUND','B cannot publish A');
select pg_temp.fails($q$select public.revoke_memory_publication(current_setting('test.id')::uuid,1)$q$,'NOT_FOUND','B cannot revoke A');
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
reset role;
update public.memory_cards set note='CHANGED PRIVATE NOTE',version=version+1 where id='cccccccc-cccc-4ccc-8ccc-000000000001';
set role authenticated;
select pg_temp.fails($q$select public.publish_memory_publication(current_setting('test.id')::uuid,1,current_setting('test.preview')::jsonb->>'reviewHash','TEST_ONLY','dddddddd-dddd-4ddd-8ddd-000000000001')$q$,'PREVIEW_CHANGED','changed private revision requires review again');
select set_config('test.preview',public.prepare_memory_publication('bbbbbbbb-bbbb-4bbb-8bbb-000000000001',1,current_setting('test.selection')::jsonb)::text,false);
select pg_temp.ok(public.publish_memory_publication(current_setting('test.id')::uuid,2,current_setting('test.preview')::jsonb->>'reviewHash','TEST_ONLY','dddddddd-dddd-4ddd-8ddd-000000000001')->>'state'='PUBLISHED','reviewed snapshot publishes');
select pg_temp.ok(public.publish_memory_publication(current_setting('test.id')::uuid,2,current_setting('test.preview')::jsonb->>'reviewHash','TEST_ONLY','dddddddd-dddd-4ddd-8ddd-000000000001')->>'revision'='3','retry does not increment version');
select pg_temp.ok(public.get_memory_publication('bbbbbbbb-bbbb-4bbb-8bbb-000000000001')->>'sourceChanged'='false','published source versions match immediately after publish');
select pg_temp.ok(not (public.get_memory_publication('bbbbbbbb-bbbb-4bbb-8bbb-000000000001') ? 'published_sources'),'owner status does not expose source manifest');
set role anon;
select set_config('request.jwt.claim.sub','',false);
select pg_temp.ok(public.read_memory_publication(current_setting('test.id')::uuid)-'id'=current_setting('test.preview')::jsonb->'snapshot','anon visitor payload matches exact reviewed snapshot');
select pg_temp.fails('select * from private.memory_publications','permission denied','anon direct table denied');
select pg_temp.fails($q$select public.prepare_memory_publication(null,0,'{}')$q$,'permission denied','anon write RPC denied');
select pg_temp.fails($q$select public.get_memory_publication(null)$q$,'permission denied','anon owner preview RPC denied');
reset role;
update public.memory_cards set title_snapshot='LATER PRIVATE TITLE',version=version+1 where id='cccccccc-cccc-4ccc-8ccc-000000000001';
set role anon;
select pg_temp.ok(public.read_memory_publication(current_setting('test.id')::uuid)->'cards'->0->>'title'='Chosen title 1','private edits never automatically update public snapshot');
reset role;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
set role authenticated;
select set_config('test.preview2',public.prepare_memory_publication('bbbbbbbb-bbbb-4bbb-8bbb-000000000002',0,current_setting('test.selection')::jsonb)::text,false);
select public.publish_memory_publication((current_setting('test.preview2')::jsonb->>'id')::uuid,1,current_setting('test.preview2')::jsonb->>'reviewHash','TEST_ONLY','dddddddd-dddd-4ddd-8ddd-000000000002');
select set_config('test.refresh',public.prepare_memory_publication('bbbbbbbb-bbbb-4bbb-8bbb-000000000001',3,current_setting('test.selection')::jsonb)::text,false);
select pg_temp.ok(public.get_memory_publication('bbbbbbbb-bbbb-4bbb-8bbb-000000000001')->>'sourceChanged'='true','private edit requires public review after reload');
select pg_temp.ok(public.get_memory_publication('bbbbbbbb-bbbb-4bbb-8bbb-000000000001')->>'hasPublished'='true','preparing update retains published status');
select pg_temp.ok(public.read_memory_publication(current_setting('test.id')::uuid)->'cards'->0->>'title'='Chosen title 1','preparing update preserves previous public snapshot');
select pg_temp.fails($q$select public.prepare_memory_publication('bbbbbbbb-bbbb-4bbb-8bbb-000000000001',3,current_setting('test.selection')::jsonb)$q$,'PUBLICATION_CONFLICT','stale parallel prepare cannot replace preview');
reset role;
update private.memory_publication_settings set writes_enabled=false;
set role authenticated;
select public.revoke_memory_publication(current_setting('test.id')::uuid,4);
select pg_temp.ok(public.get_memory_publication('bbbbbbbb-bbbb-4bbb-8bbb-000000000001')->>'hasPublished'='false','withdrawal removes published status');
select pg_temp.ok(public.read_memory_publication(current_setting('test.id')::uuid) is null,'board revoke works with writes disabled');
select pg_temp.ok(public.read_memory_publication((current_setting('test.preview2')::jsonb->>'id')::uuid) is not null,'revoking one board preserves other explicit publication');
reset role;
update private.memory_publication_settings set writes_enabled=true;
set role authenticated;
select pg_temp.fails($q$select public.publish_memory_publication(current_setting('test.id')::uuid,4,current_setting('test.refresh')::jsonb->>'reviewHash','TEST_ONLY','dddddddd-dddd-4ddd-8ddd-000000000004')$q$,'PUBLICATION_CONFLICT','late prepared success cannot revive revoked board');
select pg_temp.ok(public.publish_memory_publication(current_setting('test.id')::uuid,2,current_setting('test.preview')::jsonb->>'reviewHash','TEST_ONLY','dddddddd-dddd-4ddd-8ddd-000000000001')->>'state'='REVOKED','old successful operation replay reports current revoked state');
select public.revoke_memory_card_publications('cccccccc-cccc-4ccc-8ccc-000000000001');
select pg_temp.fails($q$select public.publish_memory_publication((current_setting('test.preview2')::jsonb->>'id')::uuid,1,current_setting('test.preview2')::jsonb->>'reviewHash','TEST_ONLY','dddddddd-dddd-4ddd-8ddd-000000000002')$q$,'PUBLICATION_RESTRICTED','replay after global withdrawal must not report live publication success');
select pg_temp.ok(jsonb_array_length(public.read_memory_publication((current_setting('test.preview2')::jsonb->>'id')::uuid)->'cards')=0,'global card revoke removes card from remaining board');
select pg_temp.fails($q$select public.prepare_memory_publication('bbbbbbbb-bbbb-4bbb-8bbb-000000000001',5,current_setting('test.selection')::jsonb)$q$,'PUBLICATION_RESTRICTED','new board preparation cannot bypass globally revoked card');
reset role;
-- Restore synthetic revocation for independent deletion/moderation tests, not a user API.
update private.memory_public_cards set revoked=false;
update private.memory_publication_accounts set hidden=true;
insert into private.memory_publication_accounts values('11111111-1111-4111-8111-111111111111',true,true);
set role anon;
select pg_temp.ok(public.read_memory_publication((current_setting('test.preview2')::jsonb->>'id')::uuid) is null,'account hidden blocks anonymous read');
reset role;
set role authenticated;
select pg_temp.fails($q$select public.prepare_memory_publication('bbbbbbbb-bbbb-4bbb-8bbb-000000000001',5,current_setting('test.selection')::jsonb)$q$,'PUBLICATION_RESTRICTED','restricted account cannot republish');
reset role;
update private.memory_publication_accounts set hidden=false,write_blocked=false;
update private.memory_public_cards set hidden=true;
set role anon;
select pg_temp.ok(jsonb_array_length(public.read_memory_publication((current_setting('test.preview2')::jsonb->>'id')::uuid)->'cards')=0,'moderator card restriction filters every read');
reset role;
update private.memory_public_cards set hidden=false;
update public.memory_cards set status='DELETED',deleted_at=now() where id='cccccccc-cccc-4ccc-8ccc-000000000001';
set role anon;
select pg_temp.ok(jsonb_array_length(public.read_memory_publication((current_setting('test.preview2')::jsonb->>'id')::uuid)->'cards')=0,'server source deletion immediately removes public card');
reset role;
select pg_temp.ok((select count(*)=1 from public.catalog_cover_revisions),'revocation/deletion does not delete shared catalog cover');
update public.memory_cards set status='COMPLETE_PRIVATE',deleted_at=null where id='cccccccc-cccc-4ccc-8ccc-000000000001';
set role anon;
select pg_temp.ok(jsonb_array_length(public.read_memory_publication((current_setting('test.preview2')::jsonb->>'id')::uuid)->'cards')=0,'restoring deleted source does not revive public card');
reset role;
update public.memory_boards set deleted_at=now() where id='bbbbbbbb-bbbb-4bbb-8bbb-000000000002';
update public.memory_boards set deleted_at=null where id='bbbbbbbb-bbbb-4bbb-8bbb-000000000002';
set role anon;
select pg_temp.ok(public.read_memory_publication((current_setting('test.preview2')::jsonb->>'id')::uuid) is null,'restoring deleted board does not revive public snapshot');
reset role;
-- Independent validation scenarios on still-private card 2.
select set_config('test.selection',jsonb_set(current_setting('test.selection')::jsonb,'{cards,0,cardId}','"cccccccc-cccc-4ccc-8ccc-000000000002"')::text,false);
update public.memory_visual_assets set asset_type='USER_IMAGE',storage_scope='LOCAL_ONLY',rights_basis='UNKNOWN'
 where card_id='cccccccc-cccc-4ccc-8ccc-000000000002';
set role authenticated;
select pg_temp.fails($q$select public.prepare_memory_publication('bbbbbbbb-bbbb-4bbb-8bbb-000000000001',5,current_setting('test.selection')::jsonb)$q$,'PUBLIC_VISUAL_NOT_READY','unknown user image rejected without silently replacing cover');
reset role;
update public.memory_visual_assets a set asset_type='CATALOG_COVER',storage_scope='CATALOG_MANAGED',rights_basis='EXPLICIT_PERMISSION',
 catalog_cover_id=cr.catalog_cover_id,catalog_cover_revision_id=cr.catalog_cover_revision_id,catalog_anime_id=cr.catalog_anime_id,permission_verified_at=cr.permission_verified_at
 from public.catalog_cover_revisions cr where a.card_id='cccccccc-cccc-4ccc-8ccc-000000000002';
set role authenticated;
select set_config('test.selection',jsonb_set(current_setting('test.selection')::jsonb,'{cards,0,fields}','["note"]')::text,false);
select set_config('test.preview3',public.prepare_memory_publication('bbbbbbbb-bbbb-4bbb-8bbb-000000000001',5,current_setting('test.selection')::jsonb)::text,false);
select pg_temp.ok(current_setting('test.preview3')::jsonb->'snapshot'->'cards'->0->>'note'='PRIVATE NOTE 2','only explicitly selected note included');
reset role;
update private.memory_publication_settings set policy_revision='TEST_ONLY_CHANGED';
set role authenticated;
select pg_temp.fails($q$select public.publish_memory_publication(current_setting('test.id')::uuid,6,current_setting('test.preview3')::jsonb->>'reviewHash','TEST_ONLY','dddddddd-dddd-4ddd-8ddd-000000000003')$q$,'CONSENT_MISMATCH','policy change invalidates old consent');
reset role;
update private.memory_publication_settings set policy_revision='TEST_ONLY';
set role authenticated;
select public.publish_memory_publication(current_setting('test.id')::uuid,6,current_setting('test.preview3')::jsonb->>'reviewHash','TEST_ONLY','dddddddd-dddd-4ddd-8ddd-000000000003');
reset role;
update private.memory_publications set hidden=true where id=current_setting('test.id')::uuid;
set role authenticated;
select pg_temp.fails($q$select public.prepare_memory_publication('bbbbbbbb-bbbb-4bbb-8bbb-000000000001',7,current_setting('test.selection')::jsonb)$q$,'PUBLICATION_RESTRICTED','hidden board cannot be republished by owner');
set role anon;
select pg_temp.ok(public.read_memory_publication(current_setting('test.id')::uuid) is null,'hidden board read denied');
reset role;
update private.memory_publications set hidden=false;
begin;
set local role anon;
select public.read_memory_publication(current_setting('test.id')::uuid);
select pg_temp.ok(current_setting('response.headers')::jsonb='[{"Cache-Control":"no-store"}]'::jsonb,'public reader requests no-store from PostgREST');
commit;
update private.memory_publication_settings set reads_enabled=false;
set role anon;
select pg_temp.ok(public.read_memory_publication(current_setting('test.id')::uuid) is null,'read kill switch blocks existing publication');
reset role;
select count(*) as passed_assertions from assertions;

-- Retire-before-sync: no source row is needed to prevent a delayed insert/replay.
begin;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
set local role authenticated;
select public.retire_memory_card_publications('cccccccc-cccc-4ccc-8ccc-000000000099');
select public.retire_memory_card_publications('cccccccc-cccc-4ccc-8ccc-000000000099');
select pg_temp.fails('select * from private.memory_publication_delete_fences','permission denied','client cannot read/delete withdrawal fences');
reset role;
select pg_temp.ok((select count(*)=1 from private.memory_publication_delete_fences where card_id='cccccccc-cccc-4ccc-8ccc-000000000099'),'retire unknown source creates one durable fence');
insert into public.memory_cards(id,user_id,catalog_anime_id,title_snapshot,status,client_updated_at)
values('cccccccc-cccc-4ccc-8ccc-000000000099','11111111-1111-4111-8111-111111111111',
  'anime:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Late source','COMPLETE_PRIVATE',now());
insert into private.memory_public_cards(id,user_id,card_id)
values('cccccccc-cccc-4ccc-8ccc-000000000098','11111111-1111-4111-8111-111111111111','cccccccc-cccc-4ccc-8ccc-000000000099');
select pg_temp.ok(not private.memory_public_card_readable('11111111-1111-4111-8111-111111111111',
  '{"id":"cccccccc-cccc-4ccc-8ccc-000000000098","visual":{"type":"SYSTEM_DESIGN","rendererVersion":1}}'),'late source and restored public row remain unreadable');
select pg_temp.fails($q$select private.build_memory_publication('11111111-1111-4111-8111-111111111111','bbbbbbbb-bbbb-4bbb-8bbb-000000000001',
  '{"title":"Late","description":"","cards":[{"cardId":"cccccccc-cccc-4ccc-8ccc-000000000099","fields":[]}]}')$q$,
  'PUBLICATION_RESTRICTED','late synced source cannot prepare public content');
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
set local role authenticated;
select public.retire_memory_card_publications('cccccccc-cccc-4ccc-8ccc-000000000002');
reset role;
select pg_temp.ok(not exists(select 1 from private.memory_publication_delete_fences
  where user_id='11111111-1111-4111-8111-111111111111' and card_id='cccccccc-cccc-4ccc-8ccc-000000000002'),'B cannot retire A namespace');
set local role anon;
select pg_temp.fails($q$select public.retire_memory_card_publications('cccccccc-cccc-4ccc-8ccc-000000000002')$q$,'permission denied','anonymous cannot retire a card');
reset role;
select count(*) as total_with_retirement_assertions from assertions;
rollback;
