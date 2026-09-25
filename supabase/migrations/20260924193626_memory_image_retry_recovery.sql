-- Owner-scoped recovery metadata. No source hash, private object path or other owner's ID.
create function public.get_memory_public_asset_operation(p_asset_id uuid,p_source_version bigint,p_operation_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare r private.memory_public_assets%rowtype;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
 select * into r from private.memory_public_assets where user_id=auth.uid() and operation_id=p_operation_id
  and source_asset_id=p_asset_id and source_version=p_source_version;
 if not found then return null; end if;
 return jsonb_build_object('id',r.id,'state',r.state,'reservationReleased',r.state='DELETED' and r.reserved_bytes=0);
end $$;

-- Targeted cleanup only after an authoritative failure/cancellation. Never cancel an in-flight commit.
create function public.claim_memory_failed_image_cleanup(p_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r private.memory_public_assets%rowtype;
begin
 select * into r from private.memory_public_assets where id=p_id for update;
 if not found or r.state not in ('FAILED','CANCELLED','DELETING') or private.public_asset_referenced(r.id) then return null; end if;
 update private.memory_public_assets set state='DELETING' where id=r.id;
 return jsonb_build_object('id',r.id,'prefix',r.object_prefix);
end $$;
revoke all on function public.get_memory_public_asset_operation(uuid,bigint,uuid) from public,anon,authenticated;
grant execute on function public.get_memory_public_asset_operation(uuid,bigint,uuid) to authenticated;
revoke all on function public.claim_memory_failed_image_cleanup(uuid) from public,anon,authenticated;
grant execute on function public.claim_memory_failed_image_cleanup(uuid) to service_role;
