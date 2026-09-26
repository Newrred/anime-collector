-- Local-only integration, loaded after eligibility prototype. No remote migration.
alter function public.authorize_memory_private_image_attempt(uuid,bigint,text) rename to authorize_memory_private_image_without_eligibility;
alter function public.reserve_memory_private_image(uuid,uuid,bigint,uuid,text,text,text,text,integer,integer,integer,integer) rename to reserve_memory_private_image_without_eligibility;
alter function public.complete_memory_private_image(uuid) rename to complete_memory_private_image_without_eligibility;
revoke all on function public.authorize_memory_private_image_without_eligibility(uuid,bigint,text),
 public.reserve_memory_private_image_without_eligibility(uuid,uuid,bigint,uuid,text,text,text,text,integer,integer,integer,integer),
 public.complete_memory_private_image_without_eligibility(uuid) from public,anon,authenticated,service_role;
create function public.authorize_memory_private_image_attempt(p_asset uuid,p_version bigint,p_policy text) returns void
 language plpgsql security definer set search_path='' as $$
begin
 perform private.require_memory_eligibility(private.require_memory_user(),'CLOUD_WRITE');
 perform private.lock_private_media();
 perform private.require_memory_eligibility(private.require_memory_user(),'CLOUD_WRITE');
 perform public.authorize_memory_private_image_without_eligibility(p_asset,p_version,p_policy);
end $$;
create function public.reserve_memory_private_image(p_owner uuid,p_asset uuid,p_version bigint,p_operation uuid,p_policy text,
 p_input_hash text,p_main_hash text,p_thumb_hash text,p_main_bytes integer,p_thumb_bytes integer,p_width integer,p_height integer)
 returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform private.require_memory_eligibility(p_owner,'CLOUD_WRITE');
 perform private.lock_private_media();
 perform private.require_memory_eligibility(p_owner,'CLOUD_WRITE');
 return public.reserve_memory_private_image_without_eligibility(p_owner,p_asset,p_version,p_operation,p_policy,
 p_input_hash,p_main_hash,p_thumb_hash,p_main_bytes,p_thumb_bytes,p_width,p_height);
end $$;
create function public.complete_memory_private_image(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare actor uuid;
begin
 select owner_id into actor from private.memory_private_media where id=p_id;
 if not found then raise exception 'NOT_FOUND';end if;
 perform private.require_memory_eligibility(actor,'CLOUD_WRITE');
 -- Expiration can pass while waiting for the existing media lock.
 perform private.lock_private_media();
 perform private.require_memory_eligibility(actor,'CLOUD_WRITE');
 perform public.complete_memory_private_image_without_eligibility(p_id);
end $$;
revoke all on function public.authorize_memory_private_image_attempt(uuid,bigint,text),
 public.reserve_memory_private_image(uuid,uuid,bigint,uuid,text,text,text,text,integer,integer,integer,integer),
 public.complete_memory_private_image(uuid) from public,anon,authenticated,service_role;
grant execute on function public.authorize_memory_private_image_attempt(uuid,bigint,text) to authenticated;
grant execute on function public.reserve_memory_private_image(uuid,uuid,bigint,uuid,text,text,text,text,integer,integer,integer,integer),
 public.complete_memory_private_image(uuid) to service_role;
