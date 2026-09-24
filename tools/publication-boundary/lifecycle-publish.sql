set application_name='moemoa-w10-publish';
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
set role authenticated;
begin;
select public.publish_memory_publication((p->>'id')::uuid,(p->>'revision')::bigint,
  p->>'reviewHash',p->>'policyRevision',gen_random_uuid())
from (select public.get_memory_publication('bbbbbbbb-bbbb-4bbb-8bbb-000000000001') p) s;
-- Hold the publish/source locks while a separate connection attempts withdrawal/deletion.
select pg_sleep(1);
commit;
