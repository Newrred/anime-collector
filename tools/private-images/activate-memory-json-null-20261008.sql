-- Release MOEMOA_MEMORY_JSON_NULL_20261008_01.
-- Run against the production project only after reviewing the version-controlled
-- migration 20261008093000_memory_visual_asset_json_null_compat.sql.
-- Additive compatibility for queued offline image metadata; no rows are rewritten.
begin;
do $$
begin
  if exists (
    select 1 from supabase_migrations.schema_migrations
    where version = '20261008093000'
  ) or exists (
    select 1 from pg_trigger
    where tgrelid = 'public.memory_visual_assets'::regclass
      and tgname = 'memory_visual_assets_normalize_json_null'
      and not tgisinternal
  ) then
    raise exception 'JSON-null compatibility already applied; inspect before retry';
  end if;
end $$;

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

insert into supabase_migrations.schema_migrations(version,name)
values ('20261008093000','memory_visual_asset_json_null_compat');
commit;
