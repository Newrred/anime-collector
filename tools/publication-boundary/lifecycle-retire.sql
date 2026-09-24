select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
\if :delete_source
update public.memory_cards set deleted_at=now(),status='DELETED' where id='cccccccc-cccc-4ccc-8ccc-000000000001';
-- A stale restored source must still be fenced after both transactions commit.
update public.memory_cards set deleted_at=null,status='COMPLETE_PRIVATE' where id='cccccccc-cccc-4ccc-8ccc-000000000001';
\else
set role authenticated;
\if :global_revoke
\if :retire_fence
select public.retire_memory_card_publications('cccccccc-cccc-4ccc-8ccc-000000000001');
\else
select public.revoke_memory_card_publications('cccccccc-cccc-4ccc-8ccc-000000000001');
\endif
\else
select public.revoke_memory_publication((p->>'id')::uuid,(p->>'revision')::bigint)
from (select public.get_memory_publication('bbbbbbbb-bbbb-4bbb-8bbb-000000000001') p) s;
\endif
\endif
