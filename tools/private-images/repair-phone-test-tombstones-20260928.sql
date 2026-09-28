-- Target ONLY moemoa-test (nmgkhknponvzcwliajyk), inspected fixture events 41/44.
-- Soft-state repair; no DELETE statements, original files or policy changes.
begin;
do $$
declare affected integer;
begin
  perform 1 from public.memory_visual_assets a
  join public.sync_changes c on c.entity_id=a.id and c.user_id=a.user_id
  join public.memory_cards m on m.id=a.card_id and m.user_id=a.user_id
  where c.sync_seq in (41,44) and c.entity_type='VISUAL_ASSET'
    and c.operation_type='DELETE' and c.entity_version=1
    and c.changed_at='2026-09-27T06:05:58.866403Z'::timestamptz
    and a.created_at='2026-09-27T06:05:28.981273Z'::timestamptz
    and a.version=1 and a.state='READY' and a.is_current and a.deleted_at is null
    and m.status='DELETED' and m.deleted_at is not null
  for update of a;
  get diagnostics affected = row_count;
  if affected<>2 then raise exception 'REPAIR_PRECONDITION_FAILED'; end if;
  with repaired as (
    update public.memory_visual_assets a
    set state='DELETED',is_current=false,deleted_at=m.deleted_at,
        version=a.version+1,server_updated_at=now()
    from public.sync_changes c,public.memory_cards m
    where c.sync_seq in (41,44) and c.entity_id=a.id and c.user_id=a.user_id
      and m.id=a.card_id and m.user_id=a.user_id
    returning a.id,a.user_id,a.version
  )
  insert into public.sync_changes(user_id,entity_type,entity_id,operation_type,entity_version)
  select user_id,'VISUAL_ASSET',id,'DELETE',version from repaired;
  get diagnostics affected = row_count;
  if affected<>2 then raise exception 'REPAIR_COUNT_MISMATCH'; end if;
end $$;
commit;
