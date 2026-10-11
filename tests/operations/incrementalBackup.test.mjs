import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,readdir,rm,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createEncryptedBackup,restoreEncryptedBackup} from '../../tools/private-images/encrypted-backup.mjs';
import {createIncrementalBackup,restoreIncrementalBackup,manifestFingerprint,MAX_BACKUP_CHAIN} from '../../tools/operations/incremental-backup.mjs';
const project='a'.repeat(20),key=Buffer.alloc(32,7),ctx=release=>({project,release});
async function fixture(t){
 const root=await mkdtemp(join(tmpdir(),'moemoa-incremental-'));t.after(()=>rm(root,{recursive:true,force:true}));
 let serial=0;
 const inputs=async values=>{const folder=join(root,'inputs-'+serial++);await mkdir(folder);return Promise.all(Object.entries(values).map(async([name,body],i)=>{const path=join(folder,String(i));await writeFile(path,body);return {name,path};}));};
 const base=join(root,'base');await createEncryptedBackup({files:await inputs({'database.dump':'db old','latest-journal.json':'old journal','objects/00000.bin':'image A','objects/00001.bin':'image B'}),output:base,key,context:ctx('base')});
 const chain=[{source:base,context:ctx('base'),manifestSha256:await manifestFingerprint(base)}];
 const add=async(values,previous=chain)=>{const release='delta-'+serial++,output=join(root,release);const result=await createIncrementalBackup({files:await inputs(values),previous,output,key,context:ctx(release)});return {result,chain:[...previous,{source:output,context:ctx(release),manifestSha256:result.manifestSha256}]};};
 return {root,inputs,chain,add};
}
test('delta stores changed images and fresh DB/journal; deleted parent image stays absent',async t=>{
 const f=await fixture(t);const d=await f.add({'database.dump':'db new','latest-journal.json':'new deletion','objects/00000.bin':'image A','objects/00002.bin':'image C'});
 assert.equal(d.result.reusedFiles,1);assert.equal(d.result.reusedBytes,7);assert.equal(d.result.storedFiles,3);
 const deltaOnly=join(f.root,'delta-only');await restoreEncryptedBackup({source:d.chain.at(-1).source,context:d.chain.at(-1).context,key,output:deltaOnly});
 await assert.rejects(readFile(join(deltaOnly,'payload/objects/00000.bin')));
 assert.equal(await readFile(join(deltaOnly,'payload/objects/00002.bin'),'utf8'),'image C');
 const out=join(f.root,'restored');const r=await restoreIncrementalBackup({chain:d.chain,key,output:out});assert.equal(r.safeToServe,false);assert.equal(r.files,4);
 assert.equal(await readFile(join(out,'payload/database.dump'),'utf8'),'db new');assert.equal(await readFile(join(out,'payload/latest-journal.json'),'utf8'),'new deletion');
 assert.deepEqual((await readdir(join(out,'payload/objects'))).sort(),['00000.bin','00002.bin']);
 assert.equal(await readFile(join(out,'payload/objects/00000.bin'),'utf8'),'image A');
});
test('second delta reuses newly added prior image even when inventory index changes',async t=>{
 const f=await fixture(t);const d1=await f.add({'database.dump':'db2','objects/00001.bin':'image C'});
 const d2=await f.add({'database.dump':'db3','objects/00000.bin':'image C'},d1.chain);
 assert.equal(d2.result.reusedFiles,1);assert.equal(d2.result.storedFiles,1);
 const out=join(f.root,'restored');await restoreIncrementalBackup({chain:d2.chain,key,output:out});
 assert.equal(await readFile(join(out,'payload/objects/00000.bin'),'utf8'),'image C');await assert.rejects(readFile(join(out,'payload/objects/00001.bin')));
});
test('unchanged non-image metadata is still included each week',async t=>{
 const f=await fixture(t);const d=await f.add({'database.dump':'db old','objects/00000.bin':'image A'});
 assert.equal(d.result.storedFiles,1);assert.equal(d.result.reusedFiles,1);
});
test('deleted then re-added image is stored when absent from immediate parent snapshot',async t=>{
 const f=await fixture(t),d1=await f.add({'database.dump':'db2'}),d2=await f.add({'database.dump':'db3','objects/00000.bin':'image A'},d1.chain);
 assert.equal(d2.result.reusedFiles,0);
});
test('missing or reordered parent fails without complete output',async t=>{
 const f=await fixture(t),d=await f.add({'database.dump':'db2','objects/00000.bin':'image A'});
 for(const [i,chain] of [[d.chain.at(-1)],[...d.chain].reverse()].entries()){
  const output=join(f.root,'bad-'+i);await assert.rejects(restoreIncrementalBackup({chain,key,output}));await assert.rejects(readdir(output));
 }
});
test('substituting a different valid encrypted base is rejected by parent fingerprint',async t=>{
 const f=await fixture(t),d=await f.add({'database.dump':'db2','objects/00000.bin':'image A'});
 const other=join(f.root,'other');await createEncryptedBackup({files:await f.inputs({'database.dump':'other','objects/00000.bin':'image A'}),output:other,key,context:ctx('other')});
 const chain=[{source:other,context:ctx('other'),manifestSha256:await manifestFingerprint(other)},d.chain.at(-1)];
 await assert.rejects(restoreIncrementalBackup({chain,key,output:join(f.root,'bad')}));
});
test('corrupt image ciphertext cannot be reused',async t=>{
 const f=await fixture(t),folder=join(f.chain[0].source,'payload'),n=(await readdir(folder)).find(n=>n!=='manifest.enc');
 const p=join(folder,n),bytes=await readFile(p);bytes[0]^=1;await writeFile(p,bytes);
 await assert.rejects(f.add({'database.dump':'db2','objects/00000.bin':'image A'}));
});
test('wrong key or pinned manifest hash fails',async t=>{
 const f=await fixture(t);await assert.rejects(restoreIncrementalBackup({chain:f.chain,key:Buffer.alloc(32,8),output:join(f.root,'wrong-key')}));
 await assert.rejects(restoreIncrementalBackup({chain:[{...f.chain[0],manifestSha256:'0'.repeat(64)}],key,output:join(f.root,'wrong-hash')}));
});
test('traversal, duplicate names and reserved snapshot filename rejected',async t=>{
 const f=await fixture(t),files=await f.inputs({'database.dump':'db2'});
 for(const [i,bad] of [[{...files[0],name:'../x'}],[files[0],files[0]],[{...files[0],name:'incremental-snapshot.json'}]].entries())
  await assert.rejects(createIncrementalBackup({files:bad,previous:f.chain,output:join(f.root,'bad-'+i),key,context:ctx('bad-'+i)}));
});
test('project mismatch and release reuse rejected',async t=>{
 const f=await fixture(t),files=await f.inputs({'database.dump':'db2'});
 for(const context of [{project:'b'.repeat(20),release:'new'},ctx('base')])await assert.rejects(createIncrementalBackup({files,previous:f.chain,output:join(f.root,'bad'),key,context}));
});
test('chain bound rejects rather than silently dropping older dependencies',async t=>{
 const f=await fixture(t);await assert.rejects(createIncrementalBackup({files:await f.inputs({'database.dump':'db2'}),previous:Array(MAX_BACKUP_CHAIN).fill(f.chain[0]),output:join(f.root,'bad'),key,context:ctx('new')}));
});
test('existing restore destination and original backup preserved',async t=>{
 const f=await fixture(t),out=join(f.root,'existing');await mkdir(out);await writeFile(join(out,'keep'),'keep');
 await assert.rejects(restoreIncrementalBackup({chain:f.chain,key,output:out}));assert.equal(await readFile(join(out,'keep'),'utf8'),'keep');
 assert.equal(await manifestFingerprint(f.chain[0].source),f.chain[0].manifestSha256);
});
