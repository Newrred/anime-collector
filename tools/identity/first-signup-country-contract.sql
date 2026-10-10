-- Synthetic fixtures on a disposable local PostgreSQL cluster; all changes rolled back.
begin;
create function pg_temp.ok(value boolean,label text) returns void language plpgsql as $$
begin if value is distinct from true then raise exception 'FAIL: %',label; end if; raise notice 'PASS: %',label; end $$;
create function pg_temp.fails(statement text,expected text,label text) returns void language plpgsql as $$
begin begin execute statement; exception when others then
 if sqlerrm like '%'||expected||'%' then perform pg_temp.ok(true,label); return; end if; raise;
 end; raise exception 'Unexpected success: %',label; end $$;
create function pg_temp.declaration(country text,age integer) returns jsonb language sql as $$
 select jsonb_build_object('version',1,'country',country,'age',age,'declaredOn',current_date,'createdAt',floor(extract(epoch from clock_timestamp())*1000),
 'accepted',true,'policyVersion','simple-signup-2026-10-10','termsVersion','terms-2026-10-10','privacyVersion','privacy-2026-10-10');
$$;
create function pg_temp.hook(subject text,email text) returns jsonb language sql as $$
 select public.check_simple_signup_admission(jsonb_build_object('user',jsonb_build_object('id',gen_random_uuid(),'email',email,'app_metadata',jsonb_build_object('provider','google'),
 'user_metadata',jsonb_build_object('sub',subject,'email_verified',true))));
$$;
create temp table country_receipts_before as select to_jsonb(d) receipt from private.simple_signup_declarations d;
create temp table country_public_before as select to_jsonb(s) settings from private.memory_publication_settings s;
select pg_temp.ok(public.get_simple_signup_policy()->'countries'='[{"country":"KR","minimumAge":14},{"country":"TH","minimumAge":13},{"country":"US","minimumAge":13}]'::jsonb,'policy exposes exactly KR14 TH13 US13');
select pg_temp.ok((select count(*)=5 and count(*) filter(where enabled)=3 from private.simple_signup_countries),'disabled PH and GB rows are preserved');
insert into private.simple_signup_countries(country,minimum_age) values('DE',16);
select pg_temp.ok((select not enabled from private.simple_signup_countries where country='DE'),'new country defaults to OFF');
select pg_temp.ok((private.moemoa_admin_signup_state()->'signup'->>'readyForResume')::boolean,'inactive countries do not invalidate reviewed active bundle');
select pg_temp.ok(pg_temp.hook('999','none@example.test')->'error' is not null,'legacy direct OAuth without admission is blocked by hook');
select pg_temp.fails($q$insert into auth.users(id,email,raw_app_meta_data,raw_user_meta_data) values(gen_random_uuid(),'none@example.test','{"provider":"google"}','{"sub":"999","email_verified":true}')$q$,'SIGNUP_ADMISSION_REQUIRED','auth INSERT trigger independently blocks bypass');
select pg_temp.fails($q$select public.issue_simple_signup_admission('999',repeat('a',64),pg_temp.declaration('KR',14)||'{"termsVersion":"terms-2026-10-09-draft"}')$q$,'SIGNUP_POLICY_CHANGED','old UI document tuple cannot create admission');
select pg_temp.fails($q$select public.issue_simple_signup_admission('999',repeat('a',64),pg_temp.declaration('US',13)||'{"accepted":false}')$q$,'TERMS_REQUIRED','unaccepted terms cannot create admission');

do $$declare r record; approval uuid; uid uuid; mail text; subject text; begin
 for r in select * from (values('KR',14,'101'),('US',13,'102'),('TH',13,'103')) v(country,age,subject) loop
  subject:=r.subject;mail:=lower(r.country)||'@example.test';uid:=gen_random_uuid();
  perform pg_temp.fails(format('select public.issue_simple_signup_admission(%L,%L,pg_temp.declaration(%L,%s))',subject,repeat('a',64),r.country,r.age-1),'BELOW_MINIMUM_AGE',r.country||' below minimum rejected');
  approval:=public.issue_simple_signup_admission(subject,encode(sha256(convert_to(mail,'UTF8')),'hex'),pg_temp.declaration(r.country,r.age));
  perform pg_temp.ok(pg_temp.hook(subject,mail)='{}'::jsonb,r.country||' approved minimum passes hook');
  insert into auth.users(id,email,raw_app_meta_data,raw_user_meta_data) values(uid,mail,'{"provider":"google"}',jsonb_build_object('sub',subject,'email_verified',true));
  insert into auth.identities(user_id,provider,identity_data) values(uid,'google',jsonb_build_object('sub',subject,'email_verified',true));
  perform pg_temp.ok(public.finish_simple_signup_admission(approval,uid) and (select count(*)=1 from private.simple_signup_declarations where user_id=uid and country=r.country and age_band='UNDER_18'),r.country||' atomic account and receipt then finish succeed');
 end loop;
end $$;

do $$declare v_country text; approval uuid; subject text; i integer:=200; begin
 foreach v_country in array array['PH','GB','DE'] loop
  i:=i+1;subject:=i::text;
  perform pg_temp.fails(format('select public.issue_simple_signup_admission(%L,%L,pg_temp.declaration(%L,18))',subject,repeat('a',64),v_country),'COUNTRY_NOT_READY',v_country||' disabled country cannot issue admission');
  -- Simulate a once-valid approval still present when the country is withdrawn.
  insert into private.simple_signup_admissions(google_subject,email_hash,country,age_band,minimum_age,policy_version,terms_version,privacy_version)
   select subject,encode(sha256(convert_to('disabled@example.test','UTF8')),'hex'),v_country,'18_PLUS',c.minimum_age,'simple-signup-2026-10-10','terms-2026-10-10','privacy-2026-10-10'
   from private.simple_signup_countries c where c.country=v_country returning id into approval;
  perform pg_temp.ok(pg_temp.hook(subject,'disabled@example.test')->'error' is not null,v_country||' outstanding admission is refused by hook');
  perform pg_temp.fails(format('insert into auth.users(id,email,raw_app_meta_data,raw_user_meta_data) values(gen_random_uuid(),%L,%L::jsonb,%L::jsonb)','disabled@example.test','{"provider":"google"}',jsonb_build_object('sub',subject,'email_verified',true)::text),'SIGNUP_POLICY_CHANGED',v_country||' outstanding admission is refused by INSERT trigger');
  perform pg_temp.fails(format('select public.finish_simple_signup_admission(%L,%L)',approval,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),'SIGNUP_POLICY_CHANGED',v_country||' outstanding admission is refused by finish');
 end loop;
end $$;

select public.issue_simple_signup_admission('100',encode(sha256(convert_to('existing@example.test','UTF8')),'hex'),pg_temp.declaration('KR',18)) as returning_admission \gset
select public.finish_simple_signup_admission(:'returning_admission','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
select pg_temp.ok((select count(*)=1 from auth.users where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
 and (select count(*)=2 from private.simple_signup_declarations where user_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),'returning Google account keeps identity and historical receipt while a new accepted policy gets its own receipt');

select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);
set local role authenticated;
select pg_temp.ok(exists(select 1 from jsonb_array_elements(public.get_my_simple_signup_receipts()->'receipts') r where r->>'policyVersion'='historical-policy' and r->>'country'='PH'),'existing account can still read disabled-country historical receipt');
select pg_temp.fails($q$select public.record_simple_signup_declaration('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','PH',18,current_date,'simple-signup-2026-10-10','terms-2026-10-10','privacy-2026-10-10',true)$q$,'COUNTRY_NOT_READY','legacy declaration RPC cannot bypass disabled country');
select public.get_moemoa_admin_status()->>'revision' as active_revision \gset
select public.set_moemoa_signup_paused(:'active_revision',true);
select pg_temp.fails(format('select public.set_moemoa_signup_paused(%L,false)',:'active_revision'),'ADMIN_REVISION_CONFLICT','stale revision cannot undo pause');
reset role;
select pg_temp.ok((select not enabled and admission_enabled from private.simple_signup_policy),'admin pause preserves admission guard');
select pg_temp.ok(pg_temp.hook('999','none@example.test')->'error' is not null,'paused hook still rejects new OAuth');
select pg_temp.fails($q$insert into auth.users(id,email,raw_app_meta_data,raw_user_meta_data) values(gen_random_uuid(),'none@example.test','{"provider":"google"}','{"sub":"999","email_verified":true}')$q$,'SIGNUP_ADMISSION_REQUIRED','paused INSERT trigger still rejects new OAuth');
select private.moemoa_admin_signup_state()->>'revision' as paused_revision \gset
set local role authenticated;
select public.set_moemoa_signup_paused(:'paused_revision',false);
reset role;
select pg_temp.ok((select enabled and admission_enabled from private.simple_signup_policy),'admin resume succeeds only after reviewed first activation');
update private.simple_signup_countries set enabled=false where country='TH';
select pg_temp.ok(not (private.moemoa_admin_signup_state()->'signup'->>'readyForResume')::boolean,'changing active countries invalidates bundle readiness');
update private.simple_signup_policy set enabled=false;
select private.moemoa_admin_signup_state()->>'revision' as changed_revision \gset
set local role authenticated;
select pg_temp.fails(format('select public.set_moemoa_signup_paused(%L,false)',:'changed_revision'),'ADMIN_RELEASE_NOT_READY','ordinary resume cannot approve changed country set');
reset role;
select pg_temp.fails($q$update private.simple_signup_rollout_events set source_commit=repeat('b',40)$q$,'ADMIN_RECORD_IMMUTABLE','release events cannot be rewritten');
select pg_temp.fails('truncate private.simple_signup_rollout_events','ADMIN_RECORD_IMMUTABLE','release events cannot be truncated');
select pg_temp.ok(not exists(select 1 from country_receipts_before b where not exists(select 1 from private.simple_signup_declarations d where to_jsonb(d)=b.receipt)),'original receipts including PH remain unchanged');
select pg_temp.ok((select to_jsonb(s) from private.memory_publication_settings s)=(select settings from country_public_before),'signup activation and pause do not change Public');
rollback;
