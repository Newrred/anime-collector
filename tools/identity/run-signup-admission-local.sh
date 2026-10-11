#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "$0")/../.." && pwd)"
pg_bin="${PG_BIN:-/usr/lib/postgresql/16/bin}"
work="$(mktemp -d /tmp/moemoa-signup-test.XXXXXX)"
trap '"$pg_bin/pg_ctl" -D "$work/data" -m immediate stop >/dev/null 2>&1 || true' EXIT
"$pg_bin/initdb" -D "$work/data" -A trust --no-locale -E UTF8 > "$work/init.log"
"$pg_bin/pg_ctl" -D "$work/data" -l "$work/server.log" -o "-k $work -p 55449 -c listen_addresses=''" start >/dev/null
psql=("$pg_bin/psql" -h "$work" -p 55449 -U "$(id -un)" -d postgres -X -v ON_ERROR_STOP=1)
"${psql[@]}" -f "$root/tools/publication-boundary/bootstrap.sql" >/dev/null
"${psql[@]}" -f "$root/tools/identity/signup-admission-candidate.sql" >/dev/null
"${psql[@]}" -f "$root/tools/identity/signup-admission-contract.sql" > "$work/results.log" 2>&1
grep 'PASS:' "$work/results.log"
# Two real sessions contend for the SAME approval. The losing proposed account
# must observe the committed binding after waiting, not a stale APPROVED row.
"${psql[@]}" -c "update private.memory_signup_admissions set state='APPROVED',bound_user_id=null,bound_at=null,revoked_at=null" >/dev/null
event_a='{"user":{"id":"55555555-5555-4555-8555-555555555555","email":"child@example.test","app_metadata":{"provider":"google"}}}'
event_b='{"user":{"id":"66666666-6666-4666-8666-666666666666","email":"child@example.test","app_metadata":{"provider":"google"}}}'
"${psql[@]}" -c "begin;set application_name='signup-binding-race';set local role supabase_auth_admin;select public.memory_before_user_created('$event_a');select pg_sleep(1);commit" > "$work/winner.log" 2>&1 &
writer=$!
ready=false
for attempt in $(seq 1 100); do
 if [[ "$("${psql[@]}" -Atc "select exists(select 1 from pg_stat_activity where application_name='signup-binding-race' and wait_event='PgSleep')")" == t ]]; then ready=true;break;fi
 sleep 0.02
done
[[ "$ready" == true ]]
"${psql[@]}" -Atc "set role supabase_auth_admin;select public.memory_before_user_created('$event_b')" > "$work/loser.log" 2>&1
wait "$writer"
grep -q SIGNUP_APPROVAL_REQUIRED "$work/loser.log"
[[ "$("${psql[@]}" -Atc "select bound_user_id='55555555-5555-4555-8555-555555555555' from private.memory_signup_admissions")" == t ]]
echo 'PASS: two concurrent signup sessions bind exactly one proposed account'
echo 'Signup admission LOCAL SQL contract PASS; hosted Auth and consent intake not verified.'
