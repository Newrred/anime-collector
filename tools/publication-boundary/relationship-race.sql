\set ON_ERROR_STOP on
begin;
set application_name='moemoa-w12-block';
set role authenticated;
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
select public.set_memory_relationship(:'home'::uuid,'block');
select pg_sleep(1);
commit;
