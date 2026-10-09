#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "$0")/../.." && pwd)"
pg_bin="/usr/lib/postgresql/16/bin"
work="$(mktemp -d /tmp/moemoa-public-budget.XXXXXX)"
trap '"$pg_bin/pg_ctl" -D "$work/data" -m immediate stop >/dev/null 2>&1 || true' EXIT
"$pg_bin/initdb" -D "$work/data" -A trust --no-locale -E UTF8 > "$work/init.log"
"$pg_bin/pg_ctl" -D "$work/data" -l "$work/server.log" -o "-k $work -p 55454 -c listen_addresses=''" start >/dev/null
psql=("$pg_bin/psql" -h "$work" -p 55454 -U "$(id -un)" -d postgres -X -q -v ON_ERROR_STOP=1)
"${psql[@]}" -f "$root/tools/publication-boundary/bootstrap.sql" > "$work/setup.log" 2>&1
for version in 20260819021327 20260819021408 20260902054107 20260902054119 20260902054132 20260902055852 20260903141500 20260907193000 20260923090000 20260923093000 20261010103000; do
 for migration in "$root"/supabase/migrations/"${version}"_*.sql; do
  "${psql[@]}" -f "$migration" >> "$work/setup.log" 2>&1 || { cat "$work/setup.log"; exit 1; }
 done
done
"${psql[@]}" -f "$root/tools/operations/public-storage-budget-contract.sql" > "$work/contract.log" 2>&1 || { cat "$work/contract.log"; exit 1; }
grep 'PASS:' "$work/contract.log"
insert="insert into private.memory_public_assets(user_id,card_id,source_asset_id,source_version,source_hash,operation_id,policy_revision) values(gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),1,repeat('a',64),gen_random_uuid(),'LOCAL_ONLY');"
# Two different owners compete for one reservation. Either may win, never both.
set +e
"${psql[@]}" -c "begin; $insert select pg_sleep(0.2); commit;" > "$work/race-a.log" 2>&1 & pid_a=$!
"${psql[@]}" -c "begin; $insert select pg_sleep(0.2); commit;" > "$work/race-b.log" 2>&1 & pid_b=$!
wait "$pid_a"; status_a=$?
wait "$pid_b"; status_b=$?
set -e
if ! { [ "$status_a" = 0 ] && [ "$status_b" != 0 ]; } && ! { [ "$status_b" = 0 ] && [ "$status_a" != 0 ]; }; then
 cat "$work/race-a.log" "$work/race-b.log"; exit 1
fi
grep -q IMAGE_QUOTA_EXCEEDED "$work/race-a.log" "$work/race-b.log"
"${psql[@]}" -c "do \$\$begin if (select count(*)<>1 or sum(reserved_bytes)<>4194304 from private.memory_public_assets) then raise exception 'RACE_FAILED'; end if; end\$\$;"
echo 'PASS: concurrent different owners reserve at most the global ceiling'
echo 'LOCAL PostgreSQL budget contract only; no hosted image upload or deletion.'
