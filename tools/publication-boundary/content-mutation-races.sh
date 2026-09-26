# Local row-boundary races, not end-to-end publish RPC tests.
for content_action in snapshot withdrawal policy; do
 "${psql[@]}" -c "update private.memory_publication_settings set content_policy_revision='TEST_ONLY_CONTENT'; update private.memory_publications set published_snapshot=jsonb_build_object('title','Synthetic concurrency fixture','cards','[]'::jsonb) where id='$content_target'" >/dev/null
 case "$content_action" in
  snapshot) content_mutation="update private.memory_publications set published_snapshot=jsonb_set(published_snapshot,'{title}','\"Changed concurrently\"') where id='$content_target'"; content_error=PUBLICATION_CONFLICT ;;
  withdrawal) content_mutation="update private.memory_publications set published_snapshot=null where id='$content_target'"; content_error=NOT_FOUND ;;
  policy) content_mutation="update private.memory_publication_settings set content_policy_revision='TEST_ONLY_CONTENT_NEW'"; content_error=CONTENT_POLICY_CHANGED ;;
 esac
 "${psql[@]}" -c "begin; set local application_name='moemoa-content-mutation'; $content_mutation; select pg_sleep(1); commit" > "$work/content-$content_action-writer.log" 2>&1 &
 content_mutator=$!
 content_ready=false
 for attempt in $(seq 1 100); do
  if [[ "$("${psql[@]}" -Atc "select exists(select 1 from pg_stat_activity where application_name='moemoa-content-mutation' and wait_event='PgSleep')")" == t ]]; then content_ready=true; break; fi
  sleep 0.02
 done
 [[ "$content_ready" == true ]]
 if "${psql[@]}" -v target="$content_target" -v hash="$content_hash" -v rating=GENERAL -v revision=1 -v hold=0 -f "$root/tools/publication-boundary/content-review-race.sql" > "$work/content-$content_action-review.log" 2>&1; then exit 1; fi
 grep -q "$content_error" "$work/content-$content_action-review.log"
 wait "$content_mutator"
 [[ "$("${psql[@]}" -Atc "select revision from private.memory_content_reviews where publication_id='$content_target'")" == 1 ]]
 [[ "$("${psql[@]}" -Atc "select count(*) from private.memory_content_review_audit where target_id='$content_target'")" == 1 ]]
 echo "PASS: overlapping $content_action rejects stale classification without new audit"
done
