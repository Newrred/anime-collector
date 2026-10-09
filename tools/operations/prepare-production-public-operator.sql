-- MOEMOA_PUBLIC_OPERATOR_PROD_20261010_01
-- User explicitly selected godburgundy@gmail.com as the production moderator.
-- Run only through the fixed-target runner. Publishing/signup remain OFF.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
select pg_advisory_xact_lock(20261010,102);
do $$declare operator_id uuid; begin
 if not exists(select 1 from supabase_migrations.schema_migrations where version='20261009143000')
 or not exists(select 1 from supabase_migrations.schema_migrations where version='20260927044435')
 then raise exception 'SCHEMA_REQUIRED'; end if;
 if (select count(*) from auth.users where lower(email)='godburgundy@gmail.com' and not coalesce(is_anonymous,false))<>1
 then raise exception 'EXACT_OPERATOR_REQUIRED'; end if;
 select id into operator_id from auth.users where lower(email)='godburgundy@gmail.com' and not coalesce(is_anonymous,false);
 if exists(select 1 from private.memory_moderators where user_id<>operator_id and enabled)
 then raise exception 'OTHER_OPERATOR_PRESENT'; end if;
 if exists(select 1 from private.memory_publication_settings where reads_enabled or writes_enabled)
 or exists(select 1 from private.simple_signup_policy where enabled or admission_enabled)
 then raise exception 'EXPECTED_DISABLED'; end if;
 if exists(select 1 from cron.job where jobname='moemoa-simple-signup-purge' and
 (command<>'select public.purge_simple_signup_transients();' or schedule<>'17 * * * *' or username<>current_user))
 then raise exception 'EXISTING_JOB_DIFFERS'; end if;
 insert into private.memory_moderators(user_id,enabled) values(operator_id,true)
 on conflict(user_id) do update set enabled=true;
 perform cron.schedule('moemoa-simple-signup-purge','17 * * * *','select public.purge_simple_signup_transients();');
end$$;
select jsonb_build_object('operatorConfigured',exists(select 1 from private.memory_moderators m join auth.users u on u.id=m.user_id where lower(u.email)='godburgundy@gmail.com' and m.enabled),
 'signupPurgeScheduled',exists(select 1 from cron.job where jobname='moemoa-simple-signup-purge' and active and schedule='17 * * * *'),
 'publicOff',(select not reads_enabled and not writes_enabled from private.memory_publication_settings where singleton),
 'signupOff',(select not enabled and not admission_enabled from private.simple_signup_policy where singleton));
commit;
