-- Aggregate-only observation. No counters, policy, image or publication changes.
create function public.observe_memory_public_image_capacity() returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if auth.role() is distinct from 'service_role' then raise exception 'AUTH_REQUIRED'; end if;
 return (
-- CAPACITY_SELECT_BEGIN
with objects as (
 select bucket_id, case when metadata->>'size' ~ '^[0-9]{1,15}$' then (metadata->>'size')::bigint else 0 end bytes,
 not coalesce(metadata->>'size' ~ '^[0-9]{1,15}$',false) invalid from storage.objects
), storage as (
 select coalesce(sum(bytes),0) total,
 coalesce(sum(bytes) filter(where bucket_id='memory-private-representations'),0) private_bytes,
 coalesce(sum(bytes) filter(where bucket_id='memory-public-derivatives'),0) public_bytes,
 count(*) filter(where invalid) invalid from objects
), assets as (
 select coalesce(sum(reserved_bytes) filter(where state<>'DELETED'),0) reserved,
 coalesce(sum(full_bytes) filter(where state<>'DELETED'),0) full_bytes,
 coalesce(sum(thumb_bytes) filter(where state<>'DELETED'),0) thumb_bytes,
 count(*) filter(where state='PREPARING') preparing,
 count(*) filter(where state='FAILED') failed,
 count(*) filter(where state in ('FAILED','CANCELLED','DELETING')) pending,
 count(*) filter(where state in ('PREPARING','FAILED','CANCELLED','DELETING') and expires_at<now()-interval '24 hours') overdue
 from private.memory_public_assets
), delivery as (
 select p.scope,p.enabled,p.paused,coalesce(o.daily_limit,p.daily_limit) daily_limit,
 coalesce(case when u.window_day=(now() at time zone 'UTC')::date then u.used else 0 end,0) used
 from private.memory_resource_policies p left join private.memory_resource_usage u
 on u.scope=p.scope and u.actor='00000000-0000-0000-0000-000000000000'
 left join private.memory_resource_overrides o on o.scope=p.scope
 and o.actor='00000000-0000-0000-0000-000000000000' and o.expires_at>now()
 where p.scope in ('IMAGE_DELIVERY','IMAGE_DELIVERY_BYTES')
)
select jsonb_build_object(
 'observedAt',now(),'totalStoredBytes',s.total,'privateStoredBytes',s.private_bytes,'publicStoredBytes',s.public_bytes,
 'invalidObjectCount',s.invalid,'publicReservedBytes',a.reserved,'fullBytes',a.full_bytes,'thumbBytes',a.thumb_bytes,
 'privateReservedBytes',(select coalesce(sum(main_bytes+thumb_bytes),0) from private.memory_private_media where state<>'DELETED'),
 'preparingCount',a.preparing,'failedCount',a.failed,'cleanupPendingCount',a.pending,'overdueCount',a.overdue,
 'publicStorageLimitBytes',(select max_reserved_bytes from private.memory_public_storage_policy where singleton),
 'publicStorageBudgetEnabled',(select enabled from private.memory_public_storage_policy where singleton),
 'readsEnabled',(select reads_enabled from private.memory_publication_settings where singleton),
 'deliveryEnabled',(select enabled from delivery where scope='IMAGE_DELIVERY'),
 'deliveryPaused',(select paused from delivery where scope='IMAGE_DELIVERY'),
 'deliveryDailyLimit',(select daily_limit from delivery where scope='IMAGE_DELIVERY'),
 'deliveryUsed',(select used from delivery where scope='IMAGE_DELIVERY'),
 'deliveryBytesEnabled',(select enabled from delivery where scope='IMAGE_DELIVERY_BYTES'),
 'deliveryBytesPaused',(select paused from delivery where scope='IMAGE_DELIVERY_BYTES'),
 'deliveryBytesDailyLimit',(select daily_limit from delivery where scope='IMAGE_DELIVERY_BYTES'),
 'deliveryBytesUsed',(select used from delivery where scope='IMAGE_DELIVERY_BYTES')
) from storage s cross join assets a
-- CAPACITY_SELECT_END
 );
end $$;
revoke all on function public.observe_memory_public_image_capacity() from public,anon,authenticated;
grant execute on function public.observe_memory_public_image_capacity() to service_role;
