import test from 'node:test';
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {publicSnapshot} from './publicCapacity.fixture.mjs';

test('actual maintenance CLI emits failed-job annotation and summary for public alarm',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'moemoa-capacity-'));
 try {
  const summary=join(dir,'summary.md');
  const observation={observedAt:new Date().toISOString(),storedBytes:0,reservedBytes:0,globalReadBytes:0,publicCapacity:publicSnapshot({overdueCount:1})};
  const preload='data:text/javascript,'+encodeURIComponent('globalThis.fetch=async(url)=>{if(new URL(url).pathname!=="/api/private-image-observe")throw new Error("unexpected mutation");return {ok:true,json:async()=>('+JSON.stringify(observation)+')}}');
  let failed;
  try {await promisify(execFile)(process.execPath,['--import',preload,'scripts/private-image-maintenance.mjs'],{env:{...process.env,CLEANUP_ORIGIN:'https://example.test',CLEANUP_SECRET:'synthetic'.repeat(8),OBSERVE_ONLY:'true',PUBLIC_OBSERVE_ENABLED:'true',TOTAL_STORAGE_ALERT_BYTES:'980000000',GITHUB_STEP_SUMMARY:summary}});}
  catch(error){failed=error;}
  assert.equal(failed?.code,1);
  assert.match(failed.stderr,/::error::PUBLIC_IMAGE_CLEANUP_OVERDUE/);
  assert.equal(JSON.parse(failed.stdout).cleanupSkipped,true);
  const text=await readFile(summary,'utf8');
  assert.match(text,/not measured transfer/);
  assert.match(text,/overdue: 1/);
  assert.doesNotMatch(failed.stdout+failed.stderr+text,/synthetic/);
 } finally {await rm(dir,{recursive:true,force:true});}
});
