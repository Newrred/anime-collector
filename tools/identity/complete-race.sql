begin;
set local application_name='identity-completion-race';
set local role service_role;
select public.complete_memory_identity_request(:'expected'::jsonb);
select pg_sleep(:hold);
commit;
