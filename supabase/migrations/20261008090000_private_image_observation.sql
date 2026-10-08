-- Refresh the private-image freshness gate only after measuring actual Storage
-- objects and reservations. Called by the server's service-role maintenance job.
create function public.observe_memory_private_image_capacity() returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  p private.memory_private_media_policy;
  stored_bytes bigint;
  reserved_bytes bigint;
  global_read_bytes bigint;
  observed timestamptz;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'AUTH_REQUIRED'; end if;
  perform private.lock_private_media();
  select * into strict p from private.memory_private_media_policy where id for update;
  if not p.enabled or not p.approved then raise exception 'PRIVATE_IMAGE_DISABLED'; end if;
  if p.paused then raise exception 'PRIVATE_IMAGE_PAUSED'; end if;
  if exists(select 1 from storage.objects where bucket_id='memory-private-representations'
    and (metadata->>'size' is null or metadata->>'size' !~ '^[0-9]+$')) then
    raise exception 'PRIVATE_IMAGE_POLICY_STALE';
  end if;
  select coalesce(sum((metadata->>'size')::bigint),0) into stored_bytes
    from storage.objects where bucket_id='memory-private-representations';
  select coalesce(sum(main_bytes+thumb_bytes),0) into reserved_bytes
    from private.memory_private_media where state<>'DELETED';
  select coalesce(read_bytes,0) into global_read_bytes
    from private.memory_private_media_meter
    where owner_id='00000000-0000-0000-0000-000000000000'
      and month=date_trunc('month',now() at time zone 'UTC')::date;
  global_read_bytes:=coalesce(global_read_bytes,0);
  if greatest(stored_bytes,reserved_bytes)>p.physical_bytes
    or global_read_bytes>p.global_read_bytes_per_month then
    raise exception 'PRIVATE_IMAGE_CAPACITY_EXCEEDED';
  end if;
  observed:=now();
  update private.memory_private_media_policy set observed_at=observed where id;
  return jsonb_build_object('observedAt',observed,'storedBytes',stored_bytes,
    'reservedBytes',reserved_bytes,'globalReadBytes',global_read_bytes,
    'revision',p.revision);
end $$;
revoke all on function public.observe_memory_private_image_capacity() from public,anon,authenticated;
grant execute on function public.observe_memory_private_image_capacity() to service_role;
