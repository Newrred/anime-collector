// Synthetic local-cluster artifacts only. The release CLI requires committed sources.
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildRelease,MIGRATIONS} from './build-first-signup-release.mjs';
const root=fileURLToPath(new URL('../..',import.meta.url));
const output=resolve(root,'.cache/first-signup-fixtures');mkdirSync(output,{recursive:true});
const sources=new Map(MIGRATIONS.map(file=>[file,readFileSync(resolve(root,file),'utf8')]));
const common={target:'test',expectedPrivateRevision:'TEST_ONLY_PHONE_WEB_20260927_01',expectedRevision:'f'.repeat(64),commit:'a'.repeat(40),sources};
for(const action of ['inspect','readback','schema','stage','activate','pause'])for(const mode of ['rollback','apply']){
 writeFileSync(resolve(output,`${action}-${mode}.sql`),buildRelease({...common,action,mode}).sql);
}
writeFileSync(resolve(output,'readback-crlf.sql'),buildRelease({...common,action:'readback'}).sql.replace(/\n/g,'\r\n'));
writeFileSync(resolve(output,'production-guard.sql'),buildRelease({...common,target:'production',expectedPrivateRevision:'MOEMOA_PRIVATE_20261008_01',action:'stage'}).sql);
const q=s=>`'${s.replaceAll("'","''")}'`;
const rows=MIGRATIONS.slice(0,2).map(file=>{
 const [,version,name]=file.match(/\/(\d{14})_(\w+)\.sql$/),source=sources.get(file).replace(/\r\n/g,'\n');
 return `(${q(version)},${q(name)},array[${q(`-- release SYNTHETIC_LOCAL; source ${'a'.repeat(40)}\n${source}`)}])`;
});
writeFileSync(resolve(output,'ledger.sql'),`create schema supabase_migrations;
create table supabase_migrations.schema_migrations(version text primary key,name text,statements text[]);
insert into supabase_migrations.schema_migrations(version,name,statements) values ${rows.join(',\n')};\n`);
process.stdout.write('LOCAL first-signup fixtures prepared. No network or hosted database access.\n');
