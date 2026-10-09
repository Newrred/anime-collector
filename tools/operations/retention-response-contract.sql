-- Synthetic content only, in a disposable local database.
begin;
create function pg_temp.ok(condition boolean,label text) returns void language plpgsql as $$
begin
  if condition is distinct from true then raise exception 'FAIL: %',label; end if;
  raise notice 'PASS: %',label;
end $$;
insert into auth.users(id) values ('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222');
insert into public.user_profiles(user_id,display_name) values ('11111111-1111-4111-8111-111111111111','Synthetic');
insert into public.user_devices(id,user_id,installation_id,platform,app_version)
values('dddddddd-dddd-4ddd-8ddd-dddddddddddd','11111111-1111-4111-8111-111111111111',gen_random_uuid(),'WEB','local-test');
create temp table fixtures(kind text,id uuid,operation_id uuid,status text,deleted_at timestamptz);
insert into fixtures values
 ('old',gen_random_uuid(),gen_random_uuid(),'APPLIED',now()-interval '31 days'),
 ('recent',gen_random_uuid(),gen_random_uuid(),'CONFLICT',now()-interval '29 days'),
 ('active',gen_random_uuid(),gen_random_uuid(),'APPLIED',null);
insert into public.memory_boards(id,user_id,title,client_updated_at,deleted_at)
select id,'11111111-1111-4111-8111-111111111111','SYNTHETIC_BODY_'||kind,now(),deleted_at from fixtures;
insert into public.sync_changes(user_id,entity_type,entity_id,operation_type,entity_version,changed_at)
select '11111111-1111-4111-8111-111111111111','MEMORY_BOARD',id,'DELETE',1,deleted_at from fixtures where deleted_at is not null;
select private.record_memory_operation('11111111-1111-4111-8111-111111111111',
 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',operation_id,'MEMORY_BOARD',id,'UPSERT',0,repeat('a',64),status,1,1,null) from fixtures;
create temp table original_operations as select * from public.sync_operations;
select public.purge_expired_memory_tombstones(now());
select pg_temp.ok(not exists(select 1 from public.memory_boards where id=(select id from fixtures where kind='old'))
 and (select result_payload->'remoteEntity'->>'title' like 'SYNTHETIC_BODY_%' from public.sync_operations where operation_id=(select operation_id from fixtures where kind='old')),
 'BEFORE: original purge removes row but retains cached private body');

\ir retention-response-candidate.sql
select pg_temp.ok(not has_function_privilege('anon','public.purge_expired_memory_tombstones(timestamptz)','EXECUTE')
 and not has_function_privilege('authenticated','public.purge_expired_memory_tombstones(timestamptz)','EXECUTE')
 and has_function_privilege('service_role','public.purge_expired_memory_tombstones(timestamptz)','EXECUTE'), 'service-only purge ACL preserved');
create temp table result as select public.purge_expired_memory_tombstones(now()) as value;
select pg_temp.ok((select value->>'scrubbedOperationBodies'='1' from result),'AFTER: previously purged entity body scrubbed');
select pg_temp.ok(not exists(select 1 from public.sync_operations n join original_operations o using(operation_id)
 where (to_jsonb(n)-'result_payload') is distinct from (to_jsonb(o)-'result_payload')
 or (n.result_payload-'remoteEntity') is distinct from (o.result_payload-'remoteEntity')), 'operation ID, hash, status, version and result acknowledgement preserved');
select pg_temp.ok((select count(*)=2 from public.sync_operations o join fixtures f on f.operation_id=o.operation_id
 where f.kind in ('recent','active') and o.result_payload->'remoteEntity'->>'title' like 'SYNTHETIC_BODY_%'), '29-day and active bodies preserved');
select pg_temp.ok((select private.replay_memory_operation(operation_id,'11111111-1111-4111-8111-111111111111',repeat('a',64))
 = jsonb_set(o.result_payload,'{remoteEntity}','null') from original_operations o join fixtures f using(operation_id) where f.kind='old'), 'same operation retry returns acknowledgement without deleted content');
select pg_temp.ok((select private.replay_memory_operation(operation_id,'11111111-1111-4111-8111-111111111111',repeat('b',64))->>'errorCode'='OPERATION_HASH_MISMATCH'
 from fixtures where kind='old'), 'different request cannot reuse scrubbed operation');
select pg_temp.ok((select private.replay_memory_operation(operation_id,'22222222-2222-4222-8222-222222222222',repeat('a',64))->>'errorCode'='OPERATION_ID_CONFLICT'
 from fixtures where kind='old'), 'other account cannot replay scrubbed operation');
select pg_temp.ok((public.purge_expired_memory_tombstones(now())->>'scrubbedOperationBodies')::int=0, 'repeated purge is idempotent');
select pg_temp.ok((select minimum_retained_sync_seq>0 from public.user_profiles),'existing full-resync watermark preserved');
select pg_temp.ok((public.purge_expired_memory_tombstones(now()+interval '2 days')->>'scrubbedOperationBodies')::int=1,
 'newly expired conflict body purged in same transaction');
select pg_temp.ok((select result_status='CONFLICT' and result_payload->'remoteEntity'='null'::jsonb from public.sync_operations
 where operation_id=(select operation_id from fixtures where kind='recent')), 'expired conflict preserves terminal outcome with nullable body');
rollback;
