\set ON_ERROR_STOP on
create function pg_temp.ok(condition boolean,label text) returns void language plpgsql as $$
begin if condition is distinct from true then raise exception 'FAIL: %',label; end if; raise notice 'PASS: %',label; end $$;
create function pg_temp.fails(statement text,expected text,label text) returns void language plpgsql as $$
begin begin execute statement; exception when others then
if position(expected in sqlerrm)>0 then perform pg_temp.ok(true,label); return; end if; raise; end;
raise exception 'Unexpected success: %',label; end $$;
update private.memory_publication_accounts set hidden=false,write_blocked=false;
update private.memory_publication_settings set minihomes_enabled=true,reads_enabled=true,writes_enabled=true;
select set_config('test.home',(select id::text from private.memory_minihomes where user_id='11111111-1111-4111-8111-111111111111'),false);
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false);
set role authenticated;
select pg_temp.fails($q$select public.set_memory_relationship(current_setting('test.home')::uuid,'follow')$q$,'PUBLICATION_DISABLED','follow defaults off');
reset role;
update private.memory_publication_settings set follows_enabled=true;
set role authenticated;
select pg_temp.ok(public.set_memory_relationship(current_setting('test.home')::uuid,'follow')->>'following'='true','B follows public A');
select pg_temp.ok(public.set_memory_relationship(current_setting('test.home')::uuid,'follow')->>'following'='true','duplicate follow succeeds');
select pg_temp.ok(jsonb_array_length(public.list_memory_relationships()->'items')=1,'own list contains one revisit target');
select pg_temp.ok(not ((public.list_memory_relationships()->'items'->0) ? 'user_id'),'list omits account identifiers');
select pg_temp.fails('select * from private.memory_relationships','permission denied','direct relationship table denied');
select pg_temp.ok(public.set_memory_relationship(current_setting('test.home')::uuid,'block')->>'following'='false','block removes follow');
select pg_temp.ok(jsonb_array_length(public.list_memory_relationships()->'items')=0,'blocked excluded from following');
select pg_temp.ok(jsonb_array_length(public.list_memory_relationships(true)->'items')=1,'own blocks can be managed');
select pg_temp.fails($q$select public.set_memory_relationship(current_setting('test.home')::uuid,'follow')$q$,'PUBLICATION_RESTRICTED','blocked follow denied');
select pg_temp.ok(public.set_memory_relationship(current_setting('test.home')::uuid,'unblock')->>'following'='false','unblock never restores follow');
select public.set_memory_relationship(current_setting('test.home')::uuid,'follow');
reset role;
update private.memory_publication_accounts set hidden=true where user_id='11111111-1111-4111-8111-111111111111';
set role authenticated;
select pg_temp.ok(public.list_memory_relationships()->'items'->0->>'nickname' is null,'unavailable target conceals nickname and reason');
select pg_temp.ok(public.set_memory_relationship(current_setting('test.home')::uuid,'unfollow')->>'following'='false','unavailable target can be unfollowed');
select pg_temp.ok(public.set_memory_relationship(current_setting('test.home')::uuid,'unfollow')->>'following'='false','repeat unfollow safe');
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
select pg_temp.ok(jsonb_array_length(public.list_memory_relationships()->'items')=0,'A cannot see B relationships');
select pg_temp.fails($q$select public.set_memory_relationship(current_setting('test.home')::uuid,'follow')$q$,'INVALID_OPERATION','self follow denied');
set role anon;
select pg_temp.fails('select public.list_memory_relationships()','permission denied','anonymous graph denied');
select pg_temp.fails($q$select public.set_memory_relationship(current_setting('test.home')::uuid,'block')$q$,'permission denied','anonymous mutation denied');
reset role;
update private.memory_publication_accounts set hidden=false;
insert into private.memory_minihomes(user_id,published_selection)
select '22222222-2222-4222-8222-222222222222',published_selection from private.memory_minihomes where id=current_setting('test.home')::uuid;
select set_config('test.homeb',(select id::text from private.memory_minihomes where user_id='22222222-2222-4222-8222-222222222222'),false);
set role authenticated;
select public.set_memory_relationship(current_setting('test.homeb')::uuid,'follow');
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false);
select public.set_memory_relationship(current_setting('test.home')::uuid,'follow');
select public.set_memory_relationship(current_setting('test.home')::uuid,'block');
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
select pg_temp.ok(public.get_memory_relationship(current_setting('test.homeb')::uuid)->>'following'='false','block removes reverse follow');
select pg_temp.fails($q$select public.set_memory_relationship(current_setting('test.homeb')::uuid,'follow')$q$,'PUBLICATION_RESTRICTED','blocked user cannot follow blocker');
select pg_temp.ok(public.read_memory_minihome(current_setting('test.homeb')::uuid) is not null,'block does not claim to withdraw public content');
reset role;
update private.memory_publication_settings set follows_enabled=false,writes_enabled=false;
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false);
set role authenticated;
select pg_temp.ok(public.set_memory_relationship(current_setting('test.home')::uuid,'unblock')->>'blocked'='false','kill switch permits unblock');
