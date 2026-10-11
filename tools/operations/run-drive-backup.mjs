// Manual operator entry point; no default upload and no automatic scheduler.
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {preparedArtifact,refreshDriveToken,createDriveBackupClient} from './drive-backup.mjs';
const names=['MOEMOA_BACKUP_DRIVE_CLIENT_ID','MOEMOA_BACKUP_DRIVE_CLIENT_SECRET','MOEMOA_BACKUP_DRIVE_REFRESH_TOKEN','MOEMOA_BACKUP_DRIVE_FOLDER_ID'];
export function connectionPreflight(env){return {status:'CONNECTION_CANDIDATE_ONLY',missing:names.filter(n=>!env[n]),uploadEnabled:env.MOEMOA_BACKUP_DRIVE_UPLOAD_ENABLED==='true',weeklyScheduleEnabled:false,portableBackupRunnerReady:false,networkRequests:0};}
export async function main(args,env=process.env){
 if(args.length===1&&args[0]==='--preflight')return connectionPreflight(env);
 if(args.length!==2||args[0]!=='--upload'||env.MOEMOA_BACKUP_DRIVE_UPLOAD_ENABLED!=='true')throw Error('DRIVE_EXPLICIT_UPLOAD_REQUIRED');
 if(connectionPreflight(env).missing.length)throw Error('DRIVE_CREDENTIALS_MISSING');
 const work=resolve(args[1]);
 const artifact=await preparedArtifact(work,env.MOEMOA_BACKUP_DRIVE_FOLDER_ID);
 const token=await refreshDriveToken({clientId:env.MOEMOA_BACKUP_DRIVE_CLIENT_ID,clientSecret:env.MOEMOA_BACKUP_DRIVE_CLIENT_SECRET,refreshToken:env.MOEMOA_BACKUP_DRIVE_REFRESH_TOKEN});
 return createDriveBackupClient(token).upload({artifact,journalPath:resolve(work,'drive-upload-journal.local.json')});
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{console.log(JSON.stringify(await main(process.argv.slice(2))));}
 catch(e){console.error(JSON.stringify({status:'DRIVE_BACKUP_NOT_VERIFIED',error:/^DRIVE_[A-Z0-9_]+$/.test(e.message)?e.message:'DRIVE_LOCAL_FAILURE',safeToServe:false}));process.exitCode=1;}
}
