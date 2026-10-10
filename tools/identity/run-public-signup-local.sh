#!/usr/bin/env bash
# Disposable PostgreSQL only; no URL, credentials or hosted changes.
set -euo pipefail
root="$(cd "$(dirname "$0")/../.." && pwd)"
pg_bin="${PG_BIN:-/usr/lib/postgresql/16/bin}"
work="$(mktemp -d /tmp/moemoa-public-signup.XXXXXX)"
trap '"$pg_bin/pg_ctl" -D "$work/data" -m immediate stop >/dev/null 2>&1 || true' EXIT
"$pg_bin/initdb" -D "$work/data" -A trust --no-locale -E UTF8 > "$work/init.log"
"$pg_bin/pg_ctl" -D "$work/data" -l "$work/server.log" -o "-k $work -p 55455 -c listen_addresses=''" start >/dev/null
psql=("$pg_bin/psql" -h "$work" -p 55455 -U "$(id -un)" -d postgres -X -q -v ON_ERROR_STOP=1)
"${psql[@]}" -f "$root/tools/publication-boundary/bootstrap.sql" > "$work/setup.log" 2>&1
for migration in "$root"/supabase/migrations/*.sql; do
 case "$(basename "$migration")" in
  20260902055512_memory_user_retention.sql) continue ;;
  20260924115258_memory_resource_controls.sql)
   "${psql[@]}" -f "$root/tools/publication-boundary/legacy-resource-fixture.sql" >> "$work/setup.log" 2>&1 ;;
 esac
 "${psql[@]}" -f "$migration" >> "$work/setup.log" 2>&1 || { tail -35 "$work/setup.log"; exit 1; }
done
"${psql[@]}" -f "$root/tools/identity/public-signup-contract.sql" > "$work/result.log" 2>&1 || { cat "$work/result.log"; exit 1; }
grep 'PASS:' "$work/result.log"
echo 'LOCAL SQL boundary only; no hosted Google or production activation.'
