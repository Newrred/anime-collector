// LOCAL SQL test artifacts only. This deliberately uses working-tree migrations
// to test the generator before commit; the real CLI requires committed sources.
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildRelease,MIGRATIONS} from './build-service-admin-release.mjs';
const root=fileURLToPath(new URL('../..',import.meta.url));
const output=resolve(root,'.cache/service-admin-release-fixtures');mkdirSync(output,{recursive:true});
const sources=new Map(MIGRATIONS.map(file=>[file,readFileSync(resolve(root,file),'utf8')]));
const common={target:'test',expectedPrivateRevision:'TEST_ONLY_PHONE_WEB_20260927_01',commit:'a'.repeat(40),sources};
for(const [name,args] of [
 ['schema-rollback',{action:'schema',mode:'rollback'}],['schema-apply',{action:'schema',mode:'apply'}],
 ['operator-rollback',{action:'operator',mode:'rollback'}],['operator-apply',{action:'operator',mode:'apply'}],
 ['production-guard',{target:'production',expectedPrivateRevision:'PRIVATE_PROD_01',action:'schema',mode:'rollback'}],
])writeFileSync(resolve(output,`${name}.sql`),buildRelease({...common,...args}).sql);
process.stdout.write('LOCAL disposable SQL release fixtures prepared. No database connection.\n');
