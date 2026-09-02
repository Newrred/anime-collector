create index memory_board_cards_owner_card_idx
  on public.memory_board_cards (user_id, card_id);

create index memory_visual_assets_owner_card_idx
  on public.memory_visual_assets (user_id, card_id);

create index sync_operations_owner_device_idx
  on public.sync_operations (user_id, device_id);

create index user_account_promotions_owner_device_idx
  on public.user_account_promotions (user_id, device_id);
