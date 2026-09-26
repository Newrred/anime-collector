savepoint home_queue;
select pg_temp.ok(exists(select 1 from jsonb_array_elements(public.list_memory_pending_content('home')->'items') q where q->>'id'=current_setting('test.home')),'unclassified home enters review queue');
select set_config('test.home_review',public.open_memory_content_review('home',current_setting('test.home')::uuid)::text,true);
select pg_temp.ok(current_setting('test.home_review')::jsonb->>'contentRevision'='0','initial home review starts at zero');
select pg_temp.ok(public.open_memory_content_review('home',current_setting('test.home')::uuid)->>'id'=current_setting('test.home_review')::jsonb->>'id','same home review reuses case');
select pg_temp.ok(public.resolve_memory_content_appeal((current_setting('test.home_review')::jsonb->>'id')::uuid,0,0,current_setting('test.home_review')::jsonb->>'reviewHash','GENERAL','TEST_ONLY_CONTENT')->>'status'='CLOSED','exact first home review closes case');
select pg_temp.ok(not exists(select 1 from jsonb_array_elements(public.list_memory_pending_content('home')->'items') q where q->>'id'=current_setting('test.home')),'classified home leaves queue');
reset role;
update private.memory_minihomes set published_selection=jsonb_set(published_selection,'{bio}','"Synthetic changed bio"') where id=current_setting('test.home')::uuid;
set local role authenticated;
select pg_temp.ok(exists(select 1 from jsonb_array_elements(public.list_memory_pending_content('home')->'items') q where q->>'id'=current_setting('test.home')),'changed home returns to queue');
select set_config('test.home_review',public.open_memory_content_review('home',current_setting('test.home')::uuid)::text,true);
reset role;
update private.memory_minihomes set published_selection=jsonb_set(published_selection,'{bio}','"Changed after review opened"') where id=current_setting('test.home')::uuid;
set local role authenticated;
select pg_temp.fails($q$select public.resolve_memory_content_appeal((current_setting('test.home_review')::jsonb->>'id')::uuid,0,1,current_setting('test.home_review')::jsonb->>'reviewHash','GENERAL','TEST_ONLY_CONTENT')$q$,'PUBLICATION_CONFLICT','changed home refuses old classification');
reset role;
update private.memory_minihomes set published_selection=null where id=current_setting('test.home')::uuid;
set local role authenticated;
select pg_temp.fails($q$select public.get_memory_content_review((current_setting('test.home_review')::jsonb->>'id')::uuid)$q$,'NOT_FOUND','withdrawn home no longer offers review content');
select pg_temp.ok(not exists(select 1 from jsonb_array_elements(public.list_memory_pending_content('home')->'items') q where q->>'id'=current_setting('test.home')),'withdrawn home leaves queue');
reset role;
rollback to home_queue;

savepoint home_pagination;
reset role;
-- Isolate pagination from pre-existing fixtures without deleting any data.
update private.memory_minihomes set published_selection=null;
insert into auth.users(id) select ('eeeeeeee-eeee-4eee-8eee-'||lpad(n::text,12,'0'))::uuid from generate_series(1,25) n;
insert into private.memory_minihomes(id,user_id,published_selection)
select id,id,jsonb_build_object('nickname','Synthetic review target','bio','','entries','[]'::jsonb)
from auth.users where id between 'eeeeeeee-eeee-4eee-8eee-000000000001' and 'eeeeeeee-eeee-4eee-8eee-000000000025';
set local role authenticated;
select set_config('test.home_page1',public.list_memory_pending_content('home')::text,true);
select pg_temp.ok(jsonb_array_length(current_setting('test.home_page1')::jsonb->'items')=20,'home queue first page capped at twenty');
select pg_temp.ok(current_setting('test.home_page1')::jsonb->>'next'='eeeeeeee-eeee-4eee-8eee-000000000020','home cursor is last returned item');
select set_config('test.home_page2',public.list_memory_pending_content('home',(current_setting('test.home_page1')::jsonb->>'next')::uuid)::text,true);
select pg_temp.ok(jsonb_array_length(current_setting('test.home_page2')::jsonb->'items')=5 and current_setting('test.home_page2')::jsonb->>'next' is null,'home final page has five and no cursor');
select pg_temp.ok((select count(distinct q->>'id')=25 from jsonb_array_elements((current_setting('test.home_page1')::jsonb->'items')||(current_setting('test.home_page2')::jsonb->'items')) q),'home pages have no duplication or omission');
select pg_temp.ok(public.list_memory_pending_content('home','eeeeeeee-eeee-4eee-8eee-000000000025')->'items'='[]'::jsonb,'home cursor beyond final target returns empty page');
select pg_temp.fails($q$select public.list_memory_pending_content('invalid')$q$,'INVALID_SELECTION','queue rejects invalid target kind');
reset role;
rollback to home_pagination;
set local role authenticated;
