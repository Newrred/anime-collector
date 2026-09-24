-- Synthetic legacy grants, loaded only by the local contract harness.
create table public.user_follows(follower_user_id uuid,followed_user_id uuid);
create table public.user_showcase_layouts(user_id uuid,layout jsonb);
create table public.user_showcase_public(user_id uuid,snapshot jsonb);
insert into public.user_follows values('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222');
grant all on public.user_follows,public.user_showcase_layouts,public.user_showcase_public to anon,authenticated;
grant select,insert,update on public.user_profiles to anon,authenticated;
create policy "read public, own, or connected profiles" on public.user_profiles for select to anon,authenticated using(true);
