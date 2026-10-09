#!/usr/bin/env bash
# Targeted private-only -> public-schema upgrade. Synthetic local DB; no network.
set -euo pipefail
root="$(cd "$(dirname "$0")/../.." && pwd)"
pg_bin="${PG_BIN:-/usr/lib/postgresql/16/bin}"
work="$(mktemp -d /tmp/moemoa-upgrade.XXXXXX)"
cleanup() { "$pg_bin/pg_ctl" -D "$work/data" -m immediate stop >/dev/null 2>&1 || true; }
trap cleanup EXIT
"$pg_bin/initdb" -D "$work/data" -A trust --no-locale -E UTF8 > "$work/init.log"
"$pg_bin/pg_ctl" -D "$work/data" -l "$work/server.log" -o "-k $work -p 55441 -c listen_addresses=''" start >/dev/null
psql=("$pg_bin/psql" -h "$work" -p 55441 -U "$(id -un)" -d postgres -X -v ON_ERROR_STOP=1)
"${psql[@]}" -f "$root/tools/publication-boundary/bootstrap.sql" > "$work/baseline.log"
for version in 20260819021327 20260819021408 20260902054107 20260902054119 20260902054132 \
  20260902055852 20260903141500 20260907193000 20260925152858 20260925152859 \
  20261005090000 20261007093000 20261008090000 20261008093000 20261009090000; do
  for migration in "$root"/supabase/migrations/"${version}"_*.sql; do
    "${psql[@]}" -f "$migration" >> "$work/baseline.log"
  done
done
"${psql[@]}" -f "$root/tools/operations/public-upgrade-contract.sql" > "$work/contract.log" 2>&1 || { cat "$work/contract.log"; exit 1; }
cat "$work/contract.log"
echo "PASS: targeted public upgrade rehearsal; local artifacts: $work"
