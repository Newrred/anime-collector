-- Selective production rollout for moemoa.xyz only. Inspect the target project
-- and current Storage usage before running. Does not touch original local bytes.
begin;
do $$
declare p private.memory_private_media_policy;
begin
  perform private.lock_private_media();
  select * into strict p from private.memory_private_media_policy where id for update;
  if p.revision <> 'UNAPPROVED' or p.approved or p.enabled or p.paused then
    raise exception 'Unexpected private-image policy state';
  end if;
  if not exists(select 1 from storage.buckets where id='memory-private-representations' and not public) then
    raise exception 'Private bucket missing or public';
  end if;
  if exists(select 1 from storage.objects where bucket_id='memory-private-representations') then
    raise exception 'Unexpected existing private objects';
  end if;
  update private.memory_private_media_policy set
    revision='MOEMOA_PRIVATE_20261008_01', approved=true, enabled=true,
    paused=false, observed_at=now(),
    quota_bytes=50000000, physical_bytes=100000000,
    main_bytes=1000000, thumb_bytes=120000,
    preparations_per_day=20, decode_attempts_per_day=30,
    asset_count_max=60, upload_max_in_flight=2,
    read_bytes_per_month=250000000,
    global_read_bytes_per_month=500000000
  where id;
end $$;
-- SQL Editor runs do not automatically update Supabase's migration ledger.
-- Keep these three version-controlled schema changes traceable to this release.
do $$
begin
  if exists (
    select 1 from supabase_migrations.schema_migrations
    where version in ('20260925152858','20260925152859','20261008090000')
  ) then
    raise exception 'Private-image migration history already exists; inspect before retry';
  end if;
end $$;
insert into supabase_migrations.schema_migrations(version,name)
values
  ('20260925152858','private_image_delete_fence_compat'),
  ('20260925152859','memory_private_image_boundary'),
  ('20261008090000','private_image_observation');
select revision, approved, enabled, paused, observed_at,
  quota_bytes, physical_bytes, asset_count_max,
  read_bytes_per_month, global_read_bytes_per_month
from private.memory_private_media_policy where id;
commit;
