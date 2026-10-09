-- Disposable fixtures only. Self-declaration never proves real age.
create function pg_temp.expect_error(statement text, expected text) returns void language plpgsql as $$
begin
 begin execute statement; exception when others then
 if sqlerrm like '%'||expected||'%' then return; end if; raise;
 end;
 raise exception 'Expected rejection: %',expected;
end $$;
alter table auth.users add column if not exists is_anonymous boolean not null default false;
insert into auth.users(id) values('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222');
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
select set_config('request.jwt.claim.role','authenticated',false);
set role authenticated;
select pg_temp.expect_error($q$select public.record_simple_signup_declaration(auth.uid(),'KR',14,current_date,'simple-signup-2026-10-09','terms-2026-10-09-draft','privacy-2026-10-09-draft',true)$q$,'SIGNUP_SERVICE_UNAVAILABLE');
reset role;
update private.simple_signup_policy set enabled=true;
set role authenticated;
select pg_temp.expect_error($q$select public.record_simple_signup_declaration(auth.uid(),'KR',13,current_date,'simple-signup-2026-10-09','terms-2026-10-09-draft','privacy-2026-10-09-draft',true)$q$,'BELOW_MINIMUM_AGE');
select pg_temp.expect_error($q$select public.record_simple_signup_declaration(auth.uid(),'KR',14,current_date,'old','terms-2026-10-09-draft','privacy-2026-10-09-draft',true)$q$,'SIGNUP_POLICY_CHANGED');
select pg_temp.expect_error($q$select public.record_simple_signup_declaration(auth.uid(),'KR',14,current_date,'simple-signup-2026-10-09','terms-2026-10-09-draft','privacy-2026-10-09-draft',false)$q$,'TERMS_REQUIRED');
select pg_temp.expect_error($q$select public.record_simple_signup_declaration(auth.uid(),'ZZ',14,current_date,'simple-signup-2026-10-09','terms-2026-10-09-draft','privacy-2026-10-09-draft',true)$q$,'COUNTRY_NOT_READY');
select pg_temp.expect_error($q$select public.record_simple_signup_declaration(auth.uid(),'KR',14,current_date-2,'simple-signup-2026-10-09','terms-2026-10-09-draft','privacy-2026-10-09-draft',true)$q$,'SIGNUP_DETAILS_EXPIRED');
select public.record_simple_signup_declaration(auth.uid(),'KR',14,current_date,'simple-signup-2026-10-09','terms-2026-10-09-draft','privacy-2026-10-09-draft',true);
select public.record_simple_signup_declaration(auth.uid(),'KR',14,current_date,'simple-signup-2026-10-09','terms-2026-10-09-draft','privacy-2026-10-09-draft',true);
select pg_temp.expect_error($q$select public.record_simple_signup_declaration(auth.uid(),'KR',18,current_date,'simple-signup-2026-10-09','terms-2026-10-09-draft','privacy-2026-10-09-draft',true)$q$,'SIGNUP_DECLARATION_CONFLICT');
select pg_temp.expect_error('select * from private.simple_signup_declarations','permission denied');
select pg_temp.expect_error('update private.simple_signup_policy set enabled=false','permission denied');
reset role;
do $$begin if (select count(*) from private.simple_signup_declarations)<>1 then raise exception 'retry duplicated';end if;end$$;
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false);
set role authenticated;
select pg_temp.expect_error($q$select public.record_simple_signup_declaration('11111111-1111-4111-8111-111111111111','PH',13,current_date,'simple-signup-2026-10-09','terms-2026-10-09-draft','privacy-2026-10-09-draft',true)$q$,'SIGNUP_ACCOUNT_CHANGED');
select public.record_simple_signup_declaration(auth.uid(),'PH',13,current_date,'simple-signup-2026-10-09','terms-2026-10-09-draft','privacy-2026-10-09-draft',true);
reset role;
do $$begin if (select count(*) from private.simple_signup_declarations)<>2 then raise exception 'account isolation';end if;end$$;
set role anon;
select public.get_simple_signup_policy();
select pg_temp.expect_error($q$select public.record_simple_signup_declaration(auth.uid(),'KR',14,current_date,'simple-signup-2026-10-09','terms-2026-10-09-draft','privacy-2026-10-09-draft',true)$q$,'permission denied');
reset role;
delete from auth.users where id='11111111-1111-4111-8111-111111111111';
do $$begin if (select count(*) from private.simple_signup_declarations)<>1 then raise exception 'account deletion cascade';end if;end$$;
select 'PASS: off gate, minimum age, stale policy, terms, country, date, idempotency, claim change, private read/write, account isolation, anonymous rejection, account deletion';
