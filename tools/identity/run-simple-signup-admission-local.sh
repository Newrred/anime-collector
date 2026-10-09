#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "$0")/../.." && pwd)"
pg_bin="${PG_BIN:-/usr/lib/postgresql/16/bin}"
work="$(mktemp -d /tmp/moemoa-simple-admission.XXXXXX)"
trap '"$pg_bin/pg_ctl" -D "$work/data" -m immediate stop >/dev/null 2>&1 || true' EXIT
"$pg_bin/initdb" -D "$work/data" -A trust --no-locale -E UTF8 > "$work/init.log"
"$pg_bin/pg_ctl" -D "$work/data" -l "$work/server.log" -o "-k $work -p 55451 -c listen_addresses=''" start >/dev/null
psql=("$pg_bin/psql" -h "$work" -p 55451 -U "$(id -un)" -d postgres -X -v ON_ERROR_STOP=1)
"${psql[@]}" -f "$root/tools/publication-boundary/bootstrap.sql" >/dev/null
"${psql[@]}" -f "$root/supabase/migrations/20261009130000_simple_signup_declarations.sql" >/dev/null
"${psql[@]}" -f "$root/supabase/migrations/20261009143000_simple_signup_admission.sql" >/dev/null
"${psql[@]}" -f "$root/tools/identity/simple-signup-admission-contract.sql" > "$work/results.log" 2>&1 || { cat "$work/results.log"; exit 1; }
grep 'PASS:' "$work/results.log"
"${psql[@]}" >/dev/null <<'SQL'
insert into private.simple_signup_admissions(google_subject,email_hash,country,age_band,minimum_age,policy_version,terms_version,privacy_version)
values('400',encode(sha256(convert_to('race@example.test','UTF8')),'hex'),'KR','UNDER_18',14,'simple-signup-2026-10-09','terms-2026-10-09-draft','privacy-2026-10-09-draft');
SQL
# Two independent connections race for the same admission. Their start order is irrelevant.
insert_user() {
 "${psql[@]}" -c "insert into auth.users(id,email,raw_app_meta_data,raw_user_meta_data) values('$1','race@example.test','{\"provider\":\"google\"}','{\"sub\":\"400\",\"email_verified\":true}');"
}
insert_user '44444444-4444-4444-8444-444444444444' > "$work/race1.log" 2>&1 & first=$!
insert_user '55555555-5555-4555-8555-555555555555' > "$work/race2.log" 2>&1 & second=$!
one=0;two=0
wait "$first" || one=$?
wait "$second" || two=$?
if [[ "$one" == "$two" ]]; then cat "$work/race1.log" "$work/race2.log"; exit 1; fi
"${psql[@]}" >/dev/null <<'SQL'
do $$begin
 if (select count(*) from auth.users where email='race@example.test')<>1 then raise exception 'race created two users';end if;
 if (select count(*) from private.simple_signup_declarations where user_id in (select id from auth.users where email='race@example.test'))<>1 then raise exception 'race receipt count';end if;
end$$;
select public.store_simple_signup_handoff(repeat('c',64),repeat('ciphertext',10));
SQL
"${psql[@]}" -Atc "select coalesce(public.consume_simple_signup_handoff(repeat('c',64)),'EMPTY')" > "$work/handoff1.log" & first=$!
"${psql[@]}" -Atc "select coalesce(public.consume_simple_signup_handoff(repeat('c',64)),'EMPTY')" > "$work/handoff2.log" & second=$!
wait "$first"
wait "$second"
[[ "$(cat "$work/handoff1.log" "$work/handoff2.log" | grep -c '^EMPTY$')" == 1 ]]
echo 'PASS: two-connection admission race creates one user/receipt; handoff delivered once'
echo 'LOCAL PostgreSQL only; hosted Google/Auth behavior remains unverified.'
