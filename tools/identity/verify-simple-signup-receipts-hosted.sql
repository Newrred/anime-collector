-- Read-only post-apply check ONLY in moemoa-test (nmgkhknponvzcwliajyk).
-- Run as the dashboard administrator; no identifiers or receipt values are output.
-- Claims/role/summary are transaction-local. This is not an actual Google/JWT test.
-- Git source is LF; Windows SQL-editor pasting may store identical source as CRLF.
-- Normalize only CRLF -> LF for source checks; report the unmodified applied hash too.
-- This release: Git LF 1596 bytes / d3e50084621457853ceed3d2a31fe3da8e808e5e7497a09bd32e34f3aaf207d0.
-- Observed editor CRLF 1622 bytes / 38f63718fcb98954923ae75d5f9638806b101e5d142660e29cdfe549d608abda.
begin isolation level repeatable read read only;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $verify$
declare
  phase text := 'precondition';
  owner record;
  actual jsonb;
  expected jsonb;
  policy_before jsonb;
  checked integer := 0;
  receipt_count integer;
  rejected boolean;
  subject text;
  ledger_statement text;
  canonical_statement text;
  applied_source text;
  canonical_source text;
  applied_source_hash text;
  proc oid := to_regprocedure('public.get_my_simple_signup_receipts()');
begin
  if proc is null or current_setting('transaction_read_only') <> 'on' then
    raise exception 'RECEIPT_CHECK_PRECONDITION';
  end if;
  phase := 'function_acl';
  if not exists (
    select 1 from pg_proc p where p.oid = proc and p.prosecdef and p.provolatile = 's'
      and p.pronargs = 0 and p.prorettype = 'jsonb'::regtype and not p.proretset
      and p.proconfig = array['search_path=""']::text[]
  ) or not has_function_privilege('authenticated', proc, 'EXECUTE')
    or has_function_privilege('anon', proc, 'EXECUTE')
    or has_function_privilege('service_role', proc, 'EXECUTE')
    or exists (select 1 from pg_proc p,
      lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
      where p.oid = proc and a.grantee = 0 and a.privilege_type = 'EXECUTE') then
    raise exception 'RECEIPT_FUNCTION_OR_ACL_MISMATCH';
  end if;
  phase := 'ledger';
  select s.statement into strict ledger_statement
    from supabase_migrations.schema_migrations m,
      lateral unnest(m.statements) s(statement)
    where m.version = '20261010170000' and m.name = 'simple_signup_receipts'
      and cardinality(m.statements) = 1;
  canonical_statement := replace(ledger_statement, chr(13) || chr(10), chr(10));
  applied_source := substr(ledger_statement, strpos(ledger_statement, chr(10)) + 1);
  canonical_source := replace(applied_source, chr(13) || chr(10), chr(10));
  applied_source_hash := encode(sha256(convert_to(applied_source, 'UTF8')), 'hex');
  if not starts_with(canonical_statement, '-- release MOEMOA_SIGNUP_RECEIPTS_TEST_20261010_01; source 5d921d7ffbcb8d1c6b06b92626b772d435dbf2dd; sha256 d3e50084621457853ceed3d2a31fe3da8e808e5e7497a09bd32e34f3aaf207d0' || chr(10))
    or encode(sha256(convert_to(canonical_source, 'UTF8')), 'hex')
      <> 'd3e50084621457853ceed3d2a31fe3da8e808e5e7497a09bd32e34f3aaf207d0'
    or split_part(canonical_source, '$$', 2) is distinct from
      (select replace(prosrc, chr(13) || chr(10), chr(10)) from pg_proc where oid = proc)
  then raise exception 'RECEIPT_LEDGER_MISMATCH'; end if;
  phase := 'baseline';
  if (select count(*) from auth.users) <> 3
    or (select count(*) from auth.users where coalesce(is_anonymous, false) = false) <> 3
    or exists (select 1 from auth.users where id = '00000000-0000-4000-8000-000000000000') then
    raise exception 'RECEIPT_ACCOUNT_BASELINE_CHANGED';
  end if;
  select count(*) into receipt_count from private.simple_signup_declarations;
  if receipt_count <> 2 then raise exception 'RECEIPT_COUNT_BASELINE_CHANGED'; end if;
  policy_before := public.get_simple_signup_policy();
  perform set_config('request.jwt.claims', '{}', true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  phase := 'own_projection';
  for owner in select id from auth.users where coalesce(is_anonymous, false) = false loop
    select jsonb_build_object('receipts', coalesce(jsonb_agg(jsonb_build_object(
      'policyVersion', r.policy_version, 'termsVersion', r.terms_version,
      'privacyVersion', r.privacy_version, 'country', r.country, 'recordedAt', r.recorded_at
    ) order by r.recorded_at desc, r.policy_version desc), '[]'::jsonb)) into expected
    from (select policy_version, terms_version, privacy_version, country, recorded_at
      from private.simple_signup_declarations where user_id = owner.id
      order by recorded_at desc, policy_version desc limit 20) r;
    perform set_config('request.jwt.claim.sub', owner.id::text, true);
    execute 'set local role authenticated';
    actual := public.get_my_simple_signup_receipts();
    execute 'reset role';
    if actual is distinct from expected then raise exception 'RECEIPT_OWNER_PROJECTION_MISMATCH'; end if;
    checked := checked + 1;
  end loop;

  phase := 'invalid_subject';
  foreach subject in array array['', '00000000-0000-4000-8000-000000000000', 'not-a-uuid'] loop
    perform set_config('request.jwt.claim.sub', subject, true);
    rejected := false;
    execute 'set local role authenticated';
    begin
      perform public.get_my_simple_signup_receipts();
    exception when others then
      rejected := (subject = 'not-a-uuid' and sqlstate = '22P02')
        or (subject <> 'not-a-uuid' and sqlstate = 'P0001' and sqlerrm = 'AUTH_REQUIRED');
    end;
    execute 'reset role';
    if not rejected then raise exception 'RECEIPT_INVALID_SUBJECT_ACCEPTED'; end if;
  end loop;
  phase := 'postcondition';
  if checked <> 3 or public.get_simple_signup_policy() is distinct from policy_before then
    raise exception 'RECEIPT_CHECK_INCOMPLETE';
  end if;
  perform set_config('moemoa.receipt_verification', jsonb_build_object(
    'passed', true, 'accountsChecked', checked, 'receiptCount', receipt_count,
    'exactOwnProjection', true, 'authenticatedOnlyAcl', true,
    'securityDefinerEmptySearchPath', true, 'releaseLedgerMatches', true,
    'canonicalGitLfSha256', 'd3e50084621457853ceed3d2a31fe3da8e808e5e7497a09bd32e34f3aaf207d0',
    'appliedSourceSha256', applied_source_hash,
    'crlfNormalized', applied_source <> canonical_source,
    'missingNonexistentMalformedSubjectsRejected', true,
    'policyUnchanged', true, 'readOnlyTransaction', true
  )::text, true);
exception when others then
  -- Do not expose provider errors, owner IDs, row contents or query values.
  -- Only this fixed, source-owned phase enum may leave the verification block.
  raise exception using errcode = 'P0001', message = 'RECEIPT_HOSTED_VERIFY_FAILED: ' ||
    case when phase in ('precondition', 'function_acl', 'ledger', 'baseline',
      'own_projection', 'invalid_subject', 'postcondition') then phase else 'unknown' end;
end;
$verify$;
select current_setting('moemoa.receipt_verification')::jsonb as verification;
rollback;
