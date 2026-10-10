-- Additive, read-only access to the current account's historical signup receipts.
-- This does not activate a policy, reinterpret old acceptance, or verify age/guardians.
create function public.get_my_simple_signup_receipts() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare owner_id uuid := auth.uid(); result jsonb;
begin
 if owner_id is null or coalesce(auth.role(),'') <> 'authenticated'
 or not exists(select 1 from auth.users where id=owner_id and coalesce(is_anonymous,false)=false)
 then raise exception 'AUTH_REQUIRED'; end if;

 -- No user ID input; policy being disabled must not hide earlier acceptance.
 select coalesce(jsonb_agg(jsonb_build_object(
  'policyVersion',r.policy_version,'termsVersion',r.terms_version,
  'privacyVersion',r.privacy_version,'country',r.country,'recordedAt',r.recorded_at
 ) order by r.recorded_at desc,r.policy_version desc),'[]'::jsonb) into result
 from (
  select policy_version,terms_version,privacy_version,country,recorded_at
  from private.simple_signup_declarations where user_id=owner_id
  order by recorded_at desc,policy_version desc limit 20
 ) r;
 return jsonb_build_object('receipts',result);
end $$;
revoke all on function public.get_my_simple_signup_receipts() from public,anon,service_role;
grant execute on function public.get_my_simple_signup_receipts() to authenticated;
comment on function public.get_my_simple_signup_receipts() is
 'Own latest 20 signup receipts only, including when signup is disabled. Historical acceptance is not identity, guardian, or public eligibility verification.';
