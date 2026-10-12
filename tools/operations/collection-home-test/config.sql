-- Five temporary settings only. Exact baseline, target and dependency guards.
-- Invoke with target_project; apply=true is required for COMMIT.
\set ON_ERROR_STOP on
\if :{?apply_collection_config}
\else
\set apply_collection_config false
\endif
\if :{?restore_collection_config}
\else
\set restore_collection_config false
\endif
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
SELECT set_config('moemoa.target_project', :'target_project', true);
LOCK TABLE private.memory_publication_settings IN SHARE ROW EXCLUSIVE MODE;
CREATE TEMP TABLE collection_config_candidate ON COMMIT DROP AS
 SELECT '{"singleton":true,"asset_limit":10,"reads_enabled":true,"images_enabled":true,"writes_enabled":true,"follows_enabled":true,"policy_revision":"TEST_ONLY_PHONE_WEB_20260927_01","reports_enabled":true,"asset_bytes_limit":41943040,"minihomes_enabled":true,"report_daily_limit":10,"content_policy_revision":"TEST_ONLY_PHONE_WEB_20260927_01","signup_declaration_required":false,"general_publication_policy_revision":"TEST_ONLY_PHONE_WEB_20260927_01","collection_home_enabled":false}'::jsonb AS baseline,
 'MOEMOA_PUBLIC_GENERAL_20261011_01'::text AS revision,
 :restore_collection_config::boolean AS restore;
DO $$ DECLARE a record; expected jsonb; BEGIN
 IF current_setting('moemoa.target_project',true)<>'nmgkhknponvzcwliajyk' THEN RAISE EXCEPTION 'TEST_TARGET_REQUIRED'; END IF;
 SELECT * INTO a FROM collection_config_candidate;
 expected:=CASE WHEN a.restore THEN a.baseline||jsonb_build_object('policy_revision',a.revision,'content_policy_revision',a.revision,'general_publication_policy_revision',a.revision,'signup_declaration_required',true,'collection_home_enabled',true) ELSE a.baseline END;
 IF (SELECT to_jsonb(s) FROM private.memory_publication_settings s WHERE singleton) IS DISTINCT FROM expected THEN RAISE EXCEPTION 'COLLECTION_CONFIG_DRIFT'; END IF;
 IF NOT a.restore AND (NOT EXISTS(SELECT 1 FROM private.simple_signup_policy WHERE singleton AND enabled AND admission_enabled AND policy_version='simple-signup-2026-10-10-test' AND terms_version='terms-2026-10-10-test' AND privacy_version='privacy-2026-10-10-test')
 OR to_regprocedure('public.list_memory_minihome_shelves()') IS NULL
 OR NOT EXISTS(SELECT 1 FROM public.catalog_active_release WHERE release_id='collection-home-test-20261013')) THEN RAISE EXCEPTION 'COLLECTION_DEPENDENCY_CHANGED'; END IF;
END $$;
UPDATE private.memory_publication_settings s SET
 policy_revision=CASE WHEN a.restore THEN a.baseline->>'policy_revision' ELSE a.revision END,
 content_policy_revision=CASE WHEN a.restore THEN a.baseline->>'content_policy_revision' ELSE a.revision END,
 general_publication_policy_revision=CASE WHEN a.restore THEN a.baseline->>'general_publication_policy_revision' ELSE a.revision END,
 signup_declaration_required=NOT a.restore,
 collection_home_enabled=NOT a.restore
 FROM collection_config_candidate a WHERE s.singleton;
SELECT jsonb_build_object('collectionHomeEnabled',collection_home_enabled,'policyRevision',policy_revision,'signupDeclarationRequired',signup_declaration_required) FROM private.memory_publication_settings WHERE singleton;
\if :apply_collection_config
COMMIT;
\else
ROLLBACK;
\endif
