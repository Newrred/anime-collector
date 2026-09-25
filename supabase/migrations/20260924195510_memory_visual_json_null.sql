-- W08: preserve request hash/id while accepting absent non-design metadata.
create or replace function private.hydrate_catalog_cover_memory_asset()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_refs jsonb;
  v_ref jsonb;
begin
  -- JSON null from the unchanged client DTO represents absent design metadata.
  new.design_spec := nullif(new.design_spec, 'null'::jsonb);
  if new.asset_type = 'CATALOG_COVER' then
    v_refs := coalesce(nullif(current_setting('moemoa.catalog_cover_refs', true), ''), '{}')::jsonb;
    v_ref := v_refs -> new.id::text;
    if v_ref is not null then
      if v_ref ->> 'sourceKind' <> 'CATALOG_COVER'
         or v_ref ->> 'rightsBasis' <> 'EXPLICIT_PERMISSION' then
        raise exception 'CATALOG_COVER_REFERENCE_INVALID';
      end if;
      new.catalog_cover_id := nullif(v_ref ->> 'catalogCoverId', '');
      new.catalog_cover_revision_id := nullif(v_ref ->> 'catalogCoverRevisionId', '');
      new.catalog_anime_id := nullif(v_ref ->> 'catalogAnimeId', '');
      new.permission_verified_at := nullif(v_ref ->> 'permissionVerifiedAt', '')::timestamptz;
    end if;
  else
    new.catalog_cover_id := null;
    new.catalog_cover_revision_id := null;
    new.catalog_anime_id := null;
    new.permission_verified_at := null;
  end if;
  return new;
end;
$$;

