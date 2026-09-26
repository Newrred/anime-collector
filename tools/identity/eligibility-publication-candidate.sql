-- Local prototype. Keep shared writer (also used by follow) unchanged.
do $install$
declare f record; args text; old_name text; body text; installed integer:=0;
begin
 for f in select p.*,pg_get_function_identity_arguments(p.oid) identity_args,
   pg_get_function_arguments(p.oid) definition_args,pg_get_function_result(p.oid) result_type
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname in ('prepare_memory_publication','publish_memory_publication',
 'prepare_memory_minihome','publish_memory_minihome','reserve_memory_public_asset','reserve_memory_public_asset_from_private','authorize_memory_image_attempt') loop
   old_name:=f.proname||'_before_eligibility';
   select coalesce(string_agg(quote_ident(a),',' order by ord),'') into args from unnest(f.proargnames) with ordinality t(a,ord);
   execute format('alter function public.%I(%s) set schema private',f.proname,f.identity_args);
   execute format('alter function private.%I(%s) rename to %I',f.proname,f.identity_args,old_name);
   execute format('revoke all on function private.%I(%s) from public,anon,authenticated,service_role',old_name,f.identity_args);
   body:='declare actor uuid:=private.require_memory_user();';
   if f.result_type<>'void' then body:=body||' result '||f.result_type||';';end if;
   body:=body||' begin perform private.require_memory_eligibility(actor,''PUBLIC_PUBLISH''); ';
   body:=body||case when f.result_type='void' then 'perform ' else 'result:=' end||format('private.%I(%s); ',old_name,args);
   body:=body||'perform private.require_memory_eligibility(actor,''PUBLIC_PUBLISH''); '||case when f.result_type='void' then 'return;' else 'return result;' end||' end';
   execute format('create function public.%I(%s) returns %s language plpgsql security definer set search_path='''' as %L',f.proname,f.definition_args,f.result_type,body);
   execute format('revoke all on function public.%I(%s) from public,anon,authenticated,service_role',f.proname,f.identity_args);
   execute format('grant execute on function public.%I(%s) to authenticated',f.proname,f.identity_args);
   installed:=installed+1;
 end loop;
 if installed<>7 then raise exception 'Expected seven publication entrypoints, got %',installed;end if;
end $install$;

alter function public.complete_memory_public_asset(uuid,text,text,integer,integer,integer,integer) set schema private;
alter function private.complete_memory_public_asset(uuid,text,text,integer,integer,integer,integer) rename to complete_public_asset_before_eligibility;
revoke all on function private.complete_public_asset_before_eligibility(uuid,text,text,integer,integer,integer,integer) from public,anon,authenticated,service_role;
create function public.complete_memory_public_asset(p_id uuid,p_full_hash text,p_thumb_hash text,p_full_bytes integer,p_thumb_bytes integer,p_width integer,p_height integer)
 returns void language plpgsql security definer set search_path='' as $$
declare actor uuid;
begin
 select user_id into actor from private.memory_public_assets where id=p_id;
 if not found then raise exception 'ASSET_OPERATION_UNAVAILABLE';end if;
 perform private.require_memory_eligibility(actor,'PUBLIC_PUBLISH');
 perform private.complete_public_asset_before_eligibility(p_id,p_full_hash,p_thumb_hash,p_full_bytes,p_thumb_bytes,p_width,p_height);
 perform private.require_memory_eligibility(actor,'PUBLIC_PUBLISH');
end $$;
revoke all on function public.complete_memory_public_asset(uuid,text,text,integer,integer,integer,integer) from public,anon,authenticated,service_role;
grant execute on function public.complete_memory_public_asset(uuid,text,text,integer,integer,integer,integer) to service_role;
