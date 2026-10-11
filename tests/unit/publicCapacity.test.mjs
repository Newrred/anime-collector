import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluatePublicCapacity,publicCapacitySnapshot} from '../../src/server/publicImages/capacity.js';
import {runPrivateMaintenance} from '../../scripts/private-image-maintenance.mjs';
import {publicSnapshot as snapshot} from './publicCapacity.fixture.mjs';
const options={totalStorageAlertBytes:980000000};
test('public reservations count once and alarm before enforced ceilings',()=>{
 const r=evaluatePublicCapacity(snapshot({publicReservedBytes:16777216,deliveryUsed:80,deliveryBytesUsed:167772160}),options);
 assert.equal(r.totalReservedOrStoredBytes,856000000-1000+16777216);
 assert.deepEqual(r.alerts,['PUBLIC_STORAGE_NEAR_LIMIT','PUBLIC_DAILY_REQUESTS_NEAR_LIMIT','PUBLIC_DAILY_RESERVED_BYTES_NEAR_LIMIT']);
 assert.deepEqual(evaluatePublicCapacity(snapshot({publicReservedBytes:16777215,deliveryUsed:79,deliveryBytesUsed:167772159}),options).alerts,[]);
});
test('open public delivery requires enabled budgets and reports deliberate pause',()=>{
 assert.deepEqual(evaluatePublicCapacity(snapshot({deliveryEnabled:false}),options).alerts,['PUBLIC_BUDGET_UNGUARDED']);
 assert.deepEqual(evaluatePublicCapacity(snapshot({deliveryPaused:true}),options).alerts,['PUBLIC_DELIVERY_PAUSED']);
 assert.deepEqual(evaluatePublicCapacity(snapshot({readsEnabled:false,deliveryEnabled:false,deliveryBytesEnabled:false}),options).alerts,[]);
});
test('stale, missing, invalid and unsafe aggregates cannot appear healthy',()=>{
 for(const patch of [{observedAt:'bad'},{observedAt:new Date(Date.now()-700000).toISOString()},{publicStoredBytes:-1},{deliveryUsed:'1'},{publicStorageBudgetEnabled:null},{privateStoredBytes:999999999}])assert.throws(()=>evaluatePublicCapacity(snapshot(patch),options));
 assert.throws(()=>evaluatePublicCapacity(snapshot(),{}));
 assert.throws(()=>evaluatePublicCapacity(undefined,options));
 assert.deepEqual(evaluatePublicCapacity(snapshot({invalidObjectCount:1,overdueCount:1,totalStoredBytes:980000000}),options).alerts,['STORAGE_SIZE_METADATA_INVALID','TOTAL_STORAGE_NEAR_LIMIT','PUBLIC_IMAGE_CLEANUP_OVERDUE']);
});
test('observation output strips unexpected backend content',()=>{
 assert.equal(JSON.stringify(publicCapacitySnapshot(snapshot({objectPath:'never-print',note:'never-print'}))).includes('never-print'),false);
});
test('maintenance combines public alarms without deleting on manual observation',async()=>{
 const paths=[];
 const result=await runPrivateMaintenance({CLEANUP_ORIGIN:'https://example.test',CLEANUP_SECRET:'s'.repeat(32),OBSERVE_ONLY:'true',PUBLIC_OBSERVE_ENABLED:'true',TOTAL_STORAGE_ALERT_BYTES:'980000000'},async url=>{
 paths.push(url.pathname);return{ok:true,json:async()=>({observedAt:new Date().toISOString(),storedBytes:1,reservedBytes:1,globalReadBytes:1,publicCapacity:snapshot({overdueCount:1})})};});
 assert.deepEqual(paths,['/api/private-image-observe']);assert.deepEqual(result.alerts,['PUBLIC_IMAGE_CLEANUP_OVERDUE']);assert.equal(result.deleted,null);
});
test('missing public report raises alarm while retaining existing private result',async()=>{
 const result=await runPrivateMaintenance({CLEANUP_ORIGIN:'https://example.test',CLEANUP_SECRET:'s'.repeat(32),OBSERVE_ONLY:'true',PUBLIC_OBSERVE_ENABLED:'true',TOTAL_STORAGE_ALERT_BYTES:'980000000'},async()=>({ok:true,json:async()=>({observedAt:new Date().toISOString(),storedBytes:1,reservedBytes:1,globalReadBytes:1})}));
 assert.equal(result.storageBytes,1);assert.deepEqual(result.alerts,['PUBLIC_CAPACITY_OBSERVATION_FAILED']);
});

test('initial free public budget alarms at 1600 requests and 51.2MB, not one unit earlier',()=>{
 const budget={deliveryDailyLimit:2000,deliveryBytesDailyLimit:64000000};
 assert.deepEqual(evaluatePublicCapacity(snapshot({...budget,deliveryUsed:1599,deliveryBytesUsed:51199999}),options).alerts,[]);
 assert.deepEqual(evaluatePublicCapacity(snapshot({...budget,deliveryUsed:1600,deliveryBytesUsed:51200000}),options).alerts,['PUBLIC_DAILY_REQUESTS_NEAR_LIMIT','PUBLIC_DAILY_RESERVED_BYTES_NEAR_LIMIT']);
});
