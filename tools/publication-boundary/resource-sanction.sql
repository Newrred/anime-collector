\set ON_ERROR_STOP on
begin;
set application_name='moemoa-w15-sanction';
set role authenticated;
select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true);
select public.review_memory_report(:'case_id'::uuid,:revision,:target_revision,'RESTRICT_ACCOUNT','Local concurrent restriction fixture');
select pg_sleep(1);
commit;
