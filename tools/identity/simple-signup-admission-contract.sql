-- Real PostgreSQL transactions; Google/Auth HTTP services are NOT running here.
create function pg_temp.expect_error(statement text, expected text) returns void language plpgsql as $$
begin
 begin execute statement; exception when others then if sqlerrm like '%'||expected||'%' then return; end if; raise; end;
 raise exception 'Expected rejection: %',expected;
end $$;
create function pg_temp.declaration(age integer default 14) returns jsonb language sql as $$
 select jsonb_build_object('version',1,'country','KR','age',age,'declaredOn',current_date,'createdAt',floor(extract(epoch from clock_timestamp())*1000),
 'accepted',true,'policyVersion','simple-signup-2026-10-09','termsVersion','terms-2026-10-09-draft','privacyVersion','privacy-2026-10-09-draft');
$$;
create function pg_temp.add_user(uid uuid, subject text, email text default 'fixture@example.test') returns void language sql as $$
 insert into auth.users(id,email,raw_app_meta_data,raw_user_meta_data) values(uid,email,'{"provider":"google"}',jsonb_build_object('sub',subject,'email_verified',true));
$$;
create function pg_temp.hook(subject text, email text default 'fixture@example.test') returns jsonb language sql as $$
 select public.check_simple_signup_admission(jsonb_build_object('user',jsonb_build_object('id',gen_random_uuid(),'email',email,'app_metadata',jsonb_build_object('provider','google'),
 'user_metadata',jsonb_build_object('sub',subject,'email_verified',true))));
$$;
-- Default-off installation preserves ordinary existing insertion.
select pg_temp.add_user('11111111-1111-4111-8111-111111111111','100');
insert into auth.identities(user_id,provider,identity_data) values('11111111-1111-4111-8111-111111111111','google','{"sub":"100","email_verified":true}');
select pg_temp.expect_error($q$select public.issue_simple_signup_admission('200',repeat('a',64),pg_temp.declaration())$q$,'SIGNUP_DISABLED');
update private.simple_signup_policy set enabled=true,admission_enabled=true;
select pg_temp.expect_error($q$select pg_temp.add_user('22222222-2222-4222-8222-222222222222','200')$q$,'SIGNUP_ADMISSION_REQUIRED');
do $$begin if pg_temp.hook('200')->'error' is null then raise exception 'hook allowed unapproved';end if;end$$;
set role anon;
select pg_temp.expect_error($q$select public.issue_simple_signup_admission('200',repeat('a',64),'{}')$q$,'permission denied');
select pg_temp.expect_error($q$select public.consume_simple_signup_handoff(repeat('a',64))$q$,'permission denied');
select pg_temp.expect_error($q$select public.check_simple_signup_admission('{}')$q$,'permission denied');
reset role;
select pg_temp.expect_error($q$select public.issue_simple_signup_admission('200',repeat('a',64),pg_temp.declaration(13))$q$,'BELOW_MINIMUM_AGE');
select pg_temp.expect_error($q$select public.issue_simple_signup_admission('200',repeat('a',64),pg_temp.declaration()||'{"accepted":false}')$q$,'TERMS_REQUIRED');
select pg_temp.expect_error($q$select public.issue_simple_signup_admission('200',repeat('a',64),pg_temp.declaration()||'{"policyVersion":"old"}')$q$,'SIGNUP_POLICY_CHANGED');
select public.issue_simple_signup_admission('200',encode(sha256(convert_to('fixture@example.test','UTF8')),'hex'),pg_temp.declaration()) as admission \gset
-- Client metadata cannot turn an email or anonymous signup into Google approval.
select pg_temp.expect_error($q$insert into auth.users(id,email,raw_app_meta_data,raw_user_meta_data) values('66666666-6666-4666-8666-666666666666','fixture@example.test','{"provider":"email"}','{"sub":"200","email_verified":true}')$q$,'SIGNUP_ADMISSION_REQUIRED');
select pg_temp.expect_error($q$insert into auth.users(id,email,is_anonymous,raw_app_meta_data,raw_user_meta_data) values('66666666-6666-4666-8666-666666666666','fixture@example.test',true,'{"provider":"google"}','{"sub":"200","email_verified":true}')$q$,'SIGNUP_ADMISSION_REQUIRED');
select pg_temp.expect_error($q$insert into auth.users(id,email,raw_app_meta_data,raw_user_meta_data) values('66666666-6666-4666-8666-666666666666','fixture@example.test','{"provider":"google"}','{"sub":"200","email_verified":false}')$q$,'SIGNUP_ADMISSION_REQUIRED');
do $$begin if pg_temp.hook('200')<>'{}'::jsonb then raise exception 'approved hook rejected';end if;
 if pg_temp.hook('200','other@example.test')->'error' is null then raise exception 'email mismatch accepted';end if;end$$;
-- Row insertion and receipt succeed in one real DB transaction, using the real ID (not hook ID).
select pg_temp.add_user('22222222-2222-4222-8222-222222222222','200');
do $$begin if (select count(*) from private.simple_signup_declarations where user_id='22222222-2222-4222-8222-222222222222')<>1 then raise exception 'missing receipt';end if;
 if pg_temp.hook('200')->'error' is null then raise exception 'hook replay allowed';end if;end$$;
select pg_temp.expect_error($q$select pg_temp.add_user('33333333-3333-4333-8333-333333333333','200')$q$,'SIGNUP_ADMISSION_REQUIRED');
select pg_temp.expect_error(format('select public.finish_simple_signup_admission(%L,%L)',:'admission','11111111-1111-4111-8111-111111111111'),'SIGNUP_ADMISSION_REQUIRED');
insert into auth.identities(user_id,provider,identity_data) values('22222222-2222-4222-8222-222222222222','google','{"sub":"200","email_verified":true}');
select public.finish_simple_signup_admission(:'admission','22222222-2222-4222-8222-222222222222');
select 'PASS: default off, direct insertion denied, grants, minimum age/terms/policy, Google subject/email, hook provisional ID, atomic real ID+receipt, replay, wrong account';

-- Existing accounts keep their ID/data and receive a first receipt without insertion.
select public.issue_simple_signup_admission('100',encode(sha256(convert_to('fixture@example.test','UTF8')),'hex'),pg_temp.declaration(17)) as existing \gset
select public.finish_simple_signup_admission(:'existing','11111111-1111-4111-8111-111111111111');
select public.issue_simple_signup_admission('100',encode(sha256(convert_to('fixture@example.test','UTF8')),'hex'),pg_temp.declaration(18)) as birthday \gset
select public.finish_simple_signup_admission(:'birthday','11111111-1111-4111-8111-111111111111');
do $$begin if (select age_band from private.simple_signup_declarations where user_id='11111111-1111-4111-8111-111111111111')<>'UNDER_18' then raise exception 'historical receipt overwritten';end if;end$$;

-- Revocation/policy changes between prepare and insert fail closed and roll back account.
select public.issue_simple_signup_admission('300',encode(sha256(convert_to('fixture@example.test','UTF8')),'hex'),pg_temp.declaration()) as stale \gset
update private.simple_signup_countries set minimum_age=15 where country='KR';
select pg_temp.expect_error($q$select pg_temp.add_user('33333333-3333-4333-8333-333333333333','300')$q$,'SIGNUP_POLICY_CHANGED');
update private.simple_signup_countries set minimum_age=14 where country='KR';
update private.simple_signup_admissions set expires_at=clock_timestamp()-interval '1 second' where id=:'stale';
select pg_temp.expect_error($q$select pg_temp.add_user('33333333-3333-4333-8333-333333333333','300')$q$,'SIGNUP_ADMISSION_REQUIRED');
do $$begin if exists(select from auth.users where id='33333333-3333-4333-8333-333333333333') then raise exception 'rejected insert persisted';end if;end$$;
select public.store_simple_signup_handoff(repeat('a',64),repeat('ciphertext',10));
do $$begin if public.consume_simple_signup_handoff(repeat('b',64)) is not null then raise exception 'wrong key accepted';end if;
 if public.consume_simple_signup_handoff(repeat('a',64)) is null then raise exception 'handoff missing';end if;
 if public.consume_simple_signup_handoff(repeat('a',64)) is not null then raise exception 'handoff replay';end if;end$$;
select public.store_simple_signup_handoff(repeat('a',64),repeat('ciphertext',10));
update private.simple_signup_handoffs set expires_at=clock_timestamp()-interval '1 second';
do $$begin if public.consume_simple_signup_handoff(repeat('a',64)) is not null then raise exception 'expired handoff';end if;end$$;
select public.purge_simple_signup_transients();
select 'PASS: existing account identity, birthday login, historical receipt retention, changed policy/expiry rollback, handoff wrong key/replay/expiry/purge';
