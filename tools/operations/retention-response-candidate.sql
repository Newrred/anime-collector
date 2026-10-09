-- LOCAL REVIEW CANDIDATE ONLY. Not a hosted migration.
-- Applying a purge removes cached bodies irreversibly; preserve idempotency metadata.
create or replace function public.purge_expired_memory_tombstones(
  p_now timestamptz default now()
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cutoff timestamptz := p_now - interval '30 days';
  v_users_advanced integer := 0;
  v_max_watermark bigint := 0;
  v_board_cards integer := 0;
  v_assets integer := 0;
  v_cards integer := 0;
  v_boards integer := 0;
  v_private_titles integer := 0;
  v_changes integer := 0;
  v_payloads integer := 0;
begin
  with expired_by_user as (
    select user_id, max(sync_seq) as maximum_expired_seq
    from public.sync_changes
    where changed_at < v_cutoff
    group by user_id
  )
  select coalesce(max(greatest(p.minimum_retained_sync_seq, e.maximum_expired_seq)), 0)
  into v_max_watermark
  from expired_by_user e
  join public.user_profiles p on p.user_id = e.user_id;

  with expired_by_user as (
    select user_id, max(sync_seq) as maximum_expired_seq
    from public.sync_changes
    where changed_at < v_cutoff
    group by user_id
  )
  update public.user_profiles p
  set minimum_retained_sync_seq = greatest(
        p.minimum_retained_sync_seq,
        e.maximum_expired_seq
      ),
      server_updated_at = p_now
  from expired_by_user e
  where p.user_id = e.user_id
    and p.minimum_retained_sync_seq < e.maximum_expired_seq;
  get diagnostics v_users_advanced = row_count;

  delete from public.memory_board_cards bc
  where bc.deleted_at < v_cutoff;
  get diagnostics v_board_cards = row_count;

  delete from public.memory_visual_assets a
  where a.deleted_at < v_cutoff;
  get diagnostics v_assets = row_count;

  delete from public.memory_cards c
  where c.deleted_at < v_cutoff
    and not exists (
      select 1 from public.memory_visual_assets a where a.card_id = c.id
    )
    and not exists (
      select 1 from public.memory_board_cards bc where bc.card_id = c.id
    );
  get diagnostics v_cards = row_count;

  delete from public.memory_boards b
  where b.deleted_at < v_cutoff
    and not exists (
      select 1 from public.memory_board_cards bc where bc.board_id = b.id
    );
  get diagnostics v_boards = row_count;

  delete from public.memory_private_titles t
  where t.deleted_at < v_cutoff
    and not exists (
      select 1 from public.memory_cards c where c.private_title_id = t.id
    );
  get diagnostics v_private_titles = row_count;

  delete from public.sync_changes
  where changed_at < v_cutoff;
  get diagnostics v_changes = row_count;

  -- Preserve the operation ID/hash/result for retry safety. Remove only the
  -- cached entity body when the entity no longer exists for this owner.
  -- This also covers entities purged by earlier versions of the daily job.
  update public.sync_operations o
  set result_payload = jsonb_set(o.result_payload, '{remoteEntity}', 'null'::jsonb, false)
  where o.result_payload->'remoteEntity' is distinct from 'null'::jsonb
    and o.result_payload ? 'remoteEntity'
    and not exists (select 1 from public.memory_private_titles e where o.entity_type='PRIVATE_TITLE' and e.user_id=o.user_id and e.id=o.entity_id)
      and not exists (select 1 from public.memory_cards e where o.entity_type='MEMORY_CARD' and e.user_id=o.user_id and e.id=o.entity_id)
      and not exists (select 1 from public.memory_visual_assets e where o.entity_type='VISUAL_ASSET' and e.user_id=o.user_id and e.id=o.entity_id)
      and not exists (select 1 from public.memory_boards e where o.entity_type='MEMORY_BOARD' and e.user_id=o.user_id and e.id=o.entity_id)
      and not exists (select 1 from public.memory_board_cards e where o.entity_type='MEMORY_BOARD_CARD' and e.user_id=o.user_id and e.id=o.entity_id);
  get diagnostics v_payloads = row_count;

  return jsonb_build_object(
    'cutoff', v_cutoff,
    'usersAdvanced', v_users_advanced,
    'maximumWatermark', v_max_watermark,
    'purgedBoardCards', v_board_cards,
    'purgedVisualAssets', v_assets,
    'purgedCards', v_cards,
    'purgedBoards', v_boards,
    'purgedPrivateTitles', v_private_titles,
    'purgedChanges', v_changes,
    'scrubbedOperationBodies', v_payloads
  );
end;
$$;

revoke execute on function public.purge_expired_memory_tombstones(timestamptz)
  from public, anon, authenticated;
grant execute on function public.purge_expired_memory_tombstones(timestamptz)
  to service_role;
