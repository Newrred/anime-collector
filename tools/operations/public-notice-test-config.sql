-- Test-only candidate; use the existing target-validated moemoa-test connection.
-- Default rehearsal ROLLBACK; hosted rehearsal also requires exact approval.
-- Apply: -v apply_public_notice=true; restore: also -v restore_public_notice=true.
\set ON_ERROR_STOP on
\if :{?apply_public_notice}
\else
\set apply_public_notice false
\endif
\if :{?restore_public_notice}
\else
\set restore_public_notice false
\endif
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
LOCK TABLE private.memory_publication_settings IN SHARE ROW EXCLUSIVE MODE;
CREATE TEMP TABLE notice_config_candidate ON COMMIT DROP AS
 SELECT '{"singleton":true,"asset_limit":10,"reads_enabled":true,"images_enabled":true,"writes_enabled":true,"follows_enabled":true,"policy_revision":"TEST_ONLY_PHONE_WEB_20260927_01","reports_enabled":true,"asset_bytes_limit":41943040,"minihomes_enabled":true,"report_daily_limit":10,"content_policy_revision":"TEST_ONLY_PHONE_WEB_20260927_01","signup_declaration_required":false,"general_publication_policy_revision":"TEST_ONLY_PHONE_WEB_20260927_01"}'::jsonb AS baseline,
 'MOEMOA_PUBLIC_GENERAL_20261011_01'::text AS revision,
 :restore_public_notice::boolean AS restore;
DO $$ DECLARE a record; expected jsonb; actual jsonb; BEGIN
 SELECT * INTO a FROM notice_config_candidate;
 expected:=CASE WHEN a.restore THEN a.baseline || jsonb_build_object('policy_revision',a.revision,'content_policy_revision',a.revision,'general_publication_policy_revision',a.revision,'signup_declaration_required',true) ELSE a.baseline END;
 SELECT to_jsonb(s) INTO actual FROM private.memory_publication_settings s WHERE singleton;
 IF actual IS DISTINCT FROM expected THEN RAISE EXCEPTION 'NOTICE_CONFIG_DRIFT'; END IF;
 IF NOT a.restore AND (NOT EXISTS(SELECT 1 FROM private.simple_signup_policy WHERE singleton AND enabled AND admission_enabled AND policy_version='simple-signup-2026-10-10-test' AND terms_version='terms-2026-10-10-test' AND privacy_version='privacy-2026-10-10-test')
 OR to_regprocedure('public.get_memory_card_sharing(uuid)') IS NULL
 OR to_regprocedure('public.make_memory_card_private(uuid)') IS NULL
 OR to_regprocedure('public.authorize_memory_sized_image_delivery(uuid,text,text,text)') IS NULL) THEN RAISE EXCEPTION 'NOTICE_DEPENDENCY_CHANGED'; END IF;
END $$;
UPDATE private.memory_publication_settings s SET
 policy_revision=CASE WHEN a.restore THEN a.baseline->>'policy_revision' ELSE a.revision END,
 content_policy_revision=CASE WHEN a.restore THEN a.baseline->>'content_policy_revision' ELSE a.revision END,
 general_publication_policy_revision=CASE WHEN a.restore THEN a.baseline->>'general_publication_policy_revision' ELSE a.revision END,
 signup_declaration_required=NOT a.restore
 FROM notice_config_candidate a WHERE s.singleton;
SELECT jsonb_build_object('policyRevision',policy_revision,'contentPolicyRevision',content_policy_revision,'generalPolicyRevision',general_publication_policy_revision,'signupDeclarationRequired',signup_declaration_required) FROM private.memory_publication_settings WHERE singleton;
\if :apply_public_notice
COMMIT;
\else
ROLLBACK;
\endif
