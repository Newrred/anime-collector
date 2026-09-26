#!/usr/bin/env bash
# Sourced by the disposable DB runner; uses its psql array and work directory.
"${psql[@]}" -c 'create table private.eligibility_write_probe(id integer primary key)' >/dev/null
wait_for_sleep() {
 local ready=false
 for attempt in $(seq 1 100); do
  if [[ "$("${psql[@]}" -Atc "select exists(select 1 from pg_stat_activity where application_name='$1' and wait_event='PgSleep')")" == t ]]; then ready=true;break;fi
  sleep 0.02
 done
 [[ "$ready" == true ]]
}
# Revocation owns the row first; a waiting write must see the committed revoked version.
"${psql[@]}" > "$work/revoke-first.log" 2>&1 <<'SQL' &
begin;
set local application_name='eligibility-revoke-first';
select 1 from private.memory_eligibility_policies where purpose='CLOUD_WRITE' for share;
update private.memory_eligibility_evidence set state='REVOKED',revision=revision+1;
select pg_sleep(1);
commit;
SQL
revoker=$!
wait_for_sleep eligibility-revoke-first
if "${psql[@]}" > "$work/revoked-write.log" 2>&1 <<'SQL'
begin;
select private.require_memory_eligibility('11111111-1111-4111-8111-111111111111','CLOUD_WRITE');
insert into private.eligibility_write_probe values(1);
commit;
SQL
then exit 1;fi
wait "$revoker"
grep -q ELIGIBILITY_REQUIRED "$work/revoked-write.log"
[[ "$("${psql[@]}" -Atc 'select count(*) from private.eligibility_write_probe')" == 0 ]]
echo 'PASS: revocation first blocks waiting synthetic write with zero committed rows'
"${psql[@]}" -c "update private.memory_eligibility_evidence set state='GRANTED',revision=revision+1" >/dev/null
# Write owns a shared evidence lock first; revocation cannot complete ahead of that write.
"${psql[@]}" > "$work/write-first.log" 2>&1 <<'SQL' &
begin;
set local application_name='eligibility-write-first';
select private.require_memory_eligibility('11111111-1111-4111-8111-111111111111','CLOUD_WRITE');
insert into private.eligibility_write_probe values(2);
select pg_sleep(1);
commit;
SQL
writer=$!
wait_for_sleep eligibility-write-first
"${psql[@]}" > "$work/revoke-second.log" 2>&1 <<'SQL'
begin;
select 1 from private.memory_eligibility_policies where purpose='CLOUD_WRITE' for share;
update private.memory_eligibility_evidence set state='REVOKED',revision=revision+1;
do $$begin if (select count(*) from private.eligibility_write_probe)<>1 then raise exception 'write did not commit before revocation';end if;end $$;
commit;
SQL
wait "$writer"
if "${psql[@]}" -c "select private.require_memory_eligibility('11111111-1111-4111-8111-111111111111','CLOUD_WRITE')" > "$work/after-revoke.log" 2>&1; then exit 1;fi
grep -q ELIGIBILITY_REQUIRED "$work/after-revoke.log"
echo 'PASS: write first commits before revocation returns; subsequent guard denies'
