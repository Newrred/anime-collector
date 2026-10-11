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
"${psql[@]}" -f "$root/tools/publication-boundary/simple-card-sharing-contract.sql" > "$work/simple.log" 2>&1 || { cat "$work/simple.log"; exit 1; }
grep 'PASS:' "$work/simple.log"

# Two independent connections: in-flight privacy holds the owner lock before any old publication can resume.
PGAPPNAME=simple-sharing-lock-holder "${psql[@]}" > "$work/lock-holder.log" 2>&1 <<'SQL' &
begin;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
select public.make_memory_card_private('cccccccc-cccc-4ccc-8ccc-000000000002');
select pg_sleep(3);
commit;
SQL
holder=$!
for attempt in $(seq 1 60); do
 locked=$("${psql[@]}" -Atc "select count(*) from pg_locks l join pg_stat_activity a on a.pid=l.pid where a.application_name='simple-sharing-lock-holder' and l.locktype='advisory' and l.granted")
 if [ "$locked" = 1 ]; then break; fi
 sleep 0.05
done
[ "$locked" = 1 ] || { echo 'FAIL: privacy did not hold owner lock'; exit 1; }
for statement in "select public.prepare_memory_publication(null,0,null)" "select public.publish_memory_publication(null,0,null,null,null)"; do
 if "${psql[@]}" -c "set lock_timeout='200ms';set role authenticated;select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);$statement" > "$work/blocked.log" 2>&1; then
  echo 'FAIL: publication bypassed privacy lock'; exit 1
 fi
 grep -q 'lock timeout' "$work/blocked.log" || { cat "$work/blocked.log"; exit 1; }
 echo 'PASS: independent publication connection waits for owner privacy transaction'
done
wait "$holder"

echo 'LOCAL SQL boundary only; no hosted Google or production activation.'
