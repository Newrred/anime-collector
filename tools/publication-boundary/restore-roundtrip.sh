#!/usr/bin/env bash
# Current snapshot rehearsal only. A stale backup still needs an external withdrawal journal.
"$pg_bin/pg_dump" -h "$work" -p 55437 -U "$(id -un)" -d postgres -Fc -f "$work/recovery.dump"
"$pg_bin/createdb" -h "$work" -p 55437 -U "$(id -un)" moemoa_recovery
"$pg_bin/pg_restore" -h "$work" -p 55437 -U "$(id -un)" -d moemoa_recovery --exit-on-error "$work/recovery.dump"
restored=("$pg_bin/psql" -h "$work" -p 55437 -U "$(id -un)" -d moemoa_recovery -X -v ON_ERROR_STOP=1)
for table in public.memory_cards public.memory_boards public.memory_board_cards public.catalog_cover_revisions public.catalog_active_release private.memory_publication_delete_fences private.memory_public_cards private.memory_account_sanctions private.memory_reports private.memory_moderation_audit; do
  # Compare privately in memory; never output rows or digest values into ordinary logs.
  query="select md5(coalesce(string_agg(row_value::text,',' order by row_value::text),'')) from (select to_jsonb(t) row_value from $table t) q"
  [[ "$("${psql[@]}" -Atc "$query")" == "$("${restored[@]}" -Atc "$query")" ]]
done
echo "PASS: current DB backup restores exact Memory relationships, catalog revisions, withdrawal and moderation records"
"${restored[@]}" -c "update private.memory_publication_settings set reads_enabled=false,writes_enabled=false,images_enabled=false,minihomes_enabled=false,follows_enabled=false,reports_enabled=false" >/dev/null
[[ "$("${restored[@]}" -Atc "select not reads_enabled and not writes_enabled from private.memory_publication_settings")" == t ]]
echo "PASS: restored candidate stays closed pending latest withdrawal reconciliation and operator checks"

# Work only on the isolated recovery database, never on a hosted connection.
"${restored[@]}" -c "update private.memory_resource_policies set enabled=false,paused=false; delete from private.memory_account_sanctions" >/dev/null
"${restored[@]}" -f "$root/tools/publication-boundary/lifecycle-setup.sql" >/dev/null
"${restored[@]}" -f "$root/tools/publication-boundary/lifecycle-publish.sql" >/dev/null
recovery_public_id=$("${restored[@]}" -Atc "select id from private.memory_publications where board_id='bbbbbbbb-bbbb-4bbb-8bbb-000000000001'")
read_recovery="set role anon; select coalesce(jsonb_array_length(public.read_memory_publication('$recovery_public_id')->'cards'),0)"
[[ "$("${restored[@]}" -qAtc "$read_recovery")" == 1 ]]
"$pg_bin/pg_dump" -h "$work" -p 55437 -U "$(id -un)" -d moemoa_recovery -Fc -f "$work/stale.dump"
"${restored[@]}" -v delete_source=false -v global_revoke=true -v retire_fence=true -f "$root/tools/publication-boundary/lifecycle-retire.sql" >/dev/null
[[ "$("${restored[@]}" -qAtc "$read_recovery")" == 0 ]]
"${restored[@]}" -c "\copy private.memory_publication_delete_fences to '$work/latest-fences.csv' csv" >/dev/null
"$pg_bin/createdb" -h "$work" -p 55437 -U "$(id -un)" moemoa_stale_recovery
"$pg_bin/pg_restore" -h "$work" -p 55437 -U "$(id -un)" -d moemoa_stale_recovery --exit-on-error "$work/stale.dump"
stale=("$pg_bin/psql" -h "$work" -p 55437 -U "$(id -un)" -d moemoa_stale_recovery -X -v ON_ERROR_STOP=1)
# Negative control proves this particular old snapshot would expose the card.
[[ "$("${stale[@]}" -qAtc "$read_recovery")" == 1 ]]
"${stale[@]}" -c "update private.memory_publication_settings set reads_enabled=false,writes_enabled=false,images_enabled=false,minihomes_enabled=false,follows_enabled=false,reports_enabled=false" >/dev/null
[[ "$("${stale[@]}" -qAtc "$read_recovery")" == 0 ]]
for replay in 1 2; do
  "${stale[@]}" <<SQL >/dev/null
begin;
create temporary table latest_fences (like private.memory_publication_delete_fences including defaults) on commit drop;
\copy latest_fences from '$work/latest-fences.csv' csv
insert into private.memory_publication_delete_fences select * from latest_fences on conflict do nothing;
commit;
SQL
done
# Enable only reads in the local synthetic DB to prove the fence itself works.
"${stale[@]}" -c "update private.memory_publication_settings set reads_enabled=true" >/dev/null
[[ "$("${stale[@]}" -qAtc "$read_recovery")" == 0 ]]
"${stale[@]}" -c "update private.memory_publication_settings set reads_enabled=false" >/dev/null
echo "PASS: stale backup reproduces exposure, stays closed during recovery, and latest fence replay prevents resurrection (including duplicate replay)"
