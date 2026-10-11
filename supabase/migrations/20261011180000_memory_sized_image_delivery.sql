-- W15: service-only reservation bound to an already authorized immutable derivative.
-- Does not authorize visibility, enable flags, change limits, or refund failed downloads.
create function public.authorize_memory_sized_image_delivery(
 p_asset_id uuid, p_variant text, p_path text, p_hash text
) returns bigint language plpgsql security definer set search_path='' as $$
declare a private.memory_public_assets%rowtype; v_bytes bigint; v_hash text;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'AUTH_REQUIRED'; end if;
 if p_variant is null or p_variant not in ('full','thumb') then raise exception 'NOT_FOUND'; end if;
 select * into a from private.memory_public_assets where id=p_asset_id and state='READY' for share;
 if not found then raise exception 'NOT_FOUND'; end if;
 v_bytes:=case when p_variant='full' then a.full_bytes else a.thumb_bytes end;
 v_hash:=case when p_variant='full' then a.full_hash else a.thumb_hash end;
 if p_path is distinct from a.object_prefix::text||'/'||p_variant||'.webp'
  or p_hash is distinct from v_hash or v_hash is null or v_hash !~ '^[a-f0-9]{64}$'
  or v_bytes is null or v_bytes not between 1 and 2097152 then raise exception 'NOT_FOUND'; end if;
 perform public.authorize_memory_image_delivery(v_bytes);
 return v_bytes;
end $$;
revoke all on function public.authorize_memory_sized_image_delivery(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.authorize_memory_sized_image_delivery(uuid,text,text,text) to service_role;
