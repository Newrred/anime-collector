-- Runs after existing capacity contract in the same disposable database (new session).
create function pg_temp.ok(value boolean,label text) returns void language plpgsql as $$begin if value is distinct from true then raise exception 'FAIL: %',label;end if;raise notice 'PASS: %',label;end$$;
select pg_temp.ok(not has_function_privilege('anon','public.authorize_memory_sized_image_delivery(uuid,text,text,text)','EXECUTE') and not has_function_privilege('authenticated','public.authorize_memory_sized_image_delivery(uuid,text,text,text)','EXECUTE'),'sized delivery denied to client roles');
select pg_temp.ok(has_function_privilege('service_role','public.authorize_memory_sized_image_delivery(uuid,text,text,text)','EXECUTE'),'sized delivery service grant');
select set_config('request.jwt.claim.role','',false);
do $$begin perform public.authorize_memory_sized_image_delivery(null,null,null,null);raise exception 'FAIL missing role';exception when others then if sqlerrm<>'AUTH_REQUIRED' then raise;end if;end$$;
select pg_temp.ok(true,'sized delivery missing service claim rejected');
select set_config('request.jwt.claim.role','service_role',false);
insert into private.memory_public_assets(id,object_prefix,user_id,card_id,source_asset_id,source_version,source_hash,operation_id,policy_revision,state,full_hash,thumb_hash,full_bytes,thumb_bytes,width,height)
values('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222',gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),1,repeat('a',64),gen_random_uuid(),'SYNTHETIC','READY',repeat('b',64),repeat('c',64),400,42,20,30);
update private.memory_resource_policies set enabled=true,paused=false,daily_limit=case when scope='IMAGE_DELIVERY' then 1000 else 1000 end where scope in('IMAGE_DELIVERY','IMAGE_DELIVERY_BYTES');
-- Previous capacity contract expires overrides; use a fresh counter for this fixture.
delete from private.memory_resource_usage where scope in('IMAGE_DELIVERY','IMAGE_DELIVERY_BYTES');
select pg_temp.ok(public.authorize_memory_sized_image_delivery('11111111-1111-4111-8111-111111111111','thumb','22222222-2222-4222-8222-222222222222/thumb.webp',repeat('c',64))=42,'thumb reserves persisted thumbnail bytes');
select pg_temp.ok(public.authorize_memory_sized_image_delivery('11111111-1111-4111-8111-111111111111','full','22222222-2222-4222-8222-222222222222/full.webp',repeat('b',64))=400,'full reserves persisted full bytes');
select pg_temp.ok((public.observe_memory_public_image_capacity()->>'deliveryBytesUsed')::bigint=442 and (public.observe_memory_public_image_capacity()->>'deliveryUsed')::int=2,'sized counters visible in existing observation');
do $$declare v text; p text; h text;begin
 for v,p,h in select * from (values
 ('other','22222222-2222-4222-8222-222222222222/full.webp',repeat('b',64)),
 (null,'22222222-2222-4222-8222-222222222222/full.webp',repeat('b',64)),
 ('full',null,repeat('b',64)),('full','wrong',repeat('b',64)),
 ('full','22222222-2222-4222-8222-222222222222/thumb.webp',repeat('c',64)),
 ('full','22222222-2222-4222-8222-222222222222/full.webp',null),
 ('full','22222222-2222-4222-8222-222222222222/full.webp',repeat('d',64))) as cases(v,p,h) loop
 begin perform public.authorize_memory_sized_image_delivery('11111111-1111-4111-8111-111111111111',v,p,h);raise exception 'FAIL binding';
 exception when others then if sqlerrm<>'NOT_FOUND' then raise;end if;end;
 end loop;end$$;
select pg_temp.ok((public.observe_memory_public_image_capacity()->>'deliveryBytesUsed')::bigint=442,'variant/path/hash/null mismatch never charges');
update private.memory_public_assets set state='DELETING' where id='11111111-1111-4111-8111-111111111111';
do $$begin perform public.authorize_memory_sized_image_delivery('11111111-1111-4111-8111-111111111111','full','22222222-2222-4222-8222-222222222222/full.webp',repeat('b',64));raise exception 'FAIL retired';exception when others then if sqlerrm<>'NOT_FOUND' then raise;end if;end$$;
select pg_temp.ok(true,'retired derivative rejected');
update private.memory_public_assets set state='READY' where id='11111111-1111-4111-8111-111111111111';
update private.memory_resource_policies set daily_limit=442 where scope='IMAGE_DELIVERY_BYTES';
do $$begin perform public.authorize_memory_sized_image_delivery('11111111-1111-4111-8111-111111111111','thumb','22222222-2222-4222-8222-222222222222/thumb.webp',repeat('c',64));raise exception 'FAIL budget';exception when others then if sqlerrm<>'RATE_LIMITED' then raise;end if;end$$;
select pg_temp.ok((public.observe_memory_public_image_capacity()->>'deliveryBytesUsed')::bigint=442 and (public.observe_memory_public_image_capacity()->>'deliveryUsed')::int=2,'byte exhaustion rolls back request count atomically');
update private.memory_resource_policies set daily_limit=1000,paused=true where scope='IMAGE_DELIVERY';
do $$begin perform public.authorize_memory_sized_image_delivery('11111111-1111-4111-8111-111111111111','thumb','22222222-2222-4222-8222-222222222222/thumb.webp',repeat('c',64));raise exception 'FAIL paused';exception when others then if sqlerrm<>'PUBLICATION_DISABLED' then raise;end if;end$$;
select pg_temp.ok((public.observe_memory_public_image_capacity()->>'deliveryBytesUsed')::bigint=442,'pause rejects without byte consumption');
