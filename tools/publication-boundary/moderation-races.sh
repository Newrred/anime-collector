#!/usr/bin/env bash
# Sourced by the isolated harness; synthetic fixtures only.
"${psql[@]}" -c "update private.memory_publication_settings set report_daily_limit=3" >/dev/null
for category in SPAM OTHER; do
  "${psql[@]}" -c "set role authenticated; select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false); select public.submit_memory_report('home','$home_a','$category',gen_random_uuid(),'Concurrent local fixture')" > "$work/report-$category.log" 2>&1 &
  if [[ "$category" == SPAM ]]; then report_a=$!; else report_b=$!; fi
done
success=0
if wait "$report_a"; then success=$((success+1)); else grep -q RATE_LIMITED "$work/report-SPAM.log"; fi
if wait "$report_b"; then success=$((success+1)); else grep -q RATE_LIMITED "$work/report-OTHER.log"; fi
[[ "$success" == 1 ]]
echo "PASS: concurrent reports cannot exceed remaining daily slot"
case_id=$("${psql[@]}" -Atc "select id from private.memory_reports where category='SAFETY'")
for action in HIDE KEEP; do
  "${psql[@]}" -c "set role authenticated; select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',false); select public.review_memory_report('$case_id',5,6,'$action','Concurrent review fixture')" > "$work/review-$action.log" 2>&1 &
  if [[ "$action" == HIDE ]]; then review_a=$!; else review_b=$!; fi
done
success=0
if wait "$review_a"; then success=$((success+1)); else grep -q PUBLICATION_CONFLICT "$work/review-HIDE.log"; fi
if wait "$review_b"; then success=$((success+1)); else grep -q PUBLICATION_CONFLICT "$work/review-KEEP.log"; fi
[[ "$success" == 1 ]]
[[ "$("${psql[@]}" -Atc "select count(*) from private.memory_moderation_audit where case_id='$case_id' and case_revision=6")" == 1 ]]
echo "PASS: concurrent moderator reviews commit one version and one audit action"
