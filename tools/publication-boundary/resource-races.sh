#!/usr/bin/env bash
# Sourced by isolated harness. No hosted database URLs.
for mode in daily capacity; do
  if [[ "$mode" == daily ]]; then
    "${psql[@]}" -c "update private.memory_resource_policies set enabled=true,paused=false,daily_limit=(select used+1 from private.memory_resource_usage where actor='11111111-1111-4111-8111-111111111111' and scope='SYNC_MEMORY_BOARDS'),live_limit=null where scope='SYNC_MEMORY_BOARDS'" >/dev/null
    expected=SYNC_RATE_LIMITED
  else
    "${psql[@]}" -c "update private.memory_resource_policies set daily_limit=100,live_limit=(select count(*)+1 from public.memory_boards where user_id='11111111-1111-4111-8111-111111111111' and deleted_at is null) where scope='SYNC_MEMORY_BOARDS'" >/dev/null
    expected=SYNC_QUOTA_EXCEEDED
  fi
  for attempt in 1 2; do
    "${psql[@]}" -c "set role authenticated; select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false); select public.apply_board_mutation(gen_random_uuid(),'dddddddd-dddd-4ddd-8ddd-000000000099','MEMORY_BOARD',gen_random_uuid(),'UPSERT',0,repeat('f',64),'{\"title\":\"Concurrent budget fixture\",\"description\":\"\"}')" > "$work/resource-$mode-$attempt.log" 2>&1 &
    if [[ "$attempt" == 1 ]]; then budget_a=$!; else budget_b=$!; fi
  done
  success=0
  if wait "$budget_a"; then success=$((success+1)); else grep -q "$expected" "$work/resource-$mode-1.log"; fi
  if wait "$budget_b"; then success=$((success+1)); else grep -q "$expected" "$work/resource-$mode-2.log"; fi
  [[ "$success" == 1 ]]
  echo "PASS: simultaneous sync mutations cannot exceed $mode budget"
done
"${psql[@]}" -c "update private.memory_resource_policies set enabled=false,paused=false" >/dev/null
case_id=$("${psql[@]}" -Atc "select id from private.memory_reports where category='SAFETY'")
revision=$("${psql[@]}" -Atc "select revision from private.memory_reports where id='$case_id'")
target_revision=$("${psql[@]}" -Atc "select t.revision from private.memory_moderation_targets t join private.memory_reports r on r.target_kind=t.kind and r.target_id=t.id where r.id='$case_id'")
"${psql[@]}" -v case_id="$case_id" -v revision="$revision" -v target_revision="$target_revision" -f "$root/tools/publication-boundary/resource-sanction.sql" > "$work/resource-sanction.log" 2>&1 &
sanction=$!
ready=false
for attempt in $(seq 1 100); do
  if [[ "$("${psql[@]}" -Atc "select exists(select 1 from pg_stat_activity where application_name='moemoa-w15-sanction' and wait_event='PgSleep')")" == t ]]; then ready=true; break; fi
  sleep 0.02
done
[[ "$ready" == true ]]
if "${psql[@]}" -c "set role authenticated; select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false); select public.prepare_memory_publication('bbbbbbbb-bbbb-4bbb-8bbb-000000000001',(public.get_memory_publication('bbbbbbbb-bbbb-4bbb-8bbb-000000000001')->>'revision')::bigint,'{\"title\":\"Concurrent restricted prepare\",\"description\":\"\",\"cards\":[{\"cardId\":\"cccccccc-cccc-4ccc-8ccc-000000000001\",\"fields\":[]}]}')" > "$work/resource-publish.log" 2>&1; then exit 1; fi
grep -q PUBLICATION_RESTRICTED "$work/resource-publish.log"
wait "$sanction"
echo "PASS: in-flight publication waits for account restriction and cannot commit after it"
