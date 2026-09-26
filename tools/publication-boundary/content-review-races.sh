# Source only from the disposable local publication runner, after old regressions.
"${psql[@]}" -f "$root/tools/publication-boundary/content-review-candidate.sql" >/dev/null
"${psql[@]}" -c "update private.memory_publication_settings set content_policy_revision='TEST_ONLY_CONTENT'; insert into private.memory_moderators(user_id,enabled) values('11111111-1111-4111-8111-111111111111',true) on conflict(user_id) do update set enabled=true" >/dev/null
content_target=$("${psql[@]}" -Atc "select id from private.memory_publications order by id limit 1")
[[ -n "$content_target" ]]
# Existing lifecycle tests deliberately withdraw every snapshot. Supply a new
# synthetic payload only for this isolated moderation race, not a publish test.
"${psql[@]}" -c "update private.memory_publications set published_snapshot=jsonb_build_object('title','Synthetic concurrency fixture','cards','[]'::jsonb) where id='$content_target'" >/dev/null
content_hash=$("${psql[@]}" -Atc "select encode(sha256(convert_to(published_snapshot::text,'UTF8')),'hex') from private.memory_publications where id='$content_target'")
"${psql[@]}" -v target="$content_target" -v hash="$content_hash" -v rating=GENERAL -v hold=1 -f "$root/tools/publication-boundary/content-review-race.sql" > "$work/content-review-winner.log" 2>&1 &
content_writer=$!
content_ready=false
for attempt in $(seq 1 100); do
 if [[ "$("${psql[@]}" -Atc "select exists(select 1 from pg_stat_activity where application_name='moemoa-content-review-race' and wait_event='PgSleep')")" == t ]]; then content_ready=true; break; fi
 sleep 0.02
done
[[ "$content_ready" == true ]]
if "${psql[@]}" -v target="$content_target" -v hash="$content_hash" -v rating=BLOCKED -v hold=0 -f "$root/tools/publication-boundary/content-review-race.sql" > "$work/content-review-stale.log" 2>&1; then exit 1; fi
grep -q PUBLICATION_CONFLICT "$work/content-review-stale.log"
wait "$content_writer"
[[ "$("${psql[@]}" -Atc "select rating||':'||revision from private.memory_content_reviews where publication_id='$content_target'")" == 'GENERAL:1' ]]
[[ "$("${psql[@]}" -Atc "select count(*) from private.memory_content_review_audit where target_id='$content_target'")" == 1 ]]
echo "PASS: overlapping classification requests keep one decision and one audit; stale review rejected"
source "$root/tools/publication-boundary/content-mutation-races.sh"
content_audit_before=$("${psql[@]}" -Atc "select count(*) from private.memory_content_review_audit")
"${psql[@]}" -f "$root/tools/publication-boundary/close-content-review.sql" >/dev/null
[[ "$("${psql[@]}" -Atc "select not reads_enabled and not writes_enabled and not images_enabled and not minihomes_enabled from private.memory_publication_settings")" == t ]]
[[ "$("${psql[@]}" -Atc "select count(*) from private.memory_content_review_audit")" == "$content_audit_before" ]]
echo "PASS: emergency content closure disables public surfaces and preserves classification audit"
