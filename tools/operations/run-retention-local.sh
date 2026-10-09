#!/usr/bin/env bash
# Disposable socket-only PostgreSQL. No hosted connection or credentials.
set -euo pipefail
root="$(cd "$(dirname "$0")/../.." && pwd)"
pg_bin="/usr/lib/postgresql/16/bin"
work="$(mktemp -d /tmp/moemoa-retention.XXXXXX)"
trap '"$pg_bin/pg_ctl" -D "$work/data" -m immediate stop >/dev/null 2>&1 || true' EXIT
"$pg_bin/initdb" -D "$work/data" -A trust --no-locale -E UTF8 > "$work/init.log"
"$pg_bin/pg_ctl" -D "$work/data" -l "$work/server.log" -o "-k $work -p 55453 -c listen_addresses=''" start >/dev/null
psql=("$pg_bin/psql" -h "$work" -p 55453 -U "$(id -un)" -d postgres -X -v ON_ERROR_STOP=1)
"${psql[@]}" -f "$root/tools/publication-boundary/bootstrap.sql" >/dev/null
for version in 20260819021327 20260819021408 20260902054107 20260902054119 20260902054132; do
  for migration in "$root"/supabase/migrations/"${version}"_*.sql; do
    "${psql[@]}" -f "$migration" >/dev/null
  done
done
# Execute the exact existing function/ACL; pg_cron scheduling is tested separately
# by read-only hosted observation, not simulated as a local PASS.
sed '/^create extension /d; /^select cron.schedule(/,$d' "$root/supabase/migrations/20260902055512_memory_user_retention.sql" > "$work/existing.sql"
"${psql[@]}" -f "$work/existing.sql" >/dev/null
"${psql[@]}" -f "$root/tools/operations/retention-response-contract.sql" > "$work/results.log" 2>&1 || { cat "$work/results.log"; exit 1; }
grep 'PASS:' "$work/results.log"
echo 'LOCAL candidate only; no hosted mutation or scheduler execution.'
