#!/usr/bin/env bash
# Run as a non-root user with PostgreSQL binaries installed. No remote URL accepted.
set -euo pipefail
root="$(cd "$(dirname "$0")/../.." && pwd)"
pg_bin="${PG_BIN:-/usr/lib/postgresql/14/bin}"
work="$(mktemp -d /tmp/moemoa-publication-test.XXXXXX)"
cleanup() { "$pg_bin/pg_ctl" -D "$work/data" -m immediate stop >/dev/null 2>&1 || true; }
trap cleanup EXIT
"$pg_bin/initdb" -D "$work/data" -A trust --no-locale -E UTF8 > "$work/init.log"
"$pg_bin/pg_ctl" -D "$work/data" -l "$work/server.log" -o "-k $work -p 55437 -c listen_addresses=''" start >/dev/null
psql=("$pg_bin/psql" -h "$work" -p 55437 -U "$(id -un)" -d postgres -X -v ON_ERROR_STOP=1)
"${psql[@]}" -f "$root/tools/publication-boundary/bootstrap.sql" >/dev/null
for migration in "$root"/supabase/migrations/*.sql; do
  # pg_cron is a Supabase/platform extension. Retention is outside this isolated test.
  if [[ "$(basename "$migration")" == '20260902055512_memory_user_retention.sql' ]]; then continue; fi
  if [[ "$(basename "$migration")" == '20260924115258_memory_resource_controls.sql' ]]; then
    "${psql[@]}" -f "$root/tools/publication-boundary/legacy-resource-fixture.sql" >/dev/null
  fi
  "${psql[@]}" -f "$migration" >/dev/null
done
"${psql[@]}" -f "$root/tools/publication-boundary/contract.sql"
"${psql[@]}" -f "$root/tools/publication-boundary/concurrent-prepare.sql" > "$work/concurrent-a.log" 2>&1 &
a=$!
"${psql[@]}" -f "$root/tools/publication-boundary/concurrent-prepare.sql" > "$work/concurrent-b.log" 2>&1 &
b=$!
success=0
if wait "$a"; then success=$((success+1)); else grep -q PUBLICATION_CONFLICT "$work/concurrent-a.log"; fi
if wait "$b"; then success=$((success+1)); else grep -q PUBLICATION_CONFLICT "$work/concurrent-b.log"; fi
[[ "$success" == 1 ]]
[[ "$("${psql[@]}" -Atc "select revision from private.memory_publications where board_id='bbbbbbbb-bbbb-4bbb-8bbb-000000000001'")" == 8 ]]
echo "PASS: two simultaneous prepares produce one winner and one revision conflict"
"${psql[@]}" -f "$root/tools/publication-boundary/image-contract.sql"
"${psql[@]}" -f "$root/tools/publication-boundary/representation-contract.sql"
"${psql[@]}" -c "update private.memory_public_assets set state='DELETED',reserved_bytes=0 where state='DELETING'" >/dev/null
"${psql[@]}" -v operation=ffffffff-ffff-4fff-8fff-000000000001 -f "$root/tools/publication-boundary/concurrent-image.sql" > "$work/image-a.log" 2>&1 &
a=$!
"${psql[@]}" -v operation=ffffffff-ffff-4fff-8fff-000000000002 -f "$root/tools/publication-boundary/concurrent-image.sql" > "$work/image-b.log" 2>&1 &
b=$!
success=0
if wait "$a"; then success=$((success+1)); else grep -q IMAGE_QUOTA_EXCEEDED "$work/image-a.log"; fi
if wait "$b"; then success=$((success+1)); else grep -q IMAGE_QUOTA_EXCEEDED "$work/image-b.log"; fi
[[ "$success" == 1 ]]
echo "PASS: simultaneous image reservations cannot exceed account quota"
for action in global retire delete board; do
  "${psql[@]}" -f "$root/tools/publication-boundary/lifecycle-setup.sql" >/dev/null
  "${psql[@]}" -f "$root/tools/publication-boundary/lifecycle-publish.sql" > "$work/lifecycle-publish-$action.log" 2>&1 &
  publisher=$!
  ready=false
  for attempt in $(seq 1 100); do
    if [[ "$("${psql[@]}" -Atc "select exists(select 1 from pg_stat_activity where application_name='moemoa-w10-publish' and wait_event='PgSleep')")" == t ]]; then ready=true; break; fi
    sleep 0.02
  done
  [[ "$ready" == true ]]
  delete_source=false; global_revoke=false; retire_fence=false
  [[ "$action" != delete ]] || delete_source=true
  [[ "$action" != global ]] || global_revoke=true
  if [[ "$action" == retire ]]; then global_revoke=true; retire_fence=true; fi
  # Board revoke reads the pre-commit revision; a conflict is safe and must be retried with fresh state.
  if ! "${psql[@]}" -v delete_source="$delete_source" -v global_revoke="$global_revoke" -v retire_fence="$retire_fence" -f "$root/tools/publication-boundary/lifecycle-retire.sql" > "$work/lifecycle-retire-$action.log" 2>&1; then
    [[ "$action" == board ]]
    grep -q PUBLICATION_CONFLICT "$work/lifecycle-retire-$action.log"
    wait "$publisher"
    "${psql[@]}" -v delete_source=false -v global_revoke=false -v retire_fence=false -f "$root/tools/publication-boundary/lifecycle-retire.sql" >/dev/null
  else
    wait "$publisher"
  fi
  public_id=$("${psql[@]}" -Atc "select id from private.memory_publications where board_id='bbbbbbbb-bbbb-4bbb-8bbb-000000000001'")
  [[ "$("${psql[@]}" -qAtc "set role anon; select coalesce(jsonb_array_length(public.read_memory_publication('$public_id')->'cards'),0)")" == 0 ]]
  echo "PASS: concurrent publish / $action leaves no anonymous card after withdrawal (including source restore)"
done
"${psql[@]}" -f "$root/tools/publication-boundary/minihome-contract.sql"
"${psql[@]}" -f "$root/tools/publication-boundary/relationships-contract.sql"
"${psql[@]}" -c "update private.memory_publication_settings set follows_enabled=true,writes_enabled=true" >/dev/null
home_a=$("${psql[@]}" -Atc "select id from private.memory_minihomes where user_id='11111111-1111-4111-8111-111111111111'")
home_b=$("${psql[@]}" -Atc "select id from private.memory_minihomes where user_id='22222222-2222-4222-8222-222222222222'")
"${psql[@]}" -v home="$home_a" -f "$root/tools/publication-boundary/relationship-race.sql" > "$work/block.log" 2>&1 &
blocker=$!
ready=false
for attempt in $(seq 1 100); do
  if [[ "$("${psql[@]}" -Atc "select exists(select 1 from pg_stat_activity where application_name='moemoa-w12-block' and wait_event='PgSleep')")" == t ]]; then ready=true; break; fi
  sleep 0.02
done
[[ "$ready" == true ]]
if "${psql[@]}" -c "set role authenticated; select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false); select public.set_memory_relationship('$home_b','follow')" > "$work/follow.log" 2>&1; then exit 1; fi
grep -q PUBLICATION_RESTRICTED "$work/follow.log"
wait "$blocker"
[[ "$("${psql[@]}" -Atc "select count(*) from private.memory_relationships where following")" == 0 ]]
echo "PASS: simultaneous opposing block/follow leaves no follow"
"${psql[@]}" -f "$root/tools/publication-boundary/moderation-contract.sql"
source "$root/tools/publication-boundary/moderation-races.sh"
"${psql[@]}" -f "$root/tools/publication-boundary/resource-contract.sql"
source "$root/tools/publication-boundary/resource-races.sh"
"${psql[@]}" -f "$root/tools/publication-boundary/catalog-contract.sql"
source "$root/tools/publication-boundary/catalog-races.sh"
source "$root/tools/publication-boundary/restore-roundtrip.sh"
"${psql[@]}" -f "$root/tools/operations/status.sql" > "$work/operator-status.log"
echo "PostgreSQL publication contract PASS; local artifacts: $work"
