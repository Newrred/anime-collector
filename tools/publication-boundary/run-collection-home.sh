#!/usr/bin/env bash
# Isolated synthetic Postgres. Never accepts a remote connection string.
set -euo pipefail
root="$(cd "$(dirname "$0")/../.." && pwd)"
pg_bin="${PG_BIN:-/usr/lib/postgresql/16/bin}"
work="$(mktemp -d /tmp/moemoa-collection-home.XXXXXX)"
trap '"$pg_bin/pg_ctl" -D "$work/data" -m immediate stop >/dev/null 2>&1 || true' EXIT
"$pg_bin/initdb" -D "$work/data" -A trust --no-locale -E UTF8 > "$work/init.log"
"$pg_bin/pg_ctl" -D "$work/data" -l "$work/server.log" -o "-k $work -p 55439 -c listen_addresses=''" start >/dev/null
psql=("$pg_bin/psql" -h "$work" -p 55439 -U "$(id -un)" -d postgres -X -v ON_ERROR_STOP=1)
"${psql[@]}" -f "$root/tools/publication-boundary/bootstrap.sql" > "$work/migrations.log" 2>&1
for migration in "$root"/supabase/migrations/*.sql; do
 if [[ "$(basename "$migration")" == '20260902055512_memory_user_retention.sql' ]]; then continue; fi
 if ! "${psql[@]}" -f "$migration" >> "$work/migrations.log" 2>&1; then tail -30 "$work/migrations.log"; exit 1; fi
done
"${psql[@]}" -f "$root/tools/publication-boundary/collection-home-contract.sql" > "$work/contracts.log" 2>&1 || { cat "$work/contracts.log"; exit 1; }
grep 'PASS:' "$work/contracts.log"
echo "Collection/Home PostgreSQL contract PASS; local artifacts: $work"
