import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const root=fileURLToPath(new URL('../../',import.meta.url));
const evidence=JSON.parse(readFileSync(join(root,'docs/moemoa/release-v2/evidence/2026-10-11-public-capacity-closeout.json'),'utf8'));
function candidate(change=()=>{}) {
 const input=structuredClone(evidence.firstPublicProductionCandidate_02.preflight);
 input.snapshot.checkedAt=new Date().toISOString(); change(input);
 const dir=mkdtempSync(join(tmpdir(),'moemoa-candidate-'));
 try {
  const path=join(dir,'aggregate.json'); writeFileSync(path,JSON.stringify(input));
  return spawnSync(process.execPath,['tools/operations/build-first-public-candidate.mjs',path],{cwd:root,encoding:'utf8'});
 } finally { rmSync(dir,{recursive:true,force:true}); }
}
test('final candidate binds exact tested source, fixed notice and restored hosted evidence',()=>{
 const r=candidate(); assert.equal(r.status,0,r.stderr); const m=JSON.parse(r.stdout);
 assert.equal(m.release,'MOEMOA_FIRST_PUBLIC_CANDIDATE_20261011_03');
 assert.equal(m.testedCommit,'50ecbc9e5b393671a129df0ed229fda01ecc4958');
 assert.equal(m.priorHostedEvidence.restored,true);
 assert.equal(m.priorHostedEvidence.scope.image.throughDeployedPublicImageHandler,true);
 assert.equal(m.priorHostedEvidence.scope.rawImageUrl404Verified,false);
 assert.equal(m.remoteMutations,0);
 assert.deepEqual(m.migrations.map(x=>x.version),['20261010160000','20261011120000','20261011180000']);
 assert.equal(m.publicNotice.sha256,'72ffbcf83af732bba65c43d77096cd02b47f0c76c55f0d77ebb002b9949dfe5b');
 assert.equal(m.proposedConfiguration.preserve.globalPublicStorageBytes,20971520);
});
const invalid=[
 ['wrong project',x=>{x.target='other'},'WRONG_TARGET'],
 ['stale snapshot',x=>{x.snapshot.checkedAt='2026-01-01T00:00:00Z'},'STALE_PREFLIGHT'],
 ['missing snapshot date',x=>{delete x.snapshot.checkedAt},'STALE_PREFLIGHT'],
 ['ledger changed',x=>{x.snapshot.migrations.pop()},'BASELINE_CHANGED'],
 ['same count wrong ledger',x=>{x.snapshot.migrations[0]='19000101000000'},'MIGRATION_DELTA_CHANGED'],
 ['image flag alone enabled',x=>{x.snapshot.publicationSettings.images_enabled=true},'PUBLIC_BASELINE_CHANGED'],
 ['policy drift',x=>{x.snapshot.publicationSettings.policy_revision='CHANGED'},'PUBLIC_BASELINE_CHANGED'],
 ['public content already exists',x=>{x.snapshot.publicCounts.assets=1},'PUBLIC_BASELINE_CHANGED'],
 ['disabled global storage protection',x=>{x.snapshot.storagePolicy.enabled=false},'PRESERVED_BASELINE_CHANGED'],
 ['signup country changed',x=>{x.snapshot.enabledCountries[0].minimumAge=13},'PRESERVED_BASELINE_CHANGED'],
 ['moderator missing',x=>{x.snapshot.moderatorCount=0},'PRESERVED_BASELINE_CHANGED'],
 ['active override',x=>{x.snapshot.activeDeliveryOverrides=1},'PUBLIC_BASELINE_CHANGED'],
 ['paused quota',x=>{x.snapshot.resourcePolicies.find(p=>p.scope==='IMAGE_DELIVERY').paused=true},'DELIVERY_BASELINE_CHANGED'],
];
for(const [name,change,error] of invalid)test('rejects '+name,()=>{const r=candidate(change);assert.equal(r.status,1);assert.equal(r.stderr.trim(),error);assert.equal(r.stdout,'');});
