-- Synthetic rows in the actual public-asset table, in a disposable local DB.
create function pg_temp.check_true(ok boolean,label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAIL: %',label; end if; raise notice 'PASS: %',label; end$$;
create function pg_temp.reject_sql(stmt text,label text) returns void language plpgsql as $$
begin
 begin execute stmt;
 exception when others then
  if sqlerrm='IMAGE_QUOTA_EXCEEDED' then raise notice 'PASS: %',label; return; end if;
  raise;
 end;
 raise exception 'FAIL: %',label;
end$$;
create function pg_temp.asset(owner_id uuid,bytes bigint) returns uuid language plpgsql as $$
declare result uuid;
begin
 insert into private.memory_public_assets(user_id,card_id,source_asset_id,source_version,source_hash,operation_id,policy_revision,reserved_bytes)
 values(owner_id,gen_random_uuid(),gen_random_uuid(),1,repeat('a',64),gen_random_uuid(),'LOCAL_ONLY',bytes) returning id into result;
 return result;
end$$;
select pg_temp.check_true((select not enabled from private.memory_public_storage_policy),'migration defaults off');
select pg_temp.check_true(not has_table_privilege('authenticated','private.memory_public_storage_policy','UPDATE') and not has_table_privilege('anon','private.memory_public_storage_policy','SELECT'),'client cannot read or change budget');
update private.memory_public_storage_policy set enabled=true,max_reserved_bytes=8;
select pg_temp.asset('11111111-1111-4111-8111-111111111111',4);
select pg_temp.asset('22222222-2222-4222-8222-222222222222',4);
select pg_temp.reject_sql($q$select pg_temp.asset('33333333-3333-4333-8333-333333333333',1)$q$,'different owner cannot exceed global cap');
select pg_temp.reject_sql($q$update private.memory_public_assets set reserved_bytes=5 where user_id='11111111-1111-4111-8111-111111111111'$q$,'increasing existing reservation cannot exceed cap');
update private.memory_public_assets set state='DELETING' where user_id='11111111-1111-4111-8111-111111111111';
select pg_temp.reject_sql($q$select pg_temp.asset('33333333-3333-4333-8333-333333333333',1)$q$,'deletion pending still consumes capacity');
update private.memory_public_assets set state='FAILED' where user_id='22222222-2222-4222-8222-222222222222';
select pg_temp.reject_sql($q$select pg_temp.asset('33333333-3333-4333-8333-333333333333',1)$q$,'failed attempt still consumes capacity');
update private.memory_public_assets set reserved_bytes=2 where user_id='22222222-2222-4222-8222-222222222222';
select pg_temp.asset('33333333-3333-4333-8333-333333333333',2);
select pg_temp.check_true((select sum(reserved_bytes)=8 from private.memory_public_assets),'shrinking reservation returns only actual delta');
update private.memory_public_assets set state='DELETED',reserved_bytes=0 where user_id='11111111-1111-4111-8111-111111111111';
select pg_temp.asset('44444444-4444-4444-8444-444444444444',4);
select pg_temp.check_true((select count(*)=4 and sum(reserved_bytes)=8 from private.memory_public_assets),'finalized deletion releases bytes while preserving operation row');
-- The following truncation is only synthetic fixture reset in this local DB.
truncate private.memory_public_assets;
update private.memory_public_storage_policy set max_reserved_bytes=4194304;
