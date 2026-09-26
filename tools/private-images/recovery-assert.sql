create function pg_temp.ok(v boolean,label text) returns void language plpgsql as $$
begin if v is distinct from true then raise exception 'FAIL: %',label; end if; raise notice 'PASS: %',label; end $$;
select pg_temp.ok((select not enabled from private.memory_private_media_policy),'private recovery remains closed');
select pg_temp.ok((select not reads_enabled and not writes_enabled and not images_enabled and not minihomes_enabled and not follows_enabled and not reports_enabled from private.memory_publication_settings),'public recovery remains closed');
select pg_temp.ok((select count(*)=1 from private.memory_private_media where id::text like '99999999-%' and state='READY'),'latest state and fence replay twice leaves one survivor');
select pg_temp.ok((select count(*)=0 from private.memory_private_media_cancelled where operation_id='88888888-8888-4888-8888-000000000003'),'known cancellation requires media state journal, not only cancelled table');
select pg_temp.ok((select count(*)=3 from public.memory_visual_assets where id::text like 'eeeeeeee-%' and checksum_sha256=repeat('a',64) and version=1),'original checksum and source version preserved');
select pg_temp.ok((select count(*)=3 from private.memory_private_media where id::text like '99999999-%' and state<>'DELETED'),'replay does not prematurely release physical quota for pending deletion');
-- Enable only inside this transaction to test the existing owner read RPC, then roll back.
begin;
update private.memory_private_media_policy set enabled=true,observed_at=now();
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
set local role authenticated;
select pg_temp.ok(public.read_memory_private_image('eeeeeeee-eeee-4eee-8eee-000000000001',1,'main',false)->>'id'='99999999-9999-4999-8999-000000000001','surviving manifest resolves through actual owner RPC');
do $$
declare asset uuid;
begin
 foreach asset in array array['eeeeeeee-eeee-4eee-8eee-000000000002'::uuid,'eeeeeeee-eeee-4eee-8eee-000000000003'::uuid] loop
  begin
   perform public.read_memory_private_image(asset,1,'main',false);
   raise exception 'Unexpected restored read';
  exception when others then
   if sqlerrm<>'NOT_FOUND' then raise; end if;
  end;
 end loop;
 raise notice 'PASS: card fence and cancelled operation both deny stale restored reads';
end $$;
rollback;
select pg_temp.ok((select not enabled from private.memory_private_media_policy),'read probe rolls back to closed policy');
