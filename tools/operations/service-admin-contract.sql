-- Synthetic fixtures in the disposable service-admin harness only.
create function pg_temp.ok(value boolean,label text) returns void language plpgsql as $$
begin if value is distinct from true then raise exception 'FAIL: %',label; end if;
 raise notice 'PASS: %',label; end $$;
create function pg_temp.fails(statement text,expected text,label text) returns void language plpgsql as $$
begin begin execute statement; exception when others then
 if sqlerrm like '%'||expected||'%' then perform pg_temp.ok(true,label); return; end if; raise;
 end; raise exception 'Unexpected success: %',label; end $$;

select pg_temp.ok((select count(*)=0 from private.memory_service_operators),'migration assigns no operator implicitly');
select pg_temp.ok((select not enabled and not admission_enabled from private.simple_signup_policy where singleton)
 and (select not reads_enabled and not writes_enabled from private.memory_publication_settings where singleton),'migration preserves signup and Public OFF');
select pg_temp.ok((select count(*)=0 from private.memory_signup_release_bundles)
 and (select active_bundle_id is null and first_activated_at is null from private.memory_signup_runtime_control),'migration does not approve or activate a release');

insert into auth.users(id,email,is_anonymous) values
 ('11111111-1111-4111-8111-111111111111','operator@example.test',false),
 ('22222222-2222-4222-8222-222222222222','moderator@example.test',false),
 ('33333333-3333-4333-8333-333333333333','user-private@example.test',false),
 ('44444444-4444-4444-8444-444444444444','anonymous@example.test',true),
 ('55555555-5555-4555-8555-555555555555','disabled@example.test',false);
insert into private.memory_service_operators(user_id,enabled) values
 ('11111111-1111-4111-8111-111111111111',true),
 ('44444444-4444-4444-8444-444444444444',true),
 ('55555555-5555-4555-8555-555555555555',false);
insert into private.memory_moderators(user_id) values('22222222-2222-4222-8222-222222222222');
insert into private.simple_signup_declarations(user_id,policy_version,country,age_band,minimum_age_at_declaration,terms_version,privacy_version)
 values('33333333-3333-4333-8333-333333333333','historical-private','PH','UNDER_18',13,'historical-terms','historical-privacy');
insert into private.memory_reports(reporter,operation_id,target_kind,target_id,category,note)
 values('33333333-3333-4333-8333-333333333333',gen_random_uuid(),'board',gen_random_uuid(),'OTHER','PRIVATE_REPORT_DO_NOT_RETURN');
insert into private.memory_private_media(owner_id,asset_id,source_version,operation_id,policy_revision,pipeline,input_hash,main_hash,thumb_hash,main_bytes,thumb_bytes,width,height,state,cleanup_after)
 values('99999999-9999-4999-8999-999999999999',gen_random_uuid(),1,gen_random_uuid(),'PRIVATE_POLICY','private-webp-v1',repeat('a',64),repeat('b',64),repeat('c',64),800,200,1,1,'DELETING',now()-interval '1 minute');
create temp table preserved_public as select to_jsonb(s) value from private.memory_publication_settings s;
create temp table preserved_receipts as select to_jsonb(d) value from private.simple_signup_declarations d;

select pg_temp.ok(has_function_privilege('authenticated','public.get_moemoa_admin_status()','EXECUTE')
 and has_function_privilege('authenticated','public.set_moemoa_signup_paused(text,boolean)','EXECUTE')
 and not has_function_privilege('anon','public.get_moemoa_admin_status()','EXECUTE')
 and not has_function_privilege('service_role','public.get_moemoa_admin_status()','EXECUTE')
 and not has_function_privilege('service_role','public.set_moemoa_signup_paused(text,boolean)','EXECUTE'),'only authenticated callers can reach admin RPCs');
select pg_temp.ok(not exists(select 1 from (values('memory_service_operators'),('memory_signup_release_bundles'),('memory_signup_runtime_control'),('memory_service_admin_audit')) t(n)
 cross join (values('anon'),('authenticated'),('service_role')) r(n)
 where has_table_privilege(r.n,'private.'||t.n,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE')),'client/service roles cannot directly read or mutate admin tables');
select pg_temp.ok(not has_function_privilege('authenticated','private.require_memory_service_operator(boolean)','EXECUTE')
 and not has_function_privilege('authenticated','private.moemoa_admin_signup_state()','EXECUTE'),'private helpers cannot be called directly');
set role anon;
select pg_temp.fails('select public.get_moemoa_admin_status()','permission denied','anon cannot read admin status');
select pg_temp.fails($q$select public.set_moemoa_signup_paused(repeat('a',64),true)$q$,'permission denied','anon cannot pause signup');
reset role;
select set_config('request.jwt.claim.role','authenticated',false);
select set_config('request.jwt.claim.sub','',false);
set role authenticated;
select pg_temp.fails('select public.get_moemoa_admin_status()','ADMIN_REQUIRED','missing subject denied');
reset role;
select set_config('request.jwt.claim.sub','99999999-9999-4999-8999-999999999999',false);
set role authenticated;
select pg_temp.fails('select public.get_moemoa_admin_status()','ADMIN_REQUIRED','deleted or nonexistent Auth subject denied');
reset role;
select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',false);
set role authenticated;
select pg_temp.fails('select public.get_moemoa_admin_status()','ADMIN_REQUIRED','ordinary account denied');
select pg_temp.fails($q$select public.set_moemoa_signup_paused(repeat('a',64),true)$q$,'ADMIN_REQUIRED','ordinary account cannot change configuration');
reset role;
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false);
set role authenticated;
select pg_temp.fails('select public.get_moemoa_admin_status()','ADMIN_REQUIRED','moderator role does not grant service administration');
reset role;
select set_config('request.jwt.claim.sub','44444444-4444-4444-8444-444444444444',false);
set role authenticated;
select pg_temp.fails('select public.get_moemoa_admin_status()','ADMIN_REQUIRED','anonymous Auth user denied even with an operator row');
reset role;
select set_config('request.jwt.claim.sub','55555555-5555-4555-8555-555555555555',false);
set role authenticated;
select pg_temp.fails('select public.get_moemoa_admin_status()','ADMIN_REQUIRED','disabled operator denied');
reset role;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
select set_config('request.jwt.claim.role','service_role',false);
set role authenticated;
select pg_temp.fails('select public.get_moemoa_admin_status()','ADMIN_REQUIRED','service-role claim cannot impersonate an operator');
reset role;
select set_config('request.jwt.claim.role','authenticated',false);
set role authenticated;
select public.get_moemoa_admin_status() as initial \gset
begin read only;
select pg_temp.ok(public.get_moemoa_admin_status()->>'version'='1','status is genuinely usable in a read-only transaction');
rollback;
select pg_temp.ok(:'initial'::jsonb->>'version'='1' and :'initial'::jsonb->>'revision' ~ '^[a-f0-9]{64}$','status has version and opaque state token');
select pg_temp.ok(:'initial'::jsonb->'counts'='{"accounts":4,"receipts":1,"pendingAdmissions":0,"pendingHandoffs":0}'::jsonb,'only aggregate account and receipt counts returned');
select pg_temp.ok(:'initial'::jsonb->'images'->'private'->>'due'='1' and :'initial'::jsonb->'images'->'private'->>'orphaned'='1'
 and :'initial'::jsonb->'images'->'private'->>'reservedBytes'='1000','cleanup status is manifest counts rather than worker success');
select pg_temp.ok(:'initial'::jsonb->'moderation'->>'enabled'='false' and :'initial'::jsonb->'moderation'->'reports'->>'received'='1','operator can see report aggregates without becoming moderator');
select pg_temp.ok(:'initial' !~ 'example.test|PRIVATE_REPORT_DO_NOT_RETURN|11111111-1111|33333333-3333|99999999-9999'
 and not (:'initial'::jsonb ?| array['emails','users','deletedAccounts','workerSucceeded']),'status excludes identities, private report text, invented deletion totals and worker success');
do $$begin perform public.get_moemoa_admin_status();
 perform pg_temp.ok(current_setting('response.headers') like '%no-store%','admin responses explicitly prohibit caching'); end$$;
select pg_temp.fails($q$select public.set_moemoa_signup_paused(null,true)$q$,'ADMIN_INVALID_REQUEST','missing revision denied');
select pg_temp.fails($q$select public.set_moemoa_signup_paused(repeat('a',64),null)$q$,'ADMIN_INVALID_REQUEST','missing action denied');
select pg_temp.fails($q$select public.set_moemoa_signup_paused(repeat('a',64),true)$q$,'ADMIN_REVISION_CONFLICT','stale revision denied');
select pg_temp.fails(format('select public.set_moemoa_signup_paused(%L,false)',:'initial'::jsonb->>'revision'),'ADMIN_ACTIVATION_REQUIRED','dashboard cannot perform initial activation');
reset role;

select pg_temp.ok((:'initial'::jsonb->'costs'->>'publicStorageLimitBytes')::bigint=(select max_reserved_bytes from private.memory_public_storage_policy where singleton),'existing public budget remains its configured number');
begin;
alter table private.memory_public_storage_policy rename to local_missing_public_budget_fixture;
set local role authenticated;
select pg_temp.ok(public.get_moemoa_admin_status()->'costs'->'publicStorageLimitBytes'='null'::jsonb
 and public.get_moemoa_admin_status()->'counts'->>'accounts'='4','older test schema returns unknown public budget without breaking admin status');
rollback;

-- An unreviewed enabled release may be stopped, never resumed through this UI.
update private.simple_signup_policy set enabled=true,admission_enabled=true;
set role authenticated;
select public.get_moemoa_admin_status()->>'revision' as unreviewed_revision \gset
select public.set_moemoa_signup_paused(:'unreviewed_revision',true) as paused \gset
select pg_temp.ok(:'paused'::jsonb->'signup'->>'enabled'='false' and :'paused'::jsonb->'signup'->>'admissionEnabled'='true','pause disables new signup but preserves admission enforcement');
select pg_temp.fails(format('select public.set_moemoa_signup_paused(%L,false)',:'paused'::jsonb->>'revision'),'ADMIN_RELEASE_NOT_READY','unreviewed release cannot resume');
select pg_temp.ok(public.set_moemoa_signup_paused(:'paused'::jsonb->>'revision',true)->>'revision'=:'paused'::jsonb->>'revision','repeated pause with fresh token is a no-op');
reset role;
select pg_temp.ok((select count(*)=1 from private.memory_service_admin_audit),'no-op and denied actions do not fabricate successful audit events');
select pg_temp.ok(public.check_simple_signup_admission('{"user":{"app_metadata":{"provider":"google"},"user_metadata":{"email_verified":true,"sub":"123"},"email":"new@example.test"}}')->'error'->>'http_code'='403','paused signup Hook rejects direct OAuth new accounts');
select pg_temp.fails($q$insert into auth.users(id,email,raw_app_meta_data,raw_user_meta_data) values(gen_random_uuid(),'new@example.test','{"provider":"google"}','{"sub":"123","email_verified":true}')$q$,'SIGNUP_ADMISSION_REQUIRED','paused signup trigger rejects direct Auth insertion');
select pg_temp.ok((select count(*)=5 from auth.users),'pause does not remove or replace existing accounts');

select pg_temp.fails($q$insert into private.memory_signup_release_bundles(id,policy_version,terms_version,privacy_version,countries) values('bad-age','p','t','q','[{"country":"KR","minimumAge":12}]')$q$,'ADMIN_BUNDLE_INVALID','bundle rejects age outside contract');
select pg_temp.fails($q$insert into private.memory_signup_release_bundles(id,policy_version,terms_version,privacy_version,countries) values('duplicate','p','t','q','[{"country":"KR","minimumAge":14},{"country":"KR","minimumAge":14}]')$q$,'ADMIN_BUNDLE_INVALID','bundle rejects duplicate countries');
select pg_temp.fails($q$insert into private.memory_signup_release_bundles(id,policy_version,terms_version,privacy_version,countries) values('extra','p','t','q','[{"country":"KR","minimumAge":14,"email":"private"}]')$q$,'ADMIN_BUNDLE_INVALID','bundle rejects unrecognized fields');
select pg_temp.fails($q$insert into private.memory_signup_release_bundles(id,policy_version,terms_version,privacy_version,countries,production_ready) values('test-version','simple-test','terms','privacy','[{"country":"KR","minimumAge":14}]',true)$q$,'check constraint','test document names cannot be production-ready');

-- Only a trusted, version-controlled release step can create this activation.
update private.simple_signup_policy set policy_version='signup-2026-10-10',terms_version='terms-2026-10-10',privacy_version='privacy-2026-10-10';
insert into private.memory_signup_release_bundles(id,policy_version,terms_version,privacy_version,countries,production_ready)
 select 'LOCAL_REVIEWED_BUNDLE',policy_version,terms_version,privacy_version,
  (select jsonb_agg(jsonb_build_object('country',country,'minimumAge',minimum_age) order by country desc) from private.simple_signup_countries),true
 from private.simple_signup_policy;
select pg_temp.ok((select countries->0->>'country'='GB' from private.memory_signup_release_bundles),'bundle canonicalizes country order');
select pg_temp.fails($q$update private.memory_signup_release_bundles set production_ready=false where id='LOCAL_REVIEWED_BUNDLE'$q$,'ADMIN_RECORD_IMMUTABLE','reviewed bundle cannot be rewritten');
select pg_temp.fails($q$delete from private.memory_signup_release_bundles where id='LOCAL_REVIEWED_BUNDLE'$q$,'ADMIN_RECORD_IMMUTABLE','reviewed bundle cannot be deleted');
select pg_temp.fails($q$truncate private.memory_signup_release_bundles cascade$q$,'ADMIN_RECORD_IMMUTABLE','reviewed bundles cannot be truncated even with cascade');
set role authenticated;
select pg_temp.fails($q$select public.set_moemoa_signup_paused(public.get_moemoa_admin_status()->>'revision',false)$q$,'ADMIN_RELEASE_NOT_READY','registered bundle alone cannot perform first activation');
reset role;
update private.memory_signup_runtime_control set active_bundle_id='LOCAL_REVIEWED_BUNDLE',first_activated_at=clock_timestamp();
set role authenticated;
select public.get_moemoa_admin_status() as reviewed \gset
select pg_temp.ok(:'reviewed'::jsonb->'signup'->>'canResume'='true','previously activated matching reviewed bundle permits resume');
select public.set_moemoa_signup_paused(:'reviewed'::jsonb->>'revision',false) as resumed \gset
select pg_temp.ok(:'resumed'::jsonb->'signup'->>'enabled'='true' and :'resumed'::jsonb->'signup'->>'admissionEnabled'='true','resume changes only the signup enabled state');
select pg_temp.fails(format('select public.set_moemoa_signup_paused(%L,true)',:'reviewed'::jsonb->>'revision'),'ADMIN_REVISION_CONFLICT','old state token cannot overwrite a newer operation');
select pg_temp.ok(public.set_moemoa_signup_paused(:'resumed'::jsonb->>'revision',false)->>'revision'=:'resumed'::jsonb->>'revision','repeated resume with fresh token is a no-op');
reset role;
select pg_temp.ok((select count(*)=2 and bool_and(admission_enabled) from private.memory_service_admin_audit),'exactly one append-only event per successful change');
select pg_temp.ok((select to_jsonb(s)=p.value from private.memory_publication_settings s cross join preserved_public p),'pause/resume never changes Public flags');
select pg_temp.ok((select to_jsonb(d)=p.value from private.simple_signup_declarations d cross join preserved_receipts p),'historical consent receipt remains byte-for-byte unchanged');
select pg_temp.fails($q$update private.memory_service_admin_audit set action='SIGNUP_RESUMED' where id=1$q$,'ADMIN_RECORD_IMMUTABLE','audit rewrite denied even to table owner');
select pg_temp.fails($q$delete from private.memory_service_admin_audit where id=1$q$,'ADMIN_RECORD_IMMUTABLE','audit deletion denied');
select pg_temp.fails($q$truncate private.memory_service_admin_audit$q$,'ADMIN_RECORD_IMMUTABLE','audit truncate denied');
set role authenticated;
select public.get_moemoa_admin_status() as audit_status \gset
select pg_temp.ok(jsonb_array_length(:'audit_status'::jsonb->'audit')=2 and :'audit_status' !~ '"actor"|11111111-1111','audit UI includes outcomes but no operator identity');
reset role;

-- A privileged release/config change invalidates cached state and resume proof.
insert into private.simple_signup_countries values('DE',14);
set role authenticated;
select pg_temp.fails(format('select public.set_moemoa_signup_paused(%L,true)',:'resumed'::jsonb->>'revision'),'ADMIN_REVISION_CONFLICT','concurrent external country change invalidates state token');
select public.set_moemoa_signup_paused(public.get_moemoa_admin_status()->>'revision',true) as changed_paused \gset
select pg_temp.fails(format('select public.set_moemoa_signup_paused(%L,false)',:'changed_paused'::jsonb->>'revision'),'ADMIN_RELEASE_NOT_READY','country mismatch prevents resume');
reset role;
delete from private.simple_signup_countries where country='DE';
update private.simple_signup_policy set privacy_version='privacy-other';
set role authenticated;
select pg_temp.fails($q$select public.set_moemoa_signup_paused(public.get_moemoa_admin_status()->>'revision',false)$q$,'ADMIN_RELEASE_NOT_READY','document tuple mismatch prevents resume');
reset role;
update private.simple_signup_policy set privacy_version='privacy-2026-10-10';
update private.memory_service_operators set enabled=false where user_id='11111111-1111-4111-8111-111111111111';
set role authenticated;
select pg_temp.fails('select public.get_moemoa_admin_status()','ADMIN_REQUIRED','role revocation takes effect on next read');
select pg_temp.fails(format('select public.set_moemoa_signup_paused(%L,false)',:'changed_paused'::jsonb->>'revision'),'ADMIN_REQUIRED','role revocation takes effect on next mutation');
reset role;
update private.memory_service_operators set enabled=true where user_id='11111111-1111-4111-8111-111111111111';
set role authenticated;
select public.set_moemoa_signup_paused(public.get_moemoa_admin_status()->>'revision',false)->'signup'->>'enabled' as ready_for_race;
reset role;
select pg_temp.ok((select count(*)=1 from private.memory_moderators where enabled),'service admin implementation did not expand moderator membership');

-- State and audit are in the same transaction; rollback cannot leave one behind.
select count(*) as audit_before_rollback from private.memory_service_admin_audit \gset
select public.get_moemoa_admin_status()->>'revision' as before_rollback \gset
begin;
set local role authenticated;
select public.set_moemoa_signup_paused(:'before_rollback',true)->'signup'->>'enabled';
reset role;
select pg_temp.ok((select count(*)=(:'audit_before_rollback')::integer+1 from private.memory_service_admin_audit),'audit is present in the same transaction as the state change');
rollback;
select pg_temp.ok((select count(*)=(:'audit_before_rollback')::integer from private.memory_service_admin_audit)
 and (select enabled and admission_enabled from private.simple_signup_policy),'rollback restores state and audit together');
select pg_temp.ok(public.get_moemoa_admin_status()->>'revision'=:'before_rollback','rolled-back mutation leaves the previous token valid');
