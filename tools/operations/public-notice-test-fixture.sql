-- Local configuration fixture only, not a real publication backend.
CREATE SCHEMA private;
CREATE TABLE private.memory_publication_settings (singleton boolean,asset_limit bigint,reads_enabled boolean,images_enabled boolean,writes_enabled boolean,follows_enabled boolean,policy_revision text,reports_enabled boolean,asset_bytes_limit bigint,minihomes_enabled boolean,report_daily_limit bigint,content_policy_revision text,signup_declaration_required boolean,general_publication_policy_revision text);
INSERT INTO private.memory_publication_settings SELECT * FROM jsonb_populate_record(NULL::private.memory_publication_settings,'{"singleton":true,"asset_limit":10,"reads_enabled":true,"images_enabled":true,"writes_enabled":true,"follows_enabled":true,"policy_revision":"TEST_ONLY_PHONE_WEB_20260927_01","reports_enabled":true,"asset_bytes_limit":41943040,"minihomes_enabled":true,"report_daily_limit":10,"content_policy_revision":"TEST_ONLY_PHONE_WEB_20260927_01","signup_declaration_required":false,"general_publication_policy_revision":"TEST_ONLY_PHONE_WEB_20260927_01"}');
CREATE TABLE private.simple_signup_policy(singleton boolean, enabled boolean, admission_enabled boolean,policy_version text,terms_version text,privacy_version text);
INSERT INTO private.simple_signup_policy VALUES(true,true,true,'simple-signup-2026-10-10-test','terms-2026-10-10-test','privacy-2026-10-10-test');
CREATE FUNCTION public.get_memory_card_sharing(uuid) RETURNS jsonb LANGUAGE sql AS $$ SELECT null::jsonb $$;
CREATE FUNCTION public.make_memory_card_private(uuid) RETURNS jsonb LANGUAGE sql AS $$ SELECT null::jsonb $$;
CREATE FUNCTION public.authorize_memory_sized_image_delivery(uuid,text,text,text) RETURNS jsonb LANGUAGE sql AS $$ SELECT null::jsonb $$;
