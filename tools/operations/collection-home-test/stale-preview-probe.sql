-- TEST ONLY. Verify the connected project independently before execution.
-- No positive publication, consent acceptance, migration, or persistent writes.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
DO $$
DECLARE
 h private.memory_minihomes%rowtype;
 src public.user_title_sync_entities%rowtype;
 choice jsonb; selected jsonb; preview jsonb; projection jsonb;
 settings_before jsonb; home_before jsonb; source_before text;
 rejected boolean:=false; hidden_stale boolean:=false;
BEGIN
 SELECT to_jsonb(s) INTO settings_before FROM private.memory_publication_settings s WHERE singleton FOR UPDATE;
 IF settings_before->>'collection_home_enabled' IS DISTINCT FROM 'false'
 OR settings_before->>'signup_declaration_required' IS DISTINCT FROM 'false'
 OR settings_before->>'policy_revision' IS DISTINCT FROM 'TEST_ONLY_PHONE_WEB_20260927_01'
 OR settings_before->>'content_policy_revision' IS DISTINCT FROM 'TEST_ONLY_PHONE_WEB_20260927_01'
 OR settings_before->>'general_publication_policy_revision' IS DISTINCT FROM 'TEST_ONLY_PHONE_WEB_20260927_01'
 OR settings_before->>'writes_enabled' IS DISTINCT FROM 'true'
 OR settings_before->>'minihomes_enabled' IS DISTINCT FROM 'true'
 OR NOT EXISTS(SELECT 1 FROM public.catalog_active_release WHERE singleton AND release_id='collection-home-test-20261013')
 THEN RAISE EXCEPTION 'TEST_BASELINE_REQUIRED'; END IF;
 SELECT * INTO STRICT h FROM private.memory_minihomes
 WHERE id='4006eb40-ec5a-47fc-8a5b-ec2b78e60daa' FOR UPDATE;
 IF h.published_selection IS NOT NULL OR h.preview IS NOT NULL OR h.hidden THEN RAISE EXCEPTION 'TEST_HOME_NOT_PRIVATE'; END IF;
 home_before:=to_jsonb(h);
 SELECT * INTO STRICT src FROM public.user_title_sync_entities
 WHERE user_id=h.user_id AND entity_kind='bookshelf' AND entity_key='default' AND deleted_at IS NULL FOR UPDATE;
 IF jsonb_array_length(src.payload->'shelves') IS DISTINCT FROM 1
 OR src.payload#>>'{shelves,0,id}' IS DISTINCT FROM 'collection-home-test-20261013'
 OR src.payload#>'{shelves,0,titleKeys}' IS DISTINCT FROM '["ANILIST:9253"]'::jsonb
 THEN RAISE EXCEPTION 'TEST_SHELF_CHANGED'; END IF;
 SELECT md5(coalesce(jsonb_agg(to_jsonb(t) ORDER BY entity_kind,entity_key)::text,'')) INTO source_before
 FROM public.user_title_sync_entities t WHERE user_id=h.user_id;
 -- This subtransaction always aborts, even if an executor ignores final ROLLBACK.
 BEGIN
  UPDATE private.memory_publication_settings SET collection_home_enabled=true WHERE singleton;
  PERFORM set_config('request.jwt.claim.sub',h.user_id::text,true);
  SELECT value INTO STRICT choice FROM jsonb_array_elements(public.list_memory_minihome_shelves()->'shelves')
   WHERE value->>'sourceId'='collection-home-test-20261013';
  IF jsonb_array_length(choice->'titles') IS DISTINCT FROM 1 THEN RAISE EXCEPTION 'TEST_COVER_UNAVAILABLE'; END IF;
  selected:=jsonb_build_object('schemaVersion',2,'nickname','MOEMOA test A','bio','',
   'entries',jsonb_build_array(jsonb_build_object('kind','TITLE_SHELF','sourceId',choice->>'sourceId',
    'sourceVersion',choice->'sourceVersion','title','Stale preview negative probe',
    'titles',jsonb_build_array(jsonb_build_object('titleKey',choice#>>'{titles,0,titleKey}',
     'animeId',choice#>>'{titles,0,animeId}','revisionId',choice#>>'{titles,0,visual,revisionId}',
     'catalogTitle',choice#>>'{titles,0,title}')))));
  preview:=public.prepare_memory_minihome(h.revision,selected);
  IF jsonb_array_length(preview#>'{snapshot,entries}') IS DISTINCT FROM 1 THEN RAISE EXCEPTION 'TEST_PREVIEW_EMPTY'; END IF;
  -- Only the existing synthetic test shelf's version changes, inside rollback.
  UPDATE public.user_title_sync_entities SET version=version+1
   WHERE user_id=h.user_id AND entity_kind='bookshelf' AND entity_key='default';
  BEGIN
   PERFORM public.publish_memory_minihome((preview->>'revision')::bigint,
    preview->>'reviewHash',preview->>'policyRevision',gen_random_uuid());
  EXCEPTION WHEN OTHERS THEN
   IF SQLERRM='PREVIEW_CHANGED' THEN rejected:=true; ELSE RAISE; END IF;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'UNEXPECTED_PUBLICATION_SUCCESS'; END IF;
  -- Same non-strict builder used by the visitor reader, not an HTTP/UI check.
  projection:=private.build_memory_minihome(h.user_id,selected,false);
  hidden_stale:=jsonb_array_length(projection->'entries')=0;
  IF NOT hidden_stale THEN RAISE EXCEPTION 'STALE_SOURCE_VISIBLE'; END IF;
  IF (SELECT published_selection IS NOT NULL FROM private.memory_minihomes WHERE id=h.id)
   THEN RAISE EXCEPTION 'UNEXPECTED_PUBLICATION'; END IF;
  RAISE EXCEPTION USING ERRCODE='ZX001',MESSAGE='ROLLBACK_PROBE_SUCCESS';
 EXCEPTION WHEN SQLSTATE 'ZX001' THEN NULL;
 END;
 IF NOT rejected OR NOT hidden_stale THEN RAISE EXCEPTION 'PROBE_INCOMPLETE'; END IF;
 IF settings_before IS DISTINCT FROM (SELECT to_jsonb(s) FROM private.memory_publication_settings s WHERE singleton)
 OR home_before IS DISTINCT FROM (SELECT to_jsonb(t) FROM private.memory_minihomes t WHERE id=h.id)
 OR source_before IS DISTINCT FROM (SELECT md5(coalesce(jsonb_agg(to_jsonb(t) ORDER BY entity_kind,entity_key)::text,'')) FROM public.user_title_sync_entities t WHERE user_id=h.user_id)
 THEN RAISE EXCEPTION 'ROLLBACK_MISMATCH'; END IF;
 RAISE NOTICE 'PASS: stale publish rejected PREVIEW_CHANGED; stale projection empty; settings/home/source restored; publication/consent committed=0';
END $$;
ROLLBACK;
