-- Synthetic fixtures in a disposable database only. Never run against hosted data.
create function pg_temp.ok(value boolean,label text) returns void language plpgsql as $$
begin if value is distinct from true then raise exception 'FAIL: %',label; end if;
 raise notice 'PASS: %',label; end $$;
create function pg_temp.fails(statement text,expected text,label text) returns void language plpgsql as $$
begin begin execute statement; exception when others then
 if sqlerrm like '%'||expected||'%' then perform pg_temp.ok(true,label); return; end if; raise;
 end; raise exception 'Unexpected success: %',label; end $$;
create function pg_temp.declaration(new_version boolean default false) returns jsonb language sql as $$
 select jsonb_build_object('version',1,'country','PH','age',13,'declaredOn',current_date,
 'createdAt',floor(extract(epoch from clock_timestamp())*1000),'accepted',true,
 'policyVersion',case when new_version then 'simple-signup-2026-10-10-test' else 'simple-signup-2026-10-09' end,
 'termsVersion',case when new_version then 'terms-2026-10-10-test' else 'terms-2026-10-09-draft' end,
 'privacyVersion',case when new_version then 'privacy-2026-10-10-test' else 'privacy-2026-10-09-draft' end);
$$;
insert into auth.users(id,email,raw_app_meta_data,raw_user_meta_data) values
 ('11111111-1111-4111-8111-111111111111','receipt-a@example.test','{"provider":"google"}','{"sub":"101","email_verified":true}'),
 ('22222222-2222-4222-8222-222222222222','receipt-b@example.test','{"provider":"google"}','{"sub":"202","email_verified":true}'),
 ('44444444-4444-4444-8444-444444444444','empty@example.test','{"provider":"google"}','{"sub":"404","email_verified":true}');
insert into auth.users(id,is_anonymous) values('33333333-3333-4333-8333-333333333333',true);
insert into auth.identities(user_id,provider,identity_data) values
 ('11111111-1111-4111-8111-111111111111','google','{"sub":"101","email_verified":true}'),
 ('22222222-2222-4222-8222-222222222222','google','{"sub":"202","email_verified":true}');
select pg_temp.ok(not has_function_privilege('anon','public.get_my_simple_signup_receipts()','EXECUTE')
 and has_function_privilege('authenticated','public.get_my_simple_signup_receipts()','EXECUTE')
 and not has_function_privilege('service_role','public.get_my_simple_signup_receipts()','EXECUTE'),'receipt reader has authenticated-only grants');
set role anon;
select pg_temp.fails('select public.get_my_simple_signup_receipts()','permission denied','anonymous role cannot read receipts');
reset role;
select set_config('request.jwt.claim.role','authenticated',false);
select set_config('request.jwt.claim.sub','',false);
set role authenticated;
select pg_temp.fails('select public.get_my_simple_signup_receipts()','AUTH_REQUIRED','missing JWT owner is rejected');
reset role;
select set_config('request.jwt.claim.sub','99999999-9999-4999-8999-999999999999',false);
set role authenticated;
select pg_temp.fails('select public.get_my_simple_signup_receipts()','AUTH_REQUIRED','nonexistent Auth owner is rejected');
reset role;
select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',false);
set role authenticated;
select pg_temp.fails('select public.get_my_simple_signup_receipts()','AUTH_REQUIRED','anonymous Auth account is rejected');
reset role;
select set_config('request.jwt.claim.sub','44444444-4444-4444-8444-444444444444',false);
set role authenticated;
select pg_temp.ok(public.get_my_simple_signup_receipts()='{"receipts":[]}'::jsonb,'real account without receipts returns empty history while policy is off');
reset role;

-- Old and new policy acceptance are separate rows, never a rewritten old receipt.
update private.simple_signup_policy set enabled=true,admission_enabled=true;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
set role authenticated;
select public.record_simple_signup_declaration(auth.uid(),'PH',13,current_date,'simple-signup-2026-10-09','terms-2026-10-09-draft','privacy-2026-10-09-draft',true);
reset role;
select public.issue_simple_signup_admission('202',encode(sha256(convert_to('receipt-b@example.test','UTF8')),'hex'),pg_temp.declaration()) as old_admission \gset
select public.finish_simple_signup_admission(:'old_admission','22222222-2222-4222-8222-222222222222');
create temp table old_receipts as select user_id,to_jsonb(d) as original from private.simple_signup_declarations d;
update private.simple_signup_policy set policy_version='simple-signup-2026-10-10-test',terms_version='terms-2026-10-10-test',privacy_version='privacy-2026-10-10-test';
set role authenticated;
select pg_temp.fails($q$select public.record_simple_signup_declaration(auth.uid(),'PH',13,current_date,'simple-signup-2026-10-09','terms-2026-10-09-draft','privacy-2026-10-09-draft',true)$q$,'SIGNUP_POLICY_CHANGED','direct RPC rejects stale policy and documents');
select pg_temp.fails($q$select public.record_simple_signup_declaration(auth.uid(),'PH',13,current_date,'simple-signup-2026-10-10-test','terms-2026-10-09-draft','privacy-2026-10-10-test',true)$q$,'SIGNUP_POLICY_CHANGED','direct RPC rejects mixed document tuple');
select pg_temp.fails($q$select public.record_simple_signup_declaration(auth.uid(),'PH',13,current_date,'simple-signup-2026-10-10-test','terms-2026-10-10-test','privacy-2026-10-10-test',false)$q$,'TERMS_REQUIRED','new version still requires explicit acceptance');
select public.record_simple_signup_declaration(auth.uid(),'PH',13,current_date,'simple-signup-2026-10-10-test','terms-2026-10-10-test','privacy-2026-10-10-test',true);
select public.record_simple_signup_declaration(auth.uid(),'PH',13,current_date,'simple-signup-2026-10-10-test','terms-2026-10-10-test','privacy-2026-10-10-test',true);
reset role;
select pg_temp.ok((select count(*)=2 from private.simple_signup_declarations where user_id='11111111-1111-4111-8111-111111111111'),'direct new policy creates one additional receipt and retry is idempotent');
select pg_temp.fails($q$select public.issue_simple_signup_admission('202',repeat('a',64),pg_temp.declaration())$q$,'SIGNUP_POLICY_CHANGED','admission rejects stale policy and documents');
select pg_temp.fails($q$select public.issue_simple_signup_admission('202',repeat('a',64),pg_temp.declaration(true)||'{"privacyVersion":"privacy-2026-10-09-draft"}')$q$,'SIGNUP_POLICY_CHANGED','admission rejects mixed document tuple');
select pg_temp.fails($q$select public.issue_simple_signup_admission('202',repeat('a',64),pg_temp.declaration(true)||'{"accepted":false}')$q$,'TERMS_REQUIRED','new admission cannot infer acceptance');
select public.issue_simple_signup_admission('202',encode(sha256(convert_to('receipt-b@example.test','UTF8')),'hex'),pg_temp.declaration(true)) as new_admission \gset
select public.finish_simple_signup_admission(:'new_admission','22222222-2222-4222-8222-222222222222');
select pg_temp.ok((select count(*)=2 from private.simple_signup_declarations where user_id='22222222-2222-4222-8222-222222222222'),'existing-account admission creates a separate new version receipt');
select pg_temp.ok((select count(*)=2 and bool_and(to_jsonb(d)=o.original) from old_receipts o join private.simple_signup_declarations d using(user_id) where d.policy_version='simple-signup-2026-10-09'),'all values and timestamps of both original receipts remain unchanged');
select pg_temp.ok(not exists(select 1 from information_schema.columns where table_schema='private' and table_name='simple_signup_declarations' and column_name in ('consent_scopes','guardian_verified','identity_verified')),'receipt schema does not fabricate consent scopes or verification');

-- A genuinely new Auth user also gets only the accepted new version atomically.
select public.issue_simple_signup_admission('505',encode(sha256(convert_to('receipt-new@example.test','UTF8')),'hex'),
 pg_temp.declaration(true)||'{"consentScopes":["guardian_verified","all_processing"],"guardianVerified":true}') as first_admission \gset
insert into auth.users(id,email,raw_app_meta_data,raw_user_meta_data) values
 ('55555555-5555-4555-8555-555555555555','receipt-new@example.test','{"provider":"google"}','{"sub":"505","email_verified":true}');
insert into auth.identities(user_id,provider,identity_data) values
 ('55555555-5555-4555-8555-555555555555','google','{"sub":"505","email_verified":true}');
select public.finish_simple_signup_admission(:'first_admission','55555555-5555-4555-8555-555555555555');
select pg_temp.ok((select count(*)=1 and bool_and(policy_version='simple-signup-2026-10-10-test'
 and terms_version='terms-2026-10-10-test' and privacy_version='privacy-2026-10-10-test')
 from private.simple_signup_declarations where user_id='55555555-5555-4555-8555-555555555555'),'new Auth insertion keeps exactly the accepted new tuple');
select pg_temp.ok((select not (to_jsonb(d) ?| array['consentScopes','guardianVerified'])
 from private.simple_signup_declarations d where user_id='55555555-5555-4555-8555-555555555555'),'extra declaration claims cannot become consent or guardian evidence');

-- A policy changed during admission cannot finalize or insert the stale receipt.
select public.issue_simple_signup_admission('202',encode(sha256(convert_to('receipt-b@example.test','UTF8')),'hex'),pg_temp.declaration(true)) as stale_admission \gset
update private.simple_signup_policy set privacy_version='changed-during-oauth';
select pg_temp.fails(format('select public.finish_simple_signup_admission(%L,%L)',:'stale_admission','22222222-2222-4222-8222-222222222222'),'SIGNUP_ADMISSION_REQUIRED','finish rejects a document version changed during admission');
update private.simple_signup_policy set privacy_version='privacy-2026-10-10-test';
select public.abandon_simple_signup_admission(:'stale_admission');
select public.issue_simple_signup_admission('606',encode(sha256(convert_to('stale-new@example.test','UTF8')),'hex'),pg_temp.declaration(true)) as stale_new_admission \gset
update private.simple_signup_policy set policy_version='changed-during-insert';
select pg_temp.fails($q$insert into auth.users(id,email,raw_app_meta_data,raw_user_meta_data) values
 ('66666666-6666-4666-8666-666666666666','stale-new@example.test','{"provider":"google"}','{"sub":"606","email_verified":true}')$q$,
 'SIGNUP_ADMISSION_REQUIRED','new Auth insertion rejects policy changed after admission');
select pg_temp.ok(not exists(select 1 from auth.users where id='66666666-6666-4666-8666-666666666666')
 and not exists(select 1 from private.simple_signup_declarations where user_id='66666666-6666-4666-8666-666666666666'),'stale new signup rolls back both account and receipt');
update private.simple_signup_policy set policy_version='simple-signup-2026-10-10-test';
select public.abandon_simple_signup_admission(:'stale_new_admission');

-- History is owner-only, stable through policy disablement, and deliberately minimal.
update private.simple_signup_policy set enabled=false,admission_enabled=false;
set role authenticated;
select pg_temp.ok(jsonb_array_length(public.get_my_simple_signup_receipts()->'receipts')=2,'own old and new receipts remain readable when policy is disabled');
select pg_temp.ok(public.get_my_simple_signup_receipts()->'receipts'->0->>'policyVersion'='simple-signup-2026-10-10-test','history is newest first');
select pg_temp.ok((select array_agg(key order by key)=array['country','policyVersion','privacyVersion','recordedAt','termsVersion'] from jsonb_object_keys(public.get_my_simple_signup_receipts()->'receipts'->0) key),'history exposes only five agreed fields, not age, owner or claimed permissions');
select pg_temp.fails('select * from private.simple_signup_declarations','permission denied','history read does not grant raw table access');
reset role;
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false);
set role authenticated;
select pg_temp.ok(jsonb_array_length(public.get_my_simple_signup_receipts()->'receipts')=2,'second account sees only its two receipts');
reset role;
select set_config('request.jwt.claim.sub','44444444-4444-4444-8444-444444444444',false);
set role authenticated;
select pg_temp.ok(public.get_my_simple_signup_receipts()='{"receipts":[]}'::jsonb,'account without receipts cannot see either other account history');
reset role;
insert into private.simple_signup_declarations(user_id,policy_version,country,age_band,minimum_age_at_declaration,terms_version,privacy_version,recorded_at)
select '44444444-4444-4444-8444-444444444444',format('fixture-%s',lpad(n::text,2,'0')),'KR','UNDER_18',14,'fixture-terms','fixture-privacy',timestamptz '2026-01-01 00:00:00+00'+n*interval '1 second' from generate_series(1,25) n;
set role authenticated;
select pg_temp.ok(jsonb_array_length(public.get_my_simple_signup_receipts()->'receipts')=20
 and public.get_my_simple_signup_receipts()->'receipts'->0->>'policyVersion'='fixture-25'
 and public.get_my_simple_signup_receipts()->'receipts'->19->>'policyVersion'='fixture-06','history is capped at latest 20 in deterministic order');
reset role;

-- Synthetic Auth deletion proves database cascade only, not real Auth API deletion.
delete from auth.users where id='11111111-1111-4111-8111-111111111111';
select pg_temp.ok(not exists(select 1 from private.simple_signup_declarations where user_id='11111111-1111-4111-8111-111111111111'),'synthetic account deletion cascades all its receipt versions');
select pg_temp.ok((select count(*)=2 from private.simple_signup_declarations where user_id='22222222-2222-4222-8222-222222222222'),'synthetic deletion leaves the other account receipts unchanged');
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
set role authenticated;
select pg_temp.fails('select public.get_my_simple_signup_receipts()','AUTH_REQUIRED','stale JWT owner cannot read after synthetic account deletion');
reset role;

-- Exercise the exact documents action extracted from the Python AST, never its remote entry point.
-- Minimal local stand-ins for hosted migration/cron metadata; no scheduler or network is involved.
create schema supabase_migrations;
create table supabase_migrations.schema_migrations(version text primary key);
create schema cron;
create table cron.job(jobname text,command text,schedule text,username text,active boolean);
create temp table document_stage_before as select
 (select jsonb_agg(to_jsonb(d) order by user_id,policy_version) from private.simple_signup_declarations d) as receipts,
 (select jsonb_agg(to_jsonb(c) order by country) from private.simple_signup_countries c) as countries,
 (select count(*) from auth.users) as user_count;
select pg_temp.fails(:'documents_sql','MIGRATION_REQUIRED','document staging requires the admission migration ledger');
insert into supabase_migrations.schema_migrations values('20261009143000');
select pg_temp.fails(:'documents_sql','RECEIPT_MIGRATION_REQUIRED','document staging requires the receipt migration ledger');
insert into supabase_migrations.schema_migrations values('20261010170000');
insert into cron.job values('moemoa-simple-signup-purge','unexpected command','17 * * * *',current_user,true);
select pg_temp.fails(:'documents_sql','EXISTING_JOB_DIFFERS','document staging preserves the existing cleanup-job guard');
delete from cron.job;
update private.simple_signup_policy set policy_version='unknown-policy',enabled=true,admission_enabled=true;
select pg_temp.fails(:'documents_sql','UNEXPECTED_EXISTING_POLICY','document staging rejects an unknown existing policy');
select pg_temp.ok((select policy_version='unknown-policy' and enabled and admission_enabled from private.simple_signup_policy),'rejected staging does not partially disable or replace an unknown policy');
update private.simple_signup_policy set policy_version='simple-signup-2026-10-09',terms_version='terms-2026-10-09-draft',privacy_version='privacy-2026-10-10-test';
select pg_temp.fails(:'documents_sql','UNEXPECTED_EXISTING_POLICY','document staging rejects a mixed old/new document tuple');
update private.simple_signup_policy set privacy_version='privacy-2026-10-09-draft';

begin;
select pg_advisory_xact_lock(20261010,2);
-- This emits the original previousPolicy JSON before changing the policy, as in the real tool.
:documents_sql
select pg_temp.ok((select not enabled and not admission_enabled
 and policy_version='simple-signup-2026-10-10-test' and terms_version='terms-2026-10-10-test'
 and privacy_version='privacy-2026-10-10-test' from private.simple_signup_policy),'known old documents stage to the fixed test tuple with both signup switches off');
select pg_temp.ok((select receipts=(select jsonb_agg(to_jsonb(d) order by user_id,policy_version) from private.simple_signup_declarations d)
 and countries=(select jsonb_agg(to_jsonb(c) order by country) from private.simple_signup_countries c)
 and user_count=(select count(*) from auth.users) from document_stage_before),'document staging preserves every receipt value, country rule and account');
commit;
create temp table staged_policy as select to_jsonb(p) as original from private.simple_signup_policy p;
begin;
select pg_advisory_xact_lock(20261010,2);
:documents_sql
select pg_temp.ok((select to_jsonb(p)=b.original from private.simple_signup_policy p cross join staged_policy b),'repeating the fixed documents action safely preserves the disabled staged tuple');
select pg_temp.ok((select receipts=(select jsonb_agg(to_jsonb(d) order by user_id,policy_version) from private.simple_signup_declarations d)
 and countries=(select jsonb_agg(to_jsonb(c) order by country) from private.simple_signup_countries c)
 and user_count=(select count(*) from auth.users) from document_stage_before),'repeated staging leaves historical receipts, country rules and accounts unchanged');
commit;
