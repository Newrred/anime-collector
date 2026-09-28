-- moemoa-test only; refresh the existing observation after checking actual usage.
-- Does not enable access, change limits/revision, or remove the 24-hour freshness gate.
begin;
do $$
declare p private.memory_private_media_policy; stored bigint; reserved bigint; reads bigint;
begin
  perform private.lock_private_media();
  select * into strict p from private.memory_private_media_policy where id for update;
  if p.revision <> 'TEST_ONLY_PHONE_WEB_20260927_01' or not p.enabled or not p.approved or p.paused
    or p.physical_bytes <> 41943040 or p.global_read_bytes_per_month <> 83886080 then
    raise exception 'Unexpected test policy';
  end if;
  if exists(select 1 from storage.objects where bucket_id='memory-private-representations' and metadata->>'size' is null) then
    raise exception 'Missing storage size';
  end if;
  select coalesce(sum((metadata->>'size')::bigint),0) into stored from storage.objects where bucket_id='memory-private-representations';
  select coalesce(sum(main_bytes+thumb_bytes),0) into reserved from private.memory_private_media where state<>'DELETED';
  select coalesce(sum(read_bytes),0) into reads from private.memory_private_media_meter where month=date_trunc('month',now() at time zone 'UTC')::date;
  if greatest(stored,reserved)>=p.physical_bytes or reads>=p.global_read_bytes_per_month then
    raise exception 'Test usage needs review';
  end if;
  update private.memory_private_media_policy set observed_at=now() where id;
end $$;
select revision, observed_at, enabled, approved, paused from private.memory_private_media_policy;
commit;
