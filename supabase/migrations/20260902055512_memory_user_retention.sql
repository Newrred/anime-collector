create extension if not exists pg_cron;

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

  return jsonb_build_object(
    'cutoff', v_cutoff,
    'usersAdvanced', v_users_advanced,
    'maximumWatermark', v_max_watermark,
    'purgedBoardCards', v_board_cards,
    'purgedVisualAssets', v_assets,
    'purgedCards', v_cards,
    'purgedBoards', v_boards,
    'purgedPrivateTitles', v_private_titles,
    'purgedChanges', v_changes
  );
end;
$$;

revoke execute on function public.purge_expired_memory_tombstones(timestamptz)
  from public, anon, authenticated;
grant execute on function public.purge_expired_memory_tombstones(timestamptz)
  to service_role;

select cron.schedule(
  'moemoa-memory-retention-daily',
  '15 3 * * *',
  'select public.purge_expired_memory_tombstones(now())'
);
