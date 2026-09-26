#!/usr/bin/env bash
"${psql[@]}" -c "update private.memory_eligibility_evidence set state='GRANTED',expires_at=clock_timestamp()+interval '1 hour' where purpose='PUBLIC_PUBLISH'" >/dev/null
home_revision=$("${psql[@]}" -Atc "select revision from private.memory_minihomes where user_id='77777777-7777-4777-8777-777777777777'")
board_id=$("${psql[@]}" -Atc "select id from private.memory_publications where board_id='55555555-5555-4555-8555-555555555550'")
preview=$("${psql[@]}" -qAtc "set role authenticated;set request.jwt.claim.sub='77777777-7777-4777-8777-777777777777';select public.prepare_memory_minihome($home_revision,jsonb_build_object('nickname','Expiry fixture','bio','','entries',jsonb_build_array(jsonb_build_object('publicationId','$board_id'))))")
"${psql[@]}" -c "update private.memory_eligibility_evidence set expires_at=clock_timestamp()+interval '2 seconds' where purpose='PUBLIC_PUBLISH'" >/dev/null
"${psql[@]}" -c "begin;set local application_name='public-eligibility-blocker';select 1 from private.memory_minihomes where user_id='77777777-7777-4777-8777-777777777777' for update;select pg_sleep(3);commit" > "$work/public-blocker.log" 2>&1 &
blocker=$!
wait_image_activity public-eligibility-blocker "wait_event='PgSleep'"
"${psql[@]}" -v preview="$preview" > "$work/public-expiry.log" 2>&1 <<'SQL' &
set application_name='public-eligibility-waiter';
set role authenticated;
set request.jwt.claim.sub='77777777-7777-4777-8777-777777777777';
select public.publish_memory_minihome((:'preview'::jsonb->>'revision')::bigint,:'preview'::jsonb->>'reviewHash',:'preview'::jsonb->>'policyRevision','77777777-7777-4777-8777-777777777981');
SQL
publisher=$!
wait_image_activity public-eligibility-waiter "wait_event_type='Lock'"
wait "$blocker"
if wait "$publisher";then echo 'FAIL: expired publication succeeded';exit 1;fi
grep -q ELIGIBILITY_EXPIRED "$work/public-expiry.log"
[[ "$("${psql[@]}" -Atc "select published_selection is null and published_operation<>'77777777-7777-4777-8777-777777777981'::uuid from private.memory_minihomes where user_id='77777777-7777-4777-8777-777777777777'")" == t ]]
echo 'PASS: actual public publish waiting past expiry rolls back selection and operation'
