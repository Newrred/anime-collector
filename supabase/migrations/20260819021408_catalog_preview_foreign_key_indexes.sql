create index if not exists catalog_active_release_release_id_idx
  on public.catalog_active_release (release_id);

create index if not exists catalog_anime_search_cover_asset_idx
  on public.catalog_anime_search (release_id, cover_asset_id);
