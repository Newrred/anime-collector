-- MOEMOA_SIGNUP_EXPIRY_PROD_20261010_01: independent of moderator signup.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
select pg_advisory_xact_lock(20261010,102);
do $$begin
 if not exists(select 1 from supabase_migrations.schema_migrations where version='20261009143000')
 then raise exception 'SCHEMA_REQUIRED'; end if;
 if exists(select 1 from cron.job where jobname='moemoa-simple-signup-purge' and
 (command<>'select public.purge_simple_signup_transients();' or schedule<>'17 * * * *' or username<>current_user))
 then raise exception 'EXISTING_JOB_DIFFERS'; end if;
 perform cron.schedule('moemoa-simple-signup-purge','17 * * * *','select public.purge_simple_signup_transients();');
end$$;
select jsonb_build_object('signupPurgeScheduled',exists(select 1 from cron.job where jobname='moemoa-simple-signup-purge' and active and schedule='17 * * * *'),
 'signupOff',(select not enabled and not admission_enabled from private.simple_signup_policy where singleton));
commit;
