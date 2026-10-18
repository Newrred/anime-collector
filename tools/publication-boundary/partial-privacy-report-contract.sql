-- Included after real two-card publish -> partial privacy in simple-card-sharing-contract.sql.
-- Synthetic isolated PostgreSQL only. Roll back every report, flag and fixture change.
begin;
update private.memory_publication_settings set reports_enabled=true,report_daily_limit=10;
select set_config('simple.reportTarget',public.get_memory_publication('bbbbbbbb-bbbb-4bbb-8bbb-000000000001')->>'id',true);
select pg_temp.ok((select published_operation is null and state='PUBLISHED' and published_snapshot is not null from private.memory_publications where id=current_setting('simple.reportTarget')::uuid),'partial privacy preserves public snapshot without a publish retry token');
set local role anon;
select pg_temp.ok(jsonb_array_length(public.read_memory_publication(current_setting('simple.reportTarget')::uuid)->'cards')=1,'anonymous reader still sees only the remaining public card');
select pg_temp.fails($q$select public.submit_memory_report('board',current_setting('simple.reportTarget')::uuid,'SAFETY',gen_random_uuid())$q$,'permission denied','anonymous report execution denied');
reset role;
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
select pg_temp.ok(not exists(select 1 from private.memory_reports where reporter=auth.uid()),'new reporter has no receipt that could bypass target admission');
select set_config('simple.reportOperation',gen_random_uuid()::text,true);
set local role authenticated;
-- DF-01 red/green assertion: old SQL returns NOT_FOUND despite the successful anonymous read.
select set_config('response.headers','[]',true);
select set_config('simple.reportReceipt',public.submit_memory_report('board',current_setting('simple.reportTarget')::uuid,'SAFETY',current_setting('simple.reportOperation')::uuid,'Synthetic partial-privacy report')::text,true);
select pg_temp.ok(current_setting('simple.reportReceipt')::jsonb->>'status'='RECEIVED','new reporter can report the board after partial privacy');
select pg_temp.ok(current_setting('simple.reportReceipt')::jsonb - array['id','status']='{}'::jsonb,'receipt returns no private target or reporter data');
select pg_temp.ok(public.submit_memory_report('board',current_setting('simple.reportTarget')::uuid,'SAFETY',current_setting('simple.reportOperation')::uuid,'Synthetic partial-privacy report')=current_setting('simple.reportReceipt')::jsonb,'partial-privacy report retry returns the same receipt');
select pg_temp.ok(public.submit_memory_report('board',current_setting('simple.reportTarget')::uuid,'SAFETY',gen_random_uuid(),'Duplicate')=current_setting('simple.reportReceipt')::jsonb,'open duplicate does not create another case');
select pg_temp.fails($q$select public.submit_memory_report('board',current_setting('simple.reportTarget')::uuid,'RIGHTS',current_setting('simple.reportOperation')::uuid,'Synthetic partial-privacy report')$q$,'OPERATION_MISMATCH','report operation payload cannot change');
select pg_temp.fails($q$select public.submit_memory_report('board','99999999-9999-4999-8999-999999999999','SAFETY',gen_random_uuid())$q$,'NOT_FOUND','another public board cannot admit a nonexistent target');
select pg_temp.fails($q$select public.submit_memory_report('board',null,'SAFETY',gen_random_uuid())$q$,'NOT_FOUND','null report target denied');
select pg_temp.fails('select * from private.memory_reports','permission denied','reporter cannot read private case table');
select pg_temp.ok(current_setting('response.headers')::jsonb @> '[{"Cache-Control":"no-store"}]'::jsonb,'report response remains no-store');
reset role;
select pg_temp.ok((select count(*)=1 from private.memory_reports where reporter=auth.uid()),'retries and failed targets insert no extra reports');
update private.memory_publication_settings set reports_enabled=false;
set local role authenticated;
select pg_temp.ok(public.submit_memory_report('board',current_setting('simple.reportTarget')::uuid,'SAFETY',current_setting('simple.reportOperation')::uuid,'Synthetic partial-privacy report')=current_setting('simple.reportReceipt')::jsonb,'existing receipt retry precedes disabled flag');
select pg_temp.fails($q$select public.submit_memory_report('board',current_setting('simple.reportTarget')::uuid,'RIGHTS',gen_random_uuid())$q$,'PUBLICATION_DISABLED','new report respects disabled flag');
reset role;
update private.memory_publication_settings set reports_enabled=true,report_daily_limit=1;
set local role authenticated;
select pg_temp.fails($q$select public.submit_memory_report('board',current_setting('simple.reportTarget')::uuid,'RIGHTS',gen_random_uuid())$q$,'RATE_LIMITED','new partial-privacy report respects daily quota');
reset role;
update private.memory_publication_settings set report_daily_limit=10;

-- Actual prepare preserves the old public snapshot, and must remain reportable.
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
set local role authenticated;
select public.prepare_memory_publication('bbbbbbbb-bbbb-4bbb-8bbb-000000000001',(public.get_memory_publication('bbbbbbbb-bbbb-4bbb-8bbb-000000000001')->>'revision')::bigint,current_setting('simple.selection')::jsonb);
reset role;
select pg_temp.ok((select state='PREPARING' and published_operation is null from private.memory_publications where id=current_setting('simple.reportTarget')::uuid),'re-prepare still has no published operation');
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
set local role authenticated;
select pg_temp.ok(public.submit_memory_report('board',current_setting('simple.reportTarget')::uuid,'RIGHTS',gen_random_uuid())->>'status'='RECEIVED','re-preparing a remaining public snapshot stays reportable');
reset role;
update private.memory_publications set hidden=true where id=current_setting('simple.reportTarget')::uuid;
set local role authenticated;
select pg_temp.ok(public.read_memory_publication(current_setting('simple.reportTarget')::uuid) is null,'hidden board remains unreadable');
select pg_temp.ok(public.submit_memory_report('board',current_setting('simple.reportTarget')::uuid,'SPAM',gen_random_uuid())->>'status'='RECEIVED','hiding the remaining snapshot does not suppress reporting');
reset role;
update private.memory_publications set hidden=false where id=current_setting('simple.reportTarget')::uuid;
update private.memory_publication_settings set reads_enabled=false,writes_enabled=false;
set local role authenticated;
select pg_temp.ok(public.read_memory_publication(current_setting('simple.reportTarget')::uuid) is null,'read kill switch remains effective');
select pg_temp.ok(public.submit_memory_report('board',current_setting('simple.reportTarget')::uuid,'OTHER',gen_random_uuid())->>'status'='RECEIVED','public read/write kill switch does not disable reports');
reset role;
select set_config('request.jwt.claim.sub','',true);
set local role authenticated;
select pg_temp.fails($q$select public.submit_memory_report('board',current_setting('simple.reportTarget')::uuid,'OTHER',gen_random_uuid())$q$,'AUTH_REQUIRED','missing identity denied even with authenticated role');
reset role;

-- A fresh reporter distinguishes target rejection from previously accepted receipts.
insert into auth.users(id) values('33333333-3333-4333-8333-333333333333');
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
set local role authenticated;
select public.make_memory_card_private('cccccccc-cccc-4ccc-8ccc-000000000002');
reset role;
select pg_temp.ok((select state='REVOKED' and published_snapshot is null and published_operation is null from private.memory_publications where id=current_setting('simple.reportTarget')::uuid),'last-card privacy removes snapshot and retry token');
select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true);
set local role authenticated;
select pg_temp.fails($q$select public.submit_memory_report('board',current_setting('simple.reportTarget')::uuid,'SAFETY',gen_random_uuid())$q$,'NOT_FOUND','last-card privacy does not admit a new report without publication history');
reset role;
-- First-time draft/preview has no published history; neither may pass the fallback.
update private.memory_publications set state='PRIVATE' where id=current_setting('simple.reportTarget')::uuid;
set local role authenticated;
select pg_temp.fails($q$select public.submit_memory_report('board',current_setting('simple.reportTarget')::uuid,'SAFETY',gen_random_uuid())$q$,'NOT_FOUND','unpublished private target denied');
reset role;
update private.memory_publications set state='PREPARING',preview='{}' where id=current_setting('simple.reportTarget')::uuid;
set local role authenticated;
select pg_temp.fails($q$select public.submit_memory_report('board',current_setting('simple.reportTarget')::uuid,'SAFETY',gen_random_uuid())$q$,'NOT_FOUND','first preview without public snapshot denied');
reset role;
select pg_temp.ok(not exists(select 1 from private.memory_reports where reporter=auth.uid()),'rejected private targets leave no report rows');
select pg_temp.ok((select prosecdef and proconfig=array['search_path=""'] and proargnames=array['p_kind','p_target','p_category','p_operation','p_note'] and pronargdefaults=1 from pg_proc where oid='public.submit_memory_report(text,uuid,text,uuid,text)'::regprocedure),'report RPC argument contract and definer search path preserved');
select pg_temp.ok(has_function_privilege('authenticated','public.submit_memory_report(text,uuid,text,uuid,text)','EXECUTE') and not has_function_privilege('anon','public.submit_memory_report(text,uuid,text,uuid,text)','EXECUTE') and not exists(select 1 from pg_proc p cross join lateral aclexplode(p.proacl) a where p.oid='public.submit_memory_report(text,uuid,text,uuid,text)'::regprocedure and a.grantee=0),'report RPC remains authenticated-only with no PUBLIC execute');
rollback;
