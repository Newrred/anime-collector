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
echo "PostgreSQL publication contract PASS; local artifacts: $work"
