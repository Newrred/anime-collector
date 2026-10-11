// Local isolated restore ONLY. No remote DB credentials or production connection.
import {execFile} from 'node:child_process';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url));
const runId=process.argv[2]||'20261011';
if(!/^[a-zA-Z0-9-]{1,60}$/.test(runId)||process.argv.length>3)throw Error('INVALID_RUN_ID');
const work=resolve(root,'.cache/operations-private/isolated-recovery-'+runId);
const backup=resolve(root,'.cache/operations-private/20261009-production/quarantine-external-20261010');
const docker='C:/Program Files/Docker/Docker/resources/bin/docker.exe';
const image='supabase/postgres@sha256:f371b5f3f2ac0a05703f33d6e6134515fb2498cab708fb948a0aeb7481467c00';
const name='moemoa-recovery-'+runId;
let phase='preflight',created=false;
const report={scope:'Local isolated real production dump',image,network:'none',publishedPorts:0,safeToServe:false};
function call(args,input){return new Promise((resolve,reject)=>{
 const c=execFile(docker,args,{windowsHide:true,maxBuffer:8*1024*1024,timeout:180000},(err,stdout,stderr)=>resolve({status:err?1:0,stdout,stderr}));
 if(input!==undefined)c.stdin.end(input);else c.stdin.end();
});}
async function checked(args,input){const r=await call(args,input);await writeFile(resolve(work,phase+'.private.log'),r.stdout+r.stderr);if(r.status)throw Error('LOCAL_RESTORE_STAGE_FAILED');return r.stdout;}
const sql=text=>checked(['exec','-i',name,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-h','/work/socket','-U','moemoa_recovery_admin','-d','postgres'],text);
const ident=s=>{if(!/^[a-zA-Z_][a-zA-Z_0-9]*$/.test(s))throw Error();return '"'+s+'"';};
try{
 const proof=JSON.parse(await readFile(resolve(backup,'VERIFIED_BYTES_ONLY.json'),'utf8'));
 if(proof.allSha256AndLengthsMatch!==true)throw Error();
 const roles=JSON.parse(await readFile(resolve(work,'roles.json'),'utf8'));
 const current=JSON.parse(await readFile(resolve(work,'latest-journal.json'),'utf8'));
 const capturedAt=Date.parse(current.capturedAt);
 if(!Number.isFinite(capturedAt)||capturedAt>Date.now()+60000||Date.now()-capturedAt>3600000)throw Error('INVALID_CONTEXT_TIME');
 const existing=await call(['inspect',name]);if(existing.status===0)throw Error('EXISTING_CONTAINER_REFUSED');
 phase='start';
 await checked(['run','-d','--name',name,'--label','moemoa.recovery=20261011','--network','none','--read-only','--cap-drop','ALL','--security-opt','no-new-privileges','--pids-limit','128','--memory','2g','--no-healthcheck','--user','100:101','--tmpfs','/work:rw,nosuid,noexec,size=1073741824,uid=100,gid=101,mode=0700','--mount','type=bind,source='+resolve(backup,'payload')+',target=/backup,readonly','--entrypoint','sh',image,'-ec',"mkdir /work/db /work/socket; initdb -D /work/db -U moemoa_recovery_admin --auth-local=trust --auth-host=reject >/work/init.log 2>&1; exec postgres -D /work/db -c listen_addresses='' -c unix_socket_directories=/work/socket -c shared_preload_libraries=pg_cron,pg_stat_statements -c cron.database_name=postgres -c cron.launch_active_jobs=off -c log_min_error_statement=panic"]);
 created=true; phase='ready';
 let ready=false;for(let n=0;n<30;n++){const r=await call(['exec',name,'pg_isready','-h','/work/socket','-U','moemoa_recovery_admin']);if(!r.status){ready=true;break;}await new Promise(r=>setTimeout(r,1000));}if(!ready)throw Error();
 const inspected=JSON.parse(await checked(['inspect',name]))[0];
 if(inspected.HostConfig.NetworkMode!=='none'||Object.keys(inspected.HostConfig.PortBindings||{}).length||inspected.Config.Labels['moemoa.recovery']!=='20261011')throw Error();
 phase='roles';
 const flags={super:'SUPERUSER',inherit:'INHERIT',createRole:'CREATEROLE',createDb:'CREATEDB',login:'LOGIN',replication:'REPLICATION',bypassRls:'BYPASSRLS'};
 let setup=roles.roles.map(r=>'CREATE ROLE '+ident(r.name)+' '+Object.entries(flags).map(([k,v])=>(r[k]?'':'NO')+v).join(' ')+';').join('\n');
 for(const r of roles.memberships)for(const [k,flag] of [['admin','ADMIN'],['inherit','INHERIT'],['set','SET']])setup+='\nGRANT '+ident(r.role)+' TO '+ident(r.member)+' WITH '+flag+' '+(r[k]?'TRUE':'FALSE')+';';
 await sql(setup);report.roles=roles.roles.length;report.memberships=roles.memberships.length;
 phase='import';const began=Date.now();
 await checked(['exec',name,'pg_restore','--exit-on-error','--single-transaction','--clean','--if-exists','--no-tablespaces','-h','/work/socket','-U','moemoa_recovery_admin','-d','postgres','/backup/database.dump']);
 report.importSeconds=(Date.now()-began)/1000;report.databaseImportVerified=true;
 phase='close-access';await sql("UPDATE private.memory_private_media_policy SET enabled=false; DO $closed$ BEGIN IF to_regclass('private.memory_publication_settings') IS NOT NULL THEN EXECUTE 'UPDATE private.memory_publication_settings SET reads_enabled=false,writes_enabled=false,images_enabled=false,minihomes_enabled=false,follows_enabled=false,reports_enabled=false'; END IF; END $closed$;");
 phase='summary';
 report.database=JSON.parse((await sql("SELECT jsonb_build_object('version',version(),'extensions',(SELECT jsonb_agg(extname ORDER BY extname) FROM pg_extension),'cards',(SELECT count(*) FROM public.memory_cards),'assets',(SELECT count(*) FROM public.memory_visual_assets),'media',(SELECT count(*) FROM private.memory_private_media),'accounts',(SELECT count(*) FROM auth.users),'tables',(SELECT count(*) FROM pg_tables WHERE schemaname NOT IN ('pg_catalog','information_schema')),'cronRuns',(SELECT count(*) FROM cron.job_run_details),'cronLaunch',current_setting('cron.launch_active_jobs'),'privateEnabled',(SELECT enabled FROM private.memory_private_media_policy),'publicSettingsPresent',to_regclass('private.memory_publication_settings') IS NOT NULL);")).trim());
 if(report.database.privateEnabled||report.database.cronLaunch!=='off')throw Error();

 phase='private-reconciliation';
 const literal=JSON.stringify(current).replaceAll("'","''");
 report.privateReplay=JSON.parse((await sql("CREATE TEMP TABLE latest_context(j jsonb); INSERT INTO latest_context VALUES ('"+literal+"');\n"+await readFile(resolve(root,'tools/operations/isolated-private-recovery.sql'),'utf8'))).trim());
 if(report.privateReplay.operationSourceHashQuotaPreserved!==true)throw Error();
 phase='access-probes';
 report.access=JSON.parse((await sql(await readFile(resolve(root,'tools/operations/isolated-recovery-access.sql'),'utf8'))).trim());
 phase='final-closed';
 report.privateAccessRemainsClosed=(await sql('SELECT NOT enabled FROM private.memory_private_media_policy;')).trim()==='t';
 if(!report.privateAccessRemainsClosed)throw Error();
 report.status='IMPORT_PRIVATE_REPLAY_ACCESS_PASS_SERVING_CLOSED';
}catch(e){report.status='INCOMPLETE';report.failedStage=phase;process.exitCode=1;}
finally{
 if(created){phase='stop';const r=await call(['stop','--time','10',name]);report.containerStopped=r.status===0;if(!report.containerStopped){report.status='INCOMPLETE';report.failedStage='stop';process.exitCode=1;}}
 await writeFile(resolve(work,'restore-summary.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report));
}
