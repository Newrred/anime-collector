import test from 'node:test';
import assert from 'node:assert/strict';
import { checkReleaseCandidate } from '../../scripts/check-release-candidate.mjs';
const hash='a'.repeat(64), head='a'.repeat(40);
const evidence={path:'fixture.log',sha256:hash};
const candidate=()=>({sourceCommit:head,catalogRelease:{id:'fixture',hash},configurationEvidence:evidence,
  checks:Object.fromEntries(['unit','catalog','browser','sql','build','android'].map(id=>[id,{status:'PASS',sourceCommit:head,passed:1,failed:0,skipped:0,evidence}])),
  gates:Object.fromEntries(['D01','D02','D03','D04','D05','D06'].map(id=>[id,{status:'VERIFIED',verifiedBy:'fixture operator',evidence}]))});
const environment={head,dirty:false,verifyEvidence:async value=>value?.sha256===hash};
test('candidate integrity requires clean matching source, all checks, external gates and artifacts',async()=>{
  assert.equal((await checkReleaseCandidate(candidate(),environment)).ready,true);
  for(const field of ['source','dirty','test','skip','gate','artifact','catalog','config']){
    const c=candidate(),e={...environment};
    if(field==='source') c.sourceCommit='b'.repeat(40);
    if(field==='dirty') e.dirty=true;
    if(field==='test') c.checks.browser.failed=1;
    if(field==='skip') c.checks.catalog.skipped=1;
    if(field==='gate') c.gates.D01.status='PENDING';
    if(field==='artifact') c.checks.sql.evidence={...evidence,sha256:'b'.repeat(64)};
    if(field==='catalog') c.catalogRelease.hash='';
    if(field==='config') c.configurationEvidence=null;
    assert.equal((await checkReleaseCandidate(c,e)).ready,false,field);
  }
});
test('missing candidate and unexplained skipped checks never pass',async()=>{
  assert.equal((await checkReleaseCandidate(null,environment)).ready,false);
  const c=candidate();c.checks.catalog.skipped=2;c.checks.catalog.skipReason='Optional unavailable browser environment; tracked separately';
  assert.equal((await checkReleaseCandidate(c,environment)).ready,true);
});

test('Web-only Android exclusion requires matching D02 evidence and preserves every other gate', async()=>{
  const web=()=>{const c=candidate();c.releaseChannel='WEB_ONLY';c.checks.android={status:'NOT_APPLICABLE',sourceCommit:head,passed:0,failed:0,skipped:0,skipReason:'User approved Web first; Android follow-up',evidence};return c;};
  assert.equal((await checkReleaseCandidate(web(),environment)).ready,true);
  for(const field of ['channel','unknown','approval','approver','evidence','differentEvidence','source','counts','reason','webCheck','deployGate']){
    const c=web();
    if(field==='channel') delete c.releaseChannel;
    if(field==='unknown') c.releaseChannel='ANY';
    if(field==='approval') c.gates.D02.status='PENDING';
    if(field==='approver') c.gates.D02.verifiedBy='';
    if(field==='evidence') {c.gates.D02.evidence={...evidence,sha256:'b'.repeat(64)};c.checks.android.evidence=c.gates.D02.evidence;}
    if(field==='differentEvidence') c.checks.android.evidence={...evidence,path:'other.log'};
    if(field==='source') c.checks.android.sourceCommit='b'.repeat(40);
    if(field==='counts') c.checks.android.failed=1;
    if(field==='reason') c.checks.android.skipReason='';
    if(field==='webCheck') c.checks.browser.status='NOT_APPLICABLE';
    if(field==='deployGate') c.gates.D06.status='PENDING';
    assert.equal((await checkReleaseCandidate(c,environment)).ready,false,field);
  }
});
