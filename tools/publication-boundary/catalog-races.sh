#!/usr/bin/env bash
# One expected predecessor; only one distinct candidate can replace it.
for candidate in b c; do
  digit=2; [[ "$candidate" != c ]] || digit=3
  "${psql[@]}" -c "set role service_role; select public.activate_catalog_release_checked('w16-$candidate',repeat('$digit',64),'w16-a')" > "$work/catalog-$candidate.log" 2>&1 &
  if [[ "$candidate" == b ]]; then catalog_b=$!; else catalog_c=$!; fi
done
success=0
if wait "$catalog_b"; then success=$((success+1)); else grep -q CATALOG_RELEASE_CONFLICT "$work/catalog-b.log"; fi
if wait "$catalog_c"; then success=$((success+1)); else grep -q CATALOG_RELEASE_CONFLICT "$work/catalog-c.log"; fi
[[ "$success" == 1 ]]
[[ "$("${psql[@]}" -Atc "select count(*) from public.catalog_releases where status='ACTIVE'")" == 1 ]]
echo "PASS: concurrent catalog transitions reject stale predecessor and retain one active release"
