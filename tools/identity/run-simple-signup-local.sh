#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "$0")/../.." && pwd)"
pg_bin="${PG_BIN:-/usr/lib/postgresql/16/bin}"
work="$(mktemp -d /tmp/moemoa-simple-signup.XXXXXX)"
trap '"$pg_bin/pg_ctl" -D "$work/data" -m immediate stop >/dev/null 2>&1 || true' EXIT
"$pg_bin/initdb" -D "$work/data" -A trust --no-locale -E UTF8 > "$work/init.log"
"$pg_bin/pg_ctl" -D "$work/data" -l "$work/server.log" -o "-k $work -p 55450 -c listen_addresses=''" start >/dev/null
psql=("$pg_bin/psql" -h "$work" -p 55450 -U "$(id -un)" -d postgres -X -v ON_ERROR_STOP=1)
"${psql[@]}" -f "$root/tools/publication-boundary/bootstrap.sql" >/dev/null
"${psql[@]}" -f "$root/supabase/migrations/20261009130000_simple_signup_declarations.sql" >/dev/null
"${psql[@]}" -f "$root/tools/identity/simple-signup-contract.sql" > "$work/results.log" 2>&1 || { cat "$work/results.log"; exit 1; }
grep 'PASS:' "$work/results.log"
echo 'LOCAL PostgreSQL only; hosted Auth admission not verified.'
