begin;

create extension if not exists pgtap with schema extensions;

select plan(19);

select has_table('public', 'user_profiles', 'user_profiles table exists');
select has_table('public', 'user_devices', 'user_devices table exists');
select has_table('public', 'user_account_promotions', 'user_account_promotions table exists');
select has_table('public', 'user_preferences', 'user_preferences table exists');
select has_table('public', 'memory_private_titles', 'memory_private_titles table exists');
select has_table('public', 'memory_cards', 'memory_cards table exists');
select has_table('public', 'memory_visual_assets', 'memory_visual_assets table exists');
select has_table('public', 'memory_boards', 'memory_boards table exists');
select has_table('public', 'memory_board_cards', 'memory_board_cards table exists');
select has_table('public', 'sync_operations', 'sync_operations table exists');
select has_table('public', 'sync_changes', 'sync_changes table exists');
select col_is_pk('public', 'memory_cards', 'id', 'memory_cards.id is the primary key');
select has_column('public', 'memory_cards', 'version', 'memory_cards has optimistic version');
select has_column('public', 'memory_cards', 'deleted_at', 'memory_cards has a tombstone timestamp');
select has_column('public', 'memory_visual_assets', 'design_spec', 'visual assets can carry a system design');
select has_column('public', 'user_profiles', 'minimum_retained_sync_seq', 'profiles keep the sync retention watermark');
select has_index('public', 'memory_visual_assets', 'memory_visual_assets_current_card_idx', 'one current asset index exists');
select has_index('public', 'sync_changes', 'sync_changes_user_seq_idx', 'per-user sync sequence index exists');
select hasnt_table('public', 'user_snapshots', 'legacy user_snapshots table remains absent');

select * from finish();

rollback;
