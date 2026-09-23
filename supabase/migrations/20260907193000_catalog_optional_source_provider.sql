-- Provider metadata does not define MOEMOA title identity.
-- No rows, release pointers, permissions, or user data are changed.
alter table public.catalog_assets
  drop constraint catalog_assets_source_provider_check;
alter table public.catalog_assets
  add constraint catalog_assets_source_provider_check
  check (source_provider in ('ANILIST', 'ANILIFE'));
