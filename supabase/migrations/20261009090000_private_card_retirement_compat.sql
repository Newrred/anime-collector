-- Selective private-only deployments need the same server-first deletion fence
-- as full publication deployments. Never replace an installed public boundary.
do $migration$
begin
  if to_regprocedure('public.retire_memory_card_publications(uuid)') is null then
    if to_regclass('private.memory_publications') is not null
      or to_regclass('private.memory_public_cards') is not null then
      raise exception 'PUBLICATION_WITHDRAWAL_UNCONFIRMED';
    end if;
    execute $definition$
      create function public.retire_memory_card_publications(p_card_id uuid)
      returns void language plpgsql security definer set search_path='' as $body$
      declare u uuid := auth.uid();
      begin
        if u is null then raise exception 'AUTH_REQUIRED'; end if;
        if p_card_id is null then raise exception 'INVALID_SELECTION'; end if;
        -- A later public rollout must install the full retirement implementation
        -- atomically. Never treat a UI flag as proof that no public copies exist.
        if to_regclass('private.memory_publications') is not null
          or to_regclass('private.memory_public_cards') is not null then
          raise exception 'PUBLICATION_WITHDRAWAL_UNCONFIRMED';
        end if;
        -- Fence delayed inserts too, and never reveal another owner's card.
        insert into private.memory_publication_delete_fences(user_id,card_id)
          values(u,p_card_id) on conflict do nothing;
      end $body$;
    $definition$;
    revoke all on function public.retire_memory_card_publications(uuid) from public,anon,authenticated;
    grant execute on function public.retire_memory_card_publications(uuid) to authenticated;
  end if;
end $migration$;
