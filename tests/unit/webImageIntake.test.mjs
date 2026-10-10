import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, webcrypto } from 'node:crypto';
import { inspectWebImage, createWebImageIntake } from '../../src/features/memory/adapters/platform/webImageIntake.js';
import { jpegBytes, pngBytes, webpBytes, webpVp8xBytes } from '../catalog-lab/fixtures/cover-valid-images.mjs';

test('Web intake recognizes real static JPEG/PNG/WebP and rejects spoofed MIME', () => {
  for (const [bytes, mime] of [[jpegBytes, 'image/jpeg'], [pngBytes, 'image/png'], [webpBytes, 'image/webp'], [webpVp8xBytes, 'image/webp']]) {
    assert.equal(inspectWebImage(bytes, mime).mimeType, mime);
    assert.throws(() => inspectWebImage(bytes, 'image/svg+xml'), { code: 'UNSUPPORTED_IMAGE_TYPE' });
  }
});

test('Web intake bounds bytes/pixels before decode and rejects animated/truncated inputs', () => {
  assert.throws(() => inspectWebImage(new Uint8Array(20_000_001)), { code: 'IMAGE_TOO_LARGE' });
  const huge = new Uint8Array(pngBytes);
  new DataView(huge.buffer).setUint32(16, 24_000_001);
  assert.throws(() => inspectWebImage(huge), { code: 'IMAGE_TOO_COMPLEX' });
  assert.throws(() => inspectWebImage(pngBytes.slice(0, 24)), { code: 'IMAGE_DECODE_FAILED' });
  const animated = new Uint8Array(webpVp8xBytes); animated[20] |= 2;
  assert.throws(() => inspectWebImage(animated), { code: 'UNSUPPORTED_IMAGE_TYPE' });
  const apng = new Uint8Array(pngBytes); apng.set(new TextEncoder().encode('acTL'), 37);
  assert.throws(() => inspectWebImage(apng), { code: 'UNSUPPORTED_IMAGE_TYPE' });
  assert.throws(() => inspectWebImage(new TextEncoder().encode('<svg/>')), { code: 'UNSUPPORTED_IMAGE_TYPE' });
});

test('Web intake preserves exact original bytes/hash; cancelled or failed decode writes nothing', async () => {
  const tickets = [];
  let selected = null, closes = 0;
  const intake = createWebImageIntake({
    store: { putTicket: async record => tickets.push(record) }, crypto: webcrypto,
    select: async () => selected,
    decode: async () => ({ width: 1, height: 1, close: () => closes++ }),
    canvas: () => ({ getContext: () => ({ fillRect() {}, drawImage() {} }), toDataURL: () => 'data:image/jpeg;base64,AA==' }),
  });
  assert.equal((await intake.pick()).cancelled, true);
  assert.equal(tickets.length, 0);
  selected = new Blob([pngBytes], { type: 'image/png' });
  const picked = await intake.pick();
  assert.equal(picked.ticket.localOnly, true);
  assert.equal(closes, 1);
  assert.deepEqual(new Uint8Array(await tickets[0].blob.arrayBuffer()), pngBytes);
  assert.equal(tickets[0].hash, createHash('sha256').update(pngBytes).digest('hex'));
  const broken = createWebImageIntake({ select: async () => selected, store: { putTicket: () => assert.fail('must not write') }, decode: async () => { throw new Error('decode'); } });
  await assert.rejects(broken.pick(), { code: 'IMAGE_DECODE_FAILED' });
});

test('Web promotion refuses mismatched operations and arbitrary local paths', async () => {
  const intake = createWebImageIntake({ store: { promote: async () => ({ ticketId: 't1', operationId: 'op1' }), get: () => assert.fail('invalid path read') } });
  await assert.rejects(intake.promoteTicket({ ticketId: 't1', assetId: 'a1', operationId: 'op2' }), { code: 'INVALID_MEDIA_PROMOTION' });
  await assert.rejects(intake.promoteTicket({ ticketId: '../t', assetId: 'a1', operationId: 'op1' }), { code: 'INVALID_MEDIA_PROMOTION' });
  assert.equal(await intake.getOriginal('https://other/image'), null);
});

function stagingHarness(overrides={}) {
  const writes=[],removed=[];
  const intake=createWebImageIntake({
    store:{putTicket:async record=>writes.push(record),remove:async(...args)=>removed.push(args)},
    crypto:webcrypto,
    decode:async()=>({width:1,height:1,close(){}}),
    canvas:()=>({getContext:()=>({fillRect(){},drawImage(){}}),toDataURL:()=>'data:image/jpeg;base64,AA=='}),
    ...overrides,
  });
  return {intake,writes,removed};
}

test('picker and direct file intake share byte inspection, original staging and cancellation contract',async()=>{
  let selected=null;
  const {intake,writes}=stagingHarness({select:async()=>selected});
  assert.deepEqual(await intake.ingestFile(null),{ticket:null,cancelled:true});
  assert.deepEqual(await intake.pick(),{ticket:null,cancelled:true});
  for(const [bytes,mime] of [[pngBytes,'image/png'],[jpegBytes,'image/jpeg'],[webpBytes,'image/webp']]){
    selected=new File([bytes],'clipboard-image',{type:mime});
    const direct=await intake.ingestFile(selected),picked=await intake.pick();
    assert.notEqual(direct.ticket.ticketId,picked.ticket.ticketId);
    for(const result of [direct,picked]){
      assert.equal(result.cancelled,false);assert.equal(result.ticket.mimeType,mime);assert.equal(result.ticket.localOnly,true);
    }
    for(const row of writes.slice(-2)){
      assert.deepEqual(new Uint8Array(await row.blob.arrayBuffer()),bytes);
      assert.equal(row.hash,createHash('sha256').update(bytes).digest('hex'));
      assert.equal(row.previewDataUrl,'data:image/jpeg;base64,AA==');
    }
  }
  assert.equal(writes.length,6);
});

test('direct intake bounds declared bytes before reading and actual bytes before decode',async()=>{
  const {intake,writes,removed}=stagingHarness({decode:()=>assert.fail('must not decode')});
  for(const size of [0,20_000_001]){
    await assert.rejects(intake.ingestFile({size,arrayBuffer:()=>assert.fail('must not read')}),{code:'IMAGE_TOO_LARGE'});
  }
  await assert.rejects(intake.ingestFile({size:1,type:'image/png',arrayBuffer:async()=>new ArrayBuffer(20_000_001)}),{code:'IMAGE_TOO_LARGE'});
  await assert.rejects(intake.ingestFile({size:1,type:'image/png'}),{code:'UNSUPPORTED_IMAGE_TYPE'});
  assert.equal(writes.length,0);assert.equal(removed.length,0);
});

test('direct intake rejects unsupported, spoofed, animated and truncated files without replacing old tickets',async()=>{
  const {intake,writes,removed}=stagingHarness({decode:()=>assert.fail('must not decode')});
  const animated=new Uint8Array(webpVp8xBytes);animated[20]|=2;
  for(const [bytes,mime,code] of [
    [new TextEncoder().encode('<svg/>'),'image/svg+xml','UNSUPPORTED_IMAGE_TYPE'],
    [new TextEncoder().encode('GIF89a'),'image/gif','UNSUPPORTED_IMAGE_TYPE'],
    [pngBytes,'image/jpeg','UNSUPPORTED_IMAGE_TYPE'],
    [animated,'image/webp','UNSUPPORTED_IMAGE_TYPE'],
    [pngBytes.slice(0,24),'image/png','IMAGE_DECODE_FAILED'],
  ])await assert.rejects(intake.ingestFile(new File([bytes],'untouched-name',{type:mime})),{code});
  assert.equal(writes.length,0);assert.equal(removed.length,0);
});

test('direct intake releases decoded bitmap on pixel or preview failure without a staged write',async()=>{
  let closed=0;
  const selected=new Blob([pngBytes],{type:'image/png'});
  const huge=stagingHarness({decode:async()=>({width:24_000_001,height:1,close(){closed++;}})});
  await assert.rejects(huge.intake.ingestFile(selected),{code:'IMAGE_TOO_COMPLEX'});
  const preview=stagingHarness({decode:async()=>({width:1,height:1,close(){closed++;}}),
    canvas:()=>({getContext:()=>({fillRect(){},drawImage(){}}),toDataURL:()=>''})});
  await assert.rejects(preview.intake.ingestFile(selected),{code:'PREVIEW_UNAVAILABLE'});
  assert.equal(closed,2);assert.equal(huge.writes.length+preview.writes.length,0);
});

test('direct intake accepts absent declared MIME by inspecting bytes, and propagates failed staging without deletion',async()=>{
  const selected=new File([pngBytes],'capture-without-extension');
  const {intake,writes}=stagingHarness();
  assert.equal((await intake.ingestFile(selected)).ticket.mimeType,'image/png');
  assert.equal(writes[0].blob.type,'image/png');
  const failure=Object.assign(new Error('full'),{code:'MEDIA_STORAGE_FULL'});
  const broken=stagingHarness({store:{putTicket:async()=>{throw failure;},remove:()=>assert.fail('existing media must not be deleted')}});
  await assert.rejects(broken.intake.ingestFile(selected),error=>error===failure);
});
