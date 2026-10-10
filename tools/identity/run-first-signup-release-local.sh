#!/usr/bin/env bash
# First run: node tools/identity/prepare-first-signup-fixtures.mjs
# No hosted connection. Unique disposable PostgreSQL cluster, TCP disabled.
set -euo pipefail
root="$(cd "$(dirname "$0")/../.." && pwd)"
fixtures="$root/.cache/first-signup-fixtures"
pg_bin="${PG_BIN:-/usr/lib/postgresql/16/bin}"
work="$(mktemp -d /tmp/moemoa-first-signup.XXXXXX)"
trap '"$pg_bin/pg_ctl" -D "$work/data" -m immediate stop >/dev/null 2>&1 || true' EXIT
"$pg_bin/initdb" -D "$work/data" -A trust --no-locale -E UTF8 > "$work/init.log"
"$pg_bin/pg_ctl" -D "$work/data" -l "$work/server.log" -o "-k $work -p 55459 -c listen_addresses=''" start >/dev/null
psql=("$pg_bin/psql" -h "$work" -p 55459 -U "$(id -un)" -d postgres -X -q -v ON_ERROR_STOP=1)
"${psql[@]}" -f "$root/tools/publication-boundary/bootstrap.sql" > "$work/setup.log" 2>&1
for migration in "$root"/supabase/migrations/*.sql; do
 name="$(basename "$migration")"
 [[ "$name" != '20260902055512_memory_user_retention.sql' ]] || continue
 [[ "$name" < '20261010190000' ]] || continue
 if [[ "$name" == '20260924115258_memory_resource_controls.sql' ]]; then
  "${psql[@]}" -f "$root/tools/publication-boundary/legacy-resource-fixture.sql" >> "$work/setup.log" 2>&1
 fi
 "${psql[@]}" -f "$migration" >> "$work/setup.log" 2>&1 || { cat "$work/setup.log"; exit 1; }
done
"${psql[@]}" -f "$fixtures/ledger.sql" > "$work/ledger.log" 2>&1
"${psql[@]}" >/dev/null <<'SQL'
update private.memory_private_media_policy set revision='TEST_ONLY_PHONE_WEB_20260927_01';
insert into auth.users(id,email,raw_app_meta_data,raw_user_meta_data) values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','existing@example.test','{"provider":"google"}','{"sub":"100","email_verified":true}');
insert into auth.identities values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','google','{"sub":"100","email_verified":true}');
insert into private.memory_service_operators(user_id) values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
insert into private.simple_signup_declarations(user_id,policy_version,country,age_band,minimum_age_at_declaration,terms_version,privacy_version)
 values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','historical-policy','PH','UNDER_18',13,'historical-terms','historical-privacy');
SQL
revision(){ "${psql[@]}" -Atc "select private.moemoa_admin_signup_state()->>'revision';"; }
prepare(){
 local token="${2:-$(revision)}"
 [[ "$token" =~ ^[a-f0-9]{64}$ ]] || exit 1
 sed "s/ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff/$token/g" "$fixtures/$1.sql" > "$work/current.sql"
}
run(){ prepare "$1" "${2:-}"; "${psql[@]}" -f "$work/current.sql" > "$work/run.log" 2>&1 || { cat "$work/run.log"; exit 1; }; }
denied(){
 prepare "$1" "${4:-}"
 if "${psql[@]}" -f "$work/current.sql" > "$work/denied.log" 2>&1; then echo 'FAIL: release unexpectedly passed'; exit 1; fi
 grep -q "$2" "$work/denied.log" || { cat "$work/denied.log"; exit 1; }
 echo "PASS: $3"
}
run inspect-rollback
grep -q '"available": false' "$work/run.log"
"${psql[@]}" >/dev/null <<'SQL'
create schema cron;
create table cron.job(jobid bigint,jobname text,command text,schedule text,active boolean);
create table cron.job_run_details(jobid bigint,runid bigint,status text,start_time timestamptz,return_message text);
insert into cron.job values(1,'moemoa-simple-signup-purge','select public.purge_simple_signup_transients();','17 * * * *',true);
insert into cron.job_run_details values(1,1,'succeeded',now(),'PRIVATE_RUN_MESSAGE_NEVER_OUTPUT');
SQL
run inspect-rollback
grep -q '"configured": true' "$work/run.log"
grep -q '"latestRunStatus": "succeeded"' "$work/run.log"
! grep -q PRIVATE_RUN_MESSAGE_NEVER_OUTPUT "$work/run.log"
"${psql[@]}" -c "update cron.job set command='unexpected command';" >/dev/null
run inspect-rollback
grep -q '"configured": false' "$work/run.log"
"${psql[@]}" -c "update cron.job set command='select public.purge_simple_signup_transients();';" >/dev/null
echo 'PASS: optional cleanup schedule/readback distinguishes absent, exact and changed jobs without private run messages'
initial="$(revision)"
run stage-rollback
[[ "$(revision)" == "$initial" ]]
[[ "$("${psql[@]}" -Atc "select to_regclass('private.simple_signup_rollout_events') is null;")" == t ]]
echo 'PASS: stage rehearsal rolls back migration, country activation, policy and event ledger'
denied activate-apply REQUIRED_MIGRATION_MISSING 'activation cannot skip the stage migration'
denied production-guard PRIVATE_POLICY_TARGET_MISMATCH 'production release refuses test database marker'
# Hosted test currently has signup enabled: schema-only rehearsal must preserve it.
"${psql[@]}" -c "update private.simple_signup_policy set enabled=true,admission_enabled=true;" >/dev/null
test_before="$(revision)"
run schema-rollback
[[ "$(revision)" == "$test_before" ]]
run schema-apply
[[ "$(revision)" == "$test_before" ]]
run schema-apply
echo 'PASS: schema-only test install/recheck preserves existing enabled policy and five countries'
"${psql[@]}" -c "update private.simple_signup_policy set enabled=false,admission_enabled=false;" >/dev/null
denied stage-apply SIGNUP_REVISION_CONFLICT 'stale preflight cannot stage policy' "$(printf '%064d' 0)"
run stage-apply
stage_revision="$(revision)"
run readback-rollback
run readback-crlf
"${psql[@]}" -c "update supabase_migrations.schema_migrations set statements=array[replace(replace(statements[1],chr(13)||chr(10),chr(10)),chr(10),chr(13)||chr(10))];" >/dev/null
run readback-rollback
echo 'PASS: stage/readback accept exact source and Windows CRLF-only normalization'
[[ "$("${psql[@]}" -Atc "select (not enabled and admission_enabled) from private.simple_signup_policy;")" == t ]]
[[ "$("${psql[@]}" -Atc "select (private.moemoa_admin_signup_state()->'signup'->>'canResume')::boolean;")" == f ]]
echo 'PASS: stage leaves new signup closed, guard enabled and ordinary admin resume unavailable'
"${psql[@]}" > "$work/resume.log" 2>&1 <<'SQL' && { echo 'FAIL: premature resume accepted'; exit 1; } || true
select set_config('request.jwt.claim.role','authenticated',false);
select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',false);
select public.get_moemoa_admin_status()->>'revision' as revision \gset
set role authenticated;
select public.set_moemoa_signup_paused(:'revision',false);
SQL
grep -q ADMIN_RELEASE_NOT_READY "$work/resume.log"
echo 'PASS: real operator RPC cannot turn reviewed-but-unactivated stage into signup'
denied stage-apply RELEASE_ALREADY_APPLIED 'stage cannot silently replay over the current policy'
run activate-rollback
[[ "$(revision)" == "$stage_revision" ]]
echo 'PASS: activation rehearsal does not open signup or register first activation'
# Two separately connected reviewed activations race on the same observed token.
prepare activate-apply "$stage_revision"
"${psql[@]}" -f "$work/current.sql" > "$work/race1.log" 2>&1 & first=$!
"${psql[@]}" -f "$work/current.sql" > "$work/race2.log" 2>&1 & second=$!
one=0;two=0;wait "$first" || one=$?;wait "$second" || two=$?
[[ "$one" != "$two" ]] || { cat "$work/race1.log" "$work/race2.log"; exit 1; }
grep -q SIGNUP_REVISION_CONFLICT "$work/race1.log" "$work/race2.log"
[[ "$("${psql[@]}" -Atc "select count(*) from private.simple_signup_rollout_events where action='ACTIVATE';")" == 1 ]]
echo 'PASS: concurrent first activation produces one success and one stale rejection'
run readback-rollback
"${psql[@]}" -f "$root/tools/identity/first-signup-country-contract.sql" > "$work/contract.log" 2>&1 || { cat "$work/contract.log"; exit 1; }
grep 'PASS:' "$work/contract.log"
active_revision="$(revision)"
run pause-rollback
[[ "$(revision)" == "$active_revision" ]]
run pause-apply
[[ "$("${psql[@]}" -Atc 'select not enabled and admission_enabled from private.simple_signup_policy;')" == t ]]
echo 'PASS: explicit operational rollback pauses new signup without reopening direct OAuth'
denied activate-apply RELEASE_ALREADY_APPLIED 'old activation artifact cannot silently undo a later pause'
run readback-rollback
"${psql[@]}" -c 'alter function public.check_simple_signup_admission(jsonb) security invoker;' >/dev/null
denied readback-rollback LIVE_FUNCTION_MISMATCH 'readback detects altered live security properties'
"${psql[@]}" -c 'alter function public.check_simple_signup_admission(jsonb) security definer; grant execute on function public.issue_simple_signup_admission(text,text,jsonb) to authenticated;' >/dev/null
denied readback-rollback LIVE_FUNCTION_ACL_MISMATCH 'readback detects excess admission RPC privileges'
"${psql[@]}" -c 'revoke execute on function public.issue_simple_signup_admission(text,text,jsonb) from authenticated; alter table auth.users disable trigger apply_simple_signup_admission;' >/dev/null
denied readback-rollback AUTH_ADMISSION_TRIGGER_MISMATCH 'readback detects a disabled Auth INSERT guard'
"${psql[@]}" -c 'alter table auth.users enable trigger apply_simple_signup_admission; alter table private.simple_signup_countries alter column enabled set default true;' >/dev/null
denied readback-rollback COUNTRY_DEFAULT_MISMATCH 'readback detects unsafe new-country default'
"${psql[@]}" -c "alter table private.simple_signup_countries alter column enabled set default false; update supabase_migrations.schema_migrations set statements=array[statements[1]||'-- altered'] where version='20261010190000';" >/dev/null
denied readback-rollback EXISTING_MIGRATION_LEDGER_MISMATCH 'same version cannot hide different migration source'
echo 'LOCAL PostgreSQL release and country contracts complete. Hosted Google/Hook HTTP remains separate.'
