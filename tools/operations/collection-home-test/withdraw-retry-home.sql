-- One approved test-home cleanup only. Run on moemoa-test, not production.
-- Uses the existing owner-bound revoke RPC; no source/image/board deletion.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
DO $$
DECLARE
 h private.memory_minihomes%rowtype;
 source_before text; catalog_before text; boards_before text;
 result jsonb;
BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.catalog_active_release WHERE release_id='collection-home-test-20261013')
 OR NOT EXISTS (SELECT 1 FROM private.memory_publication_settings WHERE singleton
  AND NOT collection_home_enabled AND policy_revision='TEST_ONLY_PHONE_WEB_20260927_01')
 THEN RAISE EXCEPTION 'TEST_BASELINE_REQUIRED'; END IF;
 SELECT * INTO STRICT h FROM private.memory_minihomes
 WHERE id='4006eb40-ec5a-47fc-8a5b-ec2b78e60daa' FOR UPDATE;
 IF h.published_selection->>'nickname' IS DISTINCT FROM 'MOEMOA test A'
 OR jsonb_array_length(h.published_selection->'entries') IS DISTINCT FROM 1
 OR h.published_selection#>>'{entries,0,kind}' IS DISTINCT FROM 'TITLE_SHELF'
 OR h.published_selection#>>'{entries,0,sourceId}' IS DISTINCT FROM 'collection-home-test-20261013'
 THEN RAISE EXCEPTION 'TEST_HOME_CHANGED'; END IF;
 SELECT md5(coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.entity_kind,t.entity_key)::text,'')) INTO source_before
 FROM public.user_title_sync_entities t WHERE t.user_id=h.user_id;
 SELECT md5(coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.asset_id)::text,'')) INTO catalog_before FROM public.catalog_assets t;
 SELECT md5(coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.id)::text,'')) INTO boards_before FROM private.memory_publications t;
 PERFORM set_config('request.jwt.claim.sub',h.user_id::text,true);
 result:=public.revoke_memory_minihome(h.revision);
 IF result->>'published' IS DISTINCT FROM 'false' THEN RAISE EXCEPTION 'REVOKE_FAILED'; END IF;
 IF source_before IS DISTINCT FROM (SELECT md5(coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.entity_kind,t.entity_key)::text,'')) FROM public.user_title_sync_entities t WHERE t.user_id=h.user_id)
 OR catalog_before IS DISTINCT FROM (SELECT md5(coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.asset_id)::text,'')) FROM public.catalog_assets t)
 OR boards_before IS DISTINCT FROM (SELECT md5(coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.id)::text,'')) FROM private.memory_publications t)
 THEN RAISE EXCEPTION 'SOURCE_CHANGED'; END IF;
END $$;
SELECT jsonb_build_object('published',published_selection IS NOT NULL,'previewCleared',preview IS NULL,
 'sourceAndCatalogAndBoardsPreserved',true) AS cleanup_result
FROM private.memory_minihomes WHERE id='4006eb40-ec5a-47fc-8a5b-ec2b78e60daa';
COMMIT;
