create function pg_temp.ok(value boolean,label text) returns void language plpgsql as $$begin if value is distinct from true then raise exception 'FAIL: %',label;end if;raise notice 'PASS: %',label;end $$;
create function pg_temp.fails(statement text,expected text,label text) returns void language plpgsql as $$begin begin execute statement;exception when others then if position(expected in sqlerrm)>0 then perform pg_temp.ok(true,label);return;end if;raise;end;raise exception 'Unexpected success: %',label;end $$;
select set_config('test.viewer.board',(select id::text from private.memory_publications where board_id='55555555-5555-4555-8555-555555555550'),false);
select set_config('test.viewer.asset',(select id::text from private.memory_public_assets where operation_id='44444444-4444-4444-8444-444444444442'),false);
-- Synthetic published snapshot and exact review fixture: does not verify publication/moderation UX.
update private.memory_publications set published_snapshot=jsonb_set(published_snapshot,'{cards,0,visual}',jsonb_build_object('type','USER_IMAGE','assetId',current_setting('test.viewer.asset')))
 where id=current_setting('test.viewer.board')::uuid;
update private.memory_content_reviews r set snapshot_hash=encode(sha256(convert_to(p.published_snapshot::text,'UTF8')),'hex') from private.memory_publications p where r.publication_id=p.id and p.id=current_setting('test.viewer.board')::uuid;
select set_config('request.jwt.claim.sub','',false);
select set_config('request.jwt.claims','{}',false);
select set_config('test.viewer.exp',floor(extract(epoch from clock_timestamp()+interval '1 hour'))::text,false);
set role service_role;
select pg_temp.ok(public.resolve_memory_public_image(current_setting('test.viewer.board')::uuid,current_setting('test.viewer.asset')::uuid,'full') is null,'service without viewer context cannot read mature image');
select pg_temp.ok(public.resolve_memory_viewer_image(current_setting('test.viewer.board')::uuid,current_setting('test.viewer.asset')::uuid,'full','88888888-8888-4888-8888-888888888888','33333333-3333-4333-8333-333333333333',current_setting('test.viewer.exp')::bigint)->>'hash'=repeat('a',64),'service verified viewer context resolves mature image');
select pg_temp.ok(current_setting('request.jwt.claim.sub')='' and current_setting('request.jwt.claims')='{}','viewer context restored within same connection');
select pg_temp.ok(public.resolve_memory_viewer_image(current_setting('test.viewer.board')::uuid,current_setting('test.viewer.asset')::uuid,'full','88888888-8888-4888-8888-888888888888','33333333-3333-4333-8333-333333333333',0) is null,'expired token context cannot resolve image');
reset role;
set role authenticated;
select pg_temp.fails($q$select public.resolve_memory_viewer_image(null,null,'full',null,null,0)$q$,'permission denied','client cannot impersonate viewer or obtain storage coordinates');
reset role;
update private.memory_eligibility_evidence set state='REVOKED' where purpose='MATURE_VIEW';
set role service_role;
select pg_temp.ok(public.resolve_memory_viewer_image(current_setting('test.viewer.board')::uuid,current_setting('test.viewer.asset')::uuid,'full','88888888-8888-4888-8888-888888888888','33333333-3333-4333-8333-333333333333',current_setting('test.viewer.exp')::bigint) is null,'next image resolution sees eligibility revocation');
reset role;
