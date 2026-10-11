-- Synthetic inputs only; no actual child/guardian/account data.
create function pg_temp.ok(v boolean,label text) returns void language plpgsql as $$
begin if v is distinct from true then raise exception 'FAIL: %',label; end if; raise notice 'PASS: %',label; end $$;
create function pg_temp.denied(statement text,label text) returns void language plpgsql as $$
begin
 begin execute statement; exception when insufficient_privilege then perform pg_temp.ok(true,label); return; end;
 raise exception 'FAIL: unexpected permission: %',label;
end $$;
create function pg_temp.event_for(email text,uid text default '11111111-1111-4111-8111-111111111111') returns jsonb
language sql as $$ select jsonb_build_object('user',jsonb_build_object('id',uid,'email',email,
 'app_metadata',jsonb_build_object('provider','google'),
 'user_metadata',jsonb_build_object('approved',true,'guardianConsent',true))) $$;
set role supabase_auth_admin;
select pg_temp.ok(public.memory_before_user_created(pg_temp.event_for('child@example.test')) ? 'error','policy disabled rejects signup');
reset role;
update private.memory_signup_policy set enabled=true,revision='SYNTHETIC_ONLY_V1';
set role supabase_auth_admin;
select pg_temp.ok(public.memory_before_user_created(pg_temp.event_for('child@example.test')) ? 'error','forged client approval cannot create admission');
reset role;
insert into private.memory_signup_admissions(email_sha256,request_id,evidence_ref,policy_revision,country,purpose,state,expires_at)
values(encode(sha256(convert_to('child@example.test','UTF8')),'hex'),
 '22222222-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333333',
 'SYNTHETIC_ONLY_V1','KR','ACCOUNT_CREATE','APPROVED',clock_timestamp()+interval '1 hour');
select pg_temp.ok(not exists(select 1 from auth.users),'admission exists before auth account');
set role anon;
select pg_temp.denied($q$select public.memory_before_user_created('{}')$q$,'anonymous cannot invoke trusted hook');
select pg_temp.denied('select * from private.memory_signup_admissions','anonymous cannot read evidence');
set role authenticated;
select pg_temp.denied($q$select public.memory_before_user_created('{}')$q$,'authenticated cannot forge hook event');
set role service_role;
select pg_temp.denied($q$select public.memory_before_user_created('{}')$q$,'ordinary service API cannot forge hook event');
set role supabase_auth_admin;
select pg_temp.ok(public.memory_before_user_created(pg_temp.event_for('other@example.test')) ? 'error','approval cannot transfer to different email');
select pg_temp.ok(public.memory_before_user_created(jsonb_set(pg_temp.event_for('child@example.test'),'{user,app_metadata,provider}','"email"')) ? 'error','wrong identity provider denied');
select pg_temp.ok(public.memory_before_user_created(jsonb_set(pg_temp.event_for('child@example.test'),'{user,is_anonymous}','true')) ? 'error','anonymous identity denied');
select pg_temp.ok(public.memory_before_user_created(pg_temp.event_for('child@example.test','bad-id')) ? 'error','malformed account denied');
select pg_temp.ok(public.memory_before_user_created(null) ? 'error','missing event denied');
reset role;
begin;
 update private.memory_signup_admissions set expires_at=clock_timestamp()-interval '1 second';
 set local role supabase_auth_admin;
 select pg_temp.ok(public.memory_before_user_created(pg_temp.event_for('child@example.test')) ? 'error','expired approval denied');
rollback;
begin;
 update private.memory_signup_policy set revision='SYNTHETIC_ONLY_V2';
 set local role supabase_auth_admin;
 select pg_temp.ok(public.memory_before_user_created(pg_temp.event_for('child@example.test')) ? 'error','old notice revision denied');
rollback;
begin;
 update private.memory_signup_admissions set state='REVOKED',revoked_at=clock_timestamp();
 set local role supabase_auth_admin;
 select pg_temp.ok(public.memory_before_user_created(pg_temp.event_for('child@example.test')) ? 'error','withdrawal before binding denied');
rollback;
begin;
 set local role supabase_auth_admin;
 select pg_temp.ok(public.memory_before_user_created(pg_temp.event_for('child@example.test'))='{}','valid synthetic evidence permits exact account');
rollback;
select pg_temp.ok((select state='APPROVED' and bound_user_id is null from private.memory_signup_admissions),'SQL rollback preserves unconsumed admission');
set role supabase_auth_admin;
select pg_temp.ok(public.memory_before_user_created(pg_temp.event_for(' CHILD@example.test '))='{}','case and outer whitespace normalize consistently');
select pg_temp.ok(public.memory_before_user_created(pg_temp.event_for('child@example.test'))='{}','same proposed ID retry is idempotent');
select pg_temp.ok(public.memory_before_user_created(pg_temp.event_for('child@example.test','44444444-4444-4444-8444-444444444444')) ? 'error','second account cannot reuse bound approval');
reset role;
select pg_temp.ok((select state='BOUND' and bound_user_id='11111111-1111-4111-8111-111111111111' from private.memory_signup_admissions),'only intended proposed ID was bound');
update private.memory_signup_admissions set state='REVOKED',revoked_at=clock_timestamp();
set role supabase_auth_admin;
select pg_temp.ok(public.memory_before_user_created(pg_temp.event_for('child@example.test')) ? 'error','withdrawal defeats previously successful retry');
reset role;
select pg_temp.ok(not exists(select 1 from auth.users),'hook does not itself create account or grant cloud access');
