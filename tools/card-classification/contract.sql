create temp table assertions(label text);
grant all on assertions to authenticated,anon;
create function pg_temp.ok(pass boolean,label text) returns void language plpgsql as $$
begin if pass is distinct from true then raise exception 'FAIL: %',label; end if; insert into assertions values(label); end; $$;
create function pg_temp.fails(sql text,expected text,label text) returns void language plpgsql as $$
begin
  begin execute sql; exception when others then
    if position(expected in sqlerrm)=0 then raise exception 'FAIL: % (unexpected error: %)',label,sqlerrm; end if;
    insert into assertions values(label); return;
  end;
  raise exception 'FAIL: %',label;
end; $$;
insert into auth.users values('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222');
set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
select public.ensure_user_profile('Synthetic A','ko','Asia/Seoul');
select public.register_user_device('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','WEB','classification-test');
select public.apply_memory_card_mutation('11111111-1000-4000-8000-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','PRIVATE_TITLE','11111111-1001-4001-8001-111111111111','UPSERT',0,repeat('a',64),jsonb_build_object('displayTitle','Synthetic','normalizedTitle','synthetic','optionalGenres','[]'::jsonb,'clientUpdatedAt',now()));
create temp table results(name text,result jsonb);
insert into results select 'first', public.apply_memory_card_mutation('11111111-2000-4000-8000-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','MEMORY_CARD','11111111-2001-4001-8001-111111111111','UPSERT',0,repeat('b',64),
  jsonb_build_object('privateTitleId','11111111-1001-4001-8001-111111111111','titleSnapshot','Synthetic','status','DRAFT','note','existing note','watchedAtPrecision','UNKNOWN','emotionTags','[]'::jsonb,'clientUpdatedAt',now(),'classification','{"version":1,"tags":["rain"],"characters":[{"source":"ANILIST","id":"10","name":"Synthetic"}]}'::jsonb));
select pg_temp.ok((select result->>'status' from results where name='first')='APPLIED','new metadata mutation applied');
select pg_temp.ok((select classification->'tags' from public.memory_cards where id='11111111-2001-4001-8001-111111111111')='["rain"]'::jsonb,'classification stored privately');
select pg_temp.ok((select result->'remoteEntity'->'classification'->'tags' from results where name='first')='["rain"]'::jsonb,'mutation acknowledgement carries classification');
insert into results select 'replay', public.apply_memory_card_mutation('11111111-2000-4000-8000-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','MEMORY_CARD','11111111-2001-4001-8001-111111111111','UPSERT',0,repeat('b',64),'{}'::jsonb);
select pg_temp.ok((select result from results where name='first')=(select result from results where name='replay'),'idempotent replay preserves classification result');
select pg_temp.ok(coalesce(nullif(current_setting('moemoa.card_classification',true),''),'{}')='{}','transaction hydration config cleared');
select public.apply_memory_card_mutation('11111111-2002-4002-8002-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','MEMORY_CARD','11111111-2001-4001-8001-111111111111','UPSERT',1,repeat('c',64),
  jsonb_build_object('privateTitleId','11111111-1001-4001-8001-111111111111','titleSnapshot','Synthetic','status','DRAFT','note','updated note','watchedAtPrecision','UNKNOWN','emotionTags','[]'::jsonb,'clientUpdatedAt',now()));
select pg_temp.ok((select classification->'tags' from public.memory_cards where id='11111111-2001-4001-8001-111111111111')='["rain"]'::jsonb,'old-client update does not erase metadata');
select pg_temp.fails($q$select public.apply_memory_card_mutation('11111111-2003-4003-8003-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','MEMORY_CARD','11111111-2001-4001-8001-111111111111','UPSERT',2,repeat('d',64),jsonb_build_object('privateTitleId','11111111-1001-4001-8001-111111111111','titleSnapshot','Synthetic','status','DRAFT','note','bad','watchedAtPrecision','UNKNOWN','emotionTags','[]'::jsonb,'clientUpdatedAt',now(),'classification','{"version":1,"tags":[null],"characters":[]}'::jsonb))$q$,'CARD_CLASSIFICATION_INVALID','invalid classification rejected atomically');
select pg_temp.ok((select note from public.memory_cards where id='11111111-2001-4001-8001-111111111111')='updated note','failure preserves previous note');
insert into results select 'conflict', public.apply_memory_card_mutation('11111111-2005-4005-8005-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','MEMORY_CARD','11111111-2001-4001-8001-111111111111','UPSERT',1,repeat('1',64),'{"classification":{"version":1,"tags":["stale"],"characters":[]}}');
select pg_temp.ok((select result->>'status' from results where name='conflict')='CONFLICT'
  and (select result->'remoteEntity'->'classification'->'tags' from results where name='conflict')='["rain"]'::jsonb,'stale mutation keeps current classification in conflict result');
insert into results select 'resolve', public.resolve_memory_conflict('11111111-2006-4006-8006-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','MEMORY_CARD','11111111-2001-4001-8001-111111111111',2,repeat('2',64),
  jsonb_build_object('privateTitleId','11111111-1001-4001-8001-111111111111','titleSnapshot','Synthetic','status','DRAFT','note','resolved note','watchedAtPrecision','UNKNOWN','emotionTags','[]'::jsonb,'clientUpdatedAt',now(),'classification','{"version":1,"tags":["night"],"characters":[]}'::jsonb));
select pg_temp.ok((select result->>'status' from results where name='resolve')='APPLIED'
  and (select classification->'tags' from public.memory_cards where id='11111111-2001-4001-8001-111111111111')='["night"]'::jsonb,'conflict resolution applies classification with current version');
insert into results select 'promotion', public.promote_guest_memory('11111111-3000-4000-8000-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','guest:eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',repeat('3',64),
  jsonb_build_object('cards',jsonb_build_array(jsonb_build_object('id','11111111-3001-4001-8001-111111111111','privateTitleId','11111111-1001-4001-8001-111111111111','titleSnapshot','Synthetic promoted','status','DRAFT','classification','{"version":1,"tags":["promoted"],"characters":[{"source":"ANILIST","id":"20","name":"Synthetic B"}]}'::jsonb))));
select pg_temp.ok((select result->>'status' from results where name='promotion')='COMPLETED'
  and (select classification->'tags' from public.memory_cards where id='11111111-3001-4001-8001-111111111111')='["promoted"]'::jsonb,'guest promotion carries card-specific classification');
select pg_temp.fails($q$select public.apply_memory_card_mutation_before_classification(null,null,null,null,null,null,null,'{}')$q$,'permission denied','clients cannot bypass classification wrapper');
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false);
select public.ensure_user_profile('Synthetic B','en','UTC');
select public.register_user_device('cccccccc-cccc-4ccc-8ccc-cccccccccccc','dddddddd-dddd-4ddd-8ddd-dddddddddddd','WEB','classification-test');
select pg_temp.ok((select count(*) from public.memory_cards)=0,'owner B cannot read owner A classification');
select pg_temp.ok(public.apply_memory_card_mutation('22222222-2000-4000-8000-222222222222','cccccccc-cccc-4ccc-8ccc-cccccccccccc','MEMORY_CARD','11111111-2001-4001-8001-111111111111','UPSERT',2,repeat('e',64),'{}'::jsonb)->>'status'='REJECTED','cross-owner write rejected');
set role anon;
select pg_temp.fails('select classification from public.memory_cards','permission denied','anonymous classification access denied');
reset role;
select pg_temp.ok(not private.valid_memory_classification('{"version":1,"tags":[],"characters":[{"source":"ANILIST","id":"wrong","name":"X"}]}'::jsonb),'provider identifier validation');
select pg_temp.ok(not private.valid_memory_classification(jsonb_build_object('version',1,'tags',jsonb_build_array(repeat('x',49)),'characters','[]'::jsonb)),'tag length validation');
select pg_temp.ok(not private.valid_memory_classification('{"version":1,"tags":[],"characters":[],"privateBytes":"x"}'::jsonb),'unexpected private payload fields rejected');
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
set role authenticated;
select public.apply_memory_card_mutation('11111111-2004-4004-8004-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','MEMORY_CARD','11111111-2001-4001-8001-111111111111','DELETE',3,repeat('f',64),jsonb_build_object('clientUpdatedAt',now()));
select pg_temp.ok((select classification->'tags' from public.memory_cards where id='11111111-2001-4001-8001-111111111111')='[]'::jsonb,'deleted metadata is scrubbed');
select count(*) as passed_assertions from assertions;
