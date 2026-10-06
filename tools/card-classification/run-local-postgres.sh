#!/usr/bin/env bash
# Disposable socket-only PostgreSQL. Never accepts a remote connection URL.
set -euo pipefail
root="$(cd "$(dirname "$0")/../.." && pwd)"
pg_bin="${PG_BIN:-/usr/lib/postgresql/16/bin}"
work="$(mktemp -d /tmp/moemoa-card-tags.XXXXXX)"
cleanup() { "$pg_bin/pg_ctl" -D "$work/data" -m immediate stop >/dev/null 2>&1 || true; }
trap cleanup EXIT
"$pg_bin/initdb" -D "$work/data" -A trust --no-locale -E UTF8 > "$work/init.log"
"$pg_bin/pg_ctl" -D "$work/data" -l "$work/server.log" -o "-k $work -p 55438 -c listen_addresses=''" start >/dev/null
psql=("$pg_bin/psql" -h "$work" -p 55438 -U "$(id -un)" -d postgres -X -v ON_ERROR_STOP=1)
"${psql[@]}" -f "$root/tools/publication-boundary/bootstrap.sql" >/dev/null
for migration in "$root"/supabase/migrations/*.sql; do
  if [[ "$(basename "$migration")" == '20260902055512_memory_user_retention.sql' ]]; then continue; fi
  if [[ "$(basename "$migration")" == '20260924115258_memory_resource_controls.sql' ]]; then
    "${psql[@]}" -f "$root/tools/publication-boundary/legacy-resource-fixture.sql" >/dev/null
  fi
  "${psql[@]}" -f "$migration" >/dev/null
done
"${psql[@]}" -f "$root/tools/card-classification/contract.sql"
echo "PASS: classification migration and private RPC contract; isolated artifacts: $work"
