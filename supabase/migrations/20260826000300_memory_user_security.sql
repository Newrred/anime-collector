do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'user_profiles',
    'user_devices',
    'user_account_promotions',
    'user_preferences',
    'memory_private_titles',
    'memory_cards',
    'memory_visual_assets',
    'memory_boards',
    'memory_board_cards',
    'sync_operations',
    'sync_changes'
  ]
  loop
    execute format('alter table public.%I enable row level security', v_table);
    execute format(
      'revoke all on table public.%I from public, anon, authenticated',
      v_table
    );
    execute format('grant select on table public.%I to authenticated', v_table);
    execute format(
      'create policy %I on public.%I for select to authenticated using ((select auth.uid()) is not null and (select auth.uid()) = user_id)',
      v_table || '_select_own',
      v_table
    );
  end loop;
end;
$$;

revoke all on schema private from public, anon, authenticated;
revoke all on all functions in schema private from public, anon, authenticated;

revoke execute on function public.ensure_user_profile(text, text, text)
  from public, anon, authenticated;
revoke execute on function public.register_user_device(uuid, uuid, text, text)
  from public, anon, authenticated;
revoke execute on function public.promote_guest_memory(uuid, uuid, text, text, jsonb)
  from public, anon, authenticated;
revoke execute on function public.apply_memory_card_mutation(uuid, uuid, text, uuid, text, bigint, text, jsonb)
  from public, anon, authenticated;
revoke execute on function public.apply_board_mutation(uuid, uuid, text, uuid, text, bigint, text, jsonb)
  from public, anon, authenticated;
revoke execute on function public.pull_memory_changes(bigint, integer)
  from public, anon, authenticated;
revoke execute on function public.resolve_memory_conflict(uuid, uuid, text, uuid, bigint, text, jsonb)
  from public, anon, authenticated;

grant execute on function public.ensure_user_profile(text, text, text)
  to authenticated;
grant execute on function public.register_user_device(uuid, uuid, text, text)
  to authenticated;
grant execute on function public.promote_guest_memory(uuid, uuid, text, text, jsonb)
  to authenticated;
grant execute on function public.apply_memory_card_mutation(uuid, uuid, text, uuid, text, bigint, text, jsonb)
  to authenticated;
grant execute on function public.apply_board_mutation(uuid, uuid, text, uuid, text, bigint, text, jsonb)
  to authenticated;
grant execute on function public.pull_memory_changes(bigint, integer)
  to authenticated;
grant execute on function public.resolve_memory_conflict(uuid, uuid, text, uuid, bigint, text, jsonb)
  to authenticated;
