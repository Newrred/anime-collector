// Renders only the reviewed test data/config script for the connected SQL API.
// No database access; defaults to ROLLBACK. Runtime owner is never written to disk.
import fs from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const TEST_PROJECT='nmgkhknponvzcwliajyk';
const quote=value=>"'"+value.replaceAll("'","''")+"'";
export async function renderTestSql(kind,{targetProject=TEST_PROJECT,ownerEmail,apply=false}={}) {
 if(targetProject!==TEST_PROJECT) throw Error('TEST_TARGET_REQUIRED');
 if(!['fixture','config','restore'].includes(kind)) throw Error('TEST_OPERATION_INVALID');
 if(kind==='fixture' && (typeof ownerEmail!=='string'||ownerEmail.length>254||!/^\S+@\S+\.\S+$/u.test(ownerEmail))) throw Error('TEST_OWNER_REQUIRED');
 const file=kind==='fixture'?'fixture.sql':'config.sql';
 const source=await fs.readFile(new URL(file,import.meta.url),'utf8');
 const start=source.indexOf('BEGIN;'),end=source.indexOf('\\if :apply_collection_',start);
 if(start<0||end<start) throw Error('TEST_SCRIPT_CHANGED');
 let query=source.slice(start,end).replaceAll(":'target_project'",quote(targetProject));
 if(kind==='fixture') query=query.replaceAll(":'owner_email'",quote(ownerEmail));
 else query=query.replace(':restore_collection_config::boolean',(kind==='restore'?'true':'false')+'::boolean');
 if(/^\\/mu.test(query)||/:'(?:owner_email|target_project)'|:restore_collection_config/u.test(query)) throw Error('TEST_SCRIPT_UNRESOLVED');
 return query+(apply?'COMMIT;\n':'ROLLBACK;\n');
}
if(typeof process!=='undefined'&&process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) {
 const [kind='config',ownerEmail]=process.argv.slice(2);
 process.stdout.write(await renderTestSql(kind,{ownerEmail}));
}
