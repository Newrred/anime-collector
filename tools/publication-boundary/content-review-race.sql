begin;
set local application_name='moemoa-content-review-race';
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
set local role authenticated;
\if :{?revision}
\else
\set revision 0
\endif
select public.review_memory_publication_content(:'target'::uuid,:'hash',:'rating',:revision,'TEST_ONLY_CONTENT');
select pg_sleep(:hold);
commit;
