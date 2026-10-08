-- Existing offline outbox entries include {"designSpec":null}. The original
-- RPC reads that key with ->, which produces JSON null instead of SQL NULL.
-- Normalize only the non-design null sentinel before source metadata checks.
create or replace function private.normalize_memory_visual_asset_design_spec_null()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.asset_type in ('USER_IMAGE', 'CATALOG_COVER')
     and new.design_spec = 'null'::jsonb then
    new.design_spec := null;
  end if;
  return new;
end;
$$;

revoke all on function private.normalize_memory_visual_asset_design_spec_null()
  from public, anon, authenticated;

create trigger memory_visual_assets_normalize_json_null
before insert or update on public.memory_visual_assets
for each row execute function private.normalize_memory_visual_asset_design_spec_null();
