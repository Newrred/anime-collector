// Local-only candidate. Does not register itself, upload or remove backups.
import {execFile} from 'node:child_process';
import {access,open,unlink} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url));
const lock=resolve(root,'.cache/operations-private/daily-backup.lock');
let handle;
async function command(file,args){
 const result=await new Promise(done=>execFile(file,args,{cwd:root,windowsHide:true,maxBuffer:8192,timeout:1800000},(error,stdout)=>done({error,stdout})));
 if(result.error)throw Error('CHILD_FAILED');
 // Child tools expose sanitized aggregate JSON only, never DB stderr.
 console.log(JSON.stringify(JSON.parse(result.stdout)));
}
try{
 if(process.argv.length>3||(process.argv[2]&&process.argv[2]!=='--preflight'))throw Error('ARGS');
 for(const p of ['.env.moemoaprod.server.local','.cache/operations-private/supabase-ca.crt','.cache/operations-private/20261009-production/quarantine-external-20261010/VERIFIED_BYTES_ONLY.json'])await access(resolve(root,p));
 await access('C:/Users/hongs/.moemoa/recovery-keys/moemoa-production-20261009.key');
 if(process.argv[2]==='--preflight')console.log(JSON.stringify({status:'LOCAL_PREREQUISITES_PRESENT',scheduleEnabled:false,uploadEnabled:false,retentionDeleteEnabled:false,requiresLoggedOnPoweredPC:true}));
 else{
  handle=await open(lock,'wx',0o600);
  const id=new Date().toISOString().replaceAll(/[^0-9]/g,'');
  await command('C:/Windows/System32/wsl.exe',['--','python3','-B','/mnt/e/web/anime/tools/operations/capture-daily-backup.py','--run-id',id,'--mode','capture']);
  await command(process.execPath,['tools/operations/prepare-daily-backup.mjs',id,'encrypt']);
  await command('C:/Windows/System32/wsl.exe',['--','python3','-B','/mnt/e/web/anime/tools/operations/package-daily-backup.py','--run-id',id]);
 }
}catch{console.error(JSON.stringify({status:'DAILY_BACKUP_INCOMPLETE',serving:false}));process.exitCode=1;}
finally{if(handle){await handle.close();await unlink(lock);}}
