import { createPrivateImageJournal } from '../indexeddb/privateImageJournal.js';
const fail = (code) => { throw Object.assign(new Error(code), { code }); };
const MAX_SOURCE = 20_000_000, MAX_PIXELS = 24_000_000;
const safeId = value => /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(value || '');
const refId = ref => /^asset:([A-Za-z0-9][A-Za-z0-9_-]{0,127})$/.exec(ref || '')?.[1];

// Local intake safety limits, not a cloud quota or an approved service policy.
export function inspectWebImage(bytes, declaredMime) {
  if (!bytes.length || bytes.length > MAX_SOURCE) fail('IMAGE_TOO_LARGE');
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const text = (start, n) => String.fromCharCode(...bytes.subarray(start, start + n));
  let mime, width, height;
  if (bytes.length >= 24 && bytes[0] === 137 && text(1, 3) === 'PNG' && v.getUint32(4) === 0x0d0a1a0a) {
    mime = 'image/png';
    if (text(12, 4) !== 'IHDR' || v.getUint32(8) !== 13) fail('UNSUPPORTED_IMAGE_TYPE');
    width = v.getUint32(16); height = v.getUint32(20);
    let ended = false;
    for (let at = 8; at + 12 <= bytes.length;) {
      const size = v.getUint32(at);
      if (at + 12 + size > bytes.length) fail('IMAGE_DECODE_FAILED');
      if (text(at + 4, 4) === 'acTL') fail('UNSUPPORTED_IMAGE_TYPE');
      if (text(at + 4, 4) === 'IEND') { ended = size === 0 && at + 12 === bytes.length; break; }
      at += size + 12;
    }
    if (!ended) fail('IMAGE_DECODE_FAILED');
  } else if (bytes.length >= 4 && bytes[0] === 255 && bytes[1] === 216) {
    mime = 'image/jpeg';
    for (let at = 2; at + 3 < bytes.length;) {
      if (bytes[at++] !== 255) fail('IMAGE_DECODE_FAILED');
      while (bytes[at] === 255) at++;
      const marker = bytes[at++];
      if (marker === 0xda || marker === 0xd9) break;
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
      if (at + 2 > bytes.length) fail('IMAGE_DECODE_FAILED');
      const size = v.getUint16(at);
      if (size < 2 || at + size > bytes.length) fail('IMAGE_DECODE_FAILED');
      if ([0xc0, 0xc1, 0xc2].includes(marker)) {
        if (size < 8) fail('IMAGE_DECODE_FAILED');
        height = v.getUint16(at + 3); width = v.getUint16(at + 5); break;
      }
      at += size;
    }
  } else if (bytes.length >= 30 && text(0, 4) === 'RIFF' && text(8, 4) === 'WEBP') {
    mime = 'image/webp';
    if (v.getUint32(4, true) + 8 !== bytes.length) fail('IMAGE_DECODE_FAILED');
    const type = text(12, 4);
    if (type === 'VP8X') {
      if (bytes[20] & 2) fail('UNSUPPORTED_IMAGE_TYPE');
      width = 1 + bytes[24] + (bytes[25] << 8) + (bytes[26] << 16);
      height = 1 + bytes[27] + (bytes[28] << 8) + (bytes[29] << 16);
    } else if (type === 'VP8L' && bytes[20] === 0x2f) {
      width = 1 + bytes[21] + ((bytes[22] & 63) << 8);
      height = 1 + (bytes[22] >> 6) + (bytes[23] << 2) + ((bytes[24] & 15) << 10);
    } else if (type === 'VP8 ' && bytes[23] === 0x9d && bytes[24] === 1 && bytes[25] === 0x2a) {
      width = v.getUint16(26, true) & 0x3fff; height = v.getUint16(28, true) & 0x3fff;
    }
  }
  if (!mime || (declaredMime && declaredMime !== mime)) fail('UNSUPPORTED_IMAGE_TYPE');
  if (!width || !height) fail('IMAGE_DECODE_FAILED');
  if (width * height > MAX_PIXELS) fail('IMAGE_TOO_COMPLEX');
  return { mimeType: mime, width, height };
}

export function createWebMediaStore(indexedDB = globalThis.indexedDB) {
  let pending;
  const open = () => pending ||= new Promise((resolve, reject) => {
    const request = indexedDB.open('moemoa-web-media-v1', 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('tickets', { keyPath: 'id' });
      request.result.createObjectStore('assets', { keyPath: 'id' });
    };
    request.onsuccess = () => { request.result.onversionchange = () => { request.result.close(); pending = null; }; resolve(request.result); };
    request.onerror = () => { pending = null; reject(request.error); };
  });
  const run = async (stores, mode, action) => {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(stores, mode); let result;
      tx.oncomplete = () => resolve(result);
      tx.onerror = tx.onabort = () => reject(Object.assign(new Error('MEDIA_STORAGE_FAILED'), {
        code: tx.error?.name === 'QuotaExceededError' ? 'MEDIA_STORAGE_FULL' : 'MEDIA_PROMOTION_FAILED',
      }));
      action(tx, value => { result = value; });
    });
  };
  return {
    putTicket: record => run(['tickets'], 'readwrite', tx => tx.objectStore('tickets').put(record)),
    get: id => run(['assets'], 'readonly', (tx, done) => { tx.objectStore('assets').get(id).onsuccess = e => done(e.target.result); }),
    remove: (store, id) => run([store], 'readwrite', tx => tx.objectStore(store).delete(id)),
    promote: (ticketId, assetId, operationId) => run(['assets', 'tickets'], 'readwrite', (tx, done) => {
      const assets = tx.objectStore('assets');
      assets.get(assetId).onsuccess = e => {
        if (e.target.result) { done(e.target.result); return; }
        tx.objectStore('tickets').get(ticketId).onsuccess = e => {
          if (!e.target.result) { done(null); return; }
          const record = { ...e.target.result, id: assetId, ticketId, operationId };
          assets.put(record); tx.objectStore('tickets').delete(ticketId); done(record);
        };
      };
    }),
  };
}

function selectFile(document) {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input'); input.type = 'file'; input.accept = 'image/jpeg,image/png,image/webp';
    input.hidden = true; document.body.append(input);
    const finish = file => { input.remove(); resolve(file || null); };
    input.onchange = () => finish(input.files?.[0]); input.oncancel = () => finish(null);
    try { input.click(); } catch (error) { input.remove(); reject(error); }
  });
}

export function createWebImageIntake({ store = createWebMediaStore(), select = () => selectFile(document),
  decode = blob => createImageBitmap(blob), canvas = () => document.createElement('canvas'), crypto = globalThis.crypto } = {}) {
  const result = record => ({ localRef: `asset:${record.id}`, checksumSha256: record.hash,
    mimeType: record.mimeType, byteSize: record.blob.size, width: record.width, height: record.height });
  return {
    available: true,
    claim: async () => ({ ticket: null, processing: false, errorCode: null }),
    async pick() {
      const file = await select(); if (!file) return { ticket: null, cancelled: true };
      if (!file.size || file.size > MAX_SOURCE) fail('IMAGE_TOO_LARGE');
      const bytes = new Uint8Array(await file.arrayBuffer());
      const info = inspectWebImage(bytes, file.type);
      let bitmap;
      try { bitmap = await decode(new Blob([bytes], { type: info.mimeType })); } catch { fail('IMAGE_DECODE_FAILED'); }
      let previewDataUrl;
      try {
        if (!bitmap.width || !bitmap.height || bitmap.width * bitmap.height > MAX_PIXELS) fail('IMAGE_TOO_COMPLEX');
        info.width = bitmap.width; info.height = bitmap.height;
        const c = canvas(), scale = Math.min(1, 640 / Math.max(bitmap.width, bitmap.height));
        c.width = Math.max(1, Math.round(bitmap.width * scale)); c.height = Math.max(1, Math.round(bitmap.height * scale));
        const ctx = c.getContext('2d'); if (!ctx) fail('IMAGE_DECODE_FAILED');
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(bitmap, 0, 0, c.width, c.height);
        previewDataUrl = c.toDataURL('image/jpeg', 0.8);
        if (!previewDataUrl.startsWith('data:image/jpeg;base64,')) fail('PREVIEW_UNAVAILABLE');
      } finally { bitmap.close(); }
      const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(x => x.toString(16).padStart(2, '0')).join('');
      const id = crypto.randomUUID();
      await store.putTicket({ id, blob: new Blob([bytes], { type: info.mimeType }), ...info, hash, previewDataUrl });
      return { ticket: { ticketId: id, ...info, byteSize: bytes.length, previewDataUrl, localOnly: true, createdAtEpochMs: Date.now() }, cancelled: false };
    },
    async discard(id) { if (!safeId(id)) return false; await store.remove('tickets', id); return true; },
    async promoteTicket({ ticketId, assetId, operationId }) {
      if (![ticketId, assetId, operationId].every(safeId)) fail('INVALID_MEDIA_PROMOTION');
      const record = await store.promote(ticketId, assetId, operationId);
      if (!record) fail('MEDIA_PROMOTION_FAILED');
      if (record.operationId !== operationId || record.ticketId !== ticketId) fail('INVALID_MEDIA_PROMOTION');
      return result(record);
    },
    async getPreview(ref) { const id = refId(ref); return id ? (await store.get(id))?.previewDataUrl || null : null; },
    async getOriginal(ref) { const id = refId(ref); return id ? (await store.get(id))?.blob || null : null; },
    async deleteAsset(value) { const id = refId(typeof value === 'string' ? value : value?.localRef); if (!id) return false; await createPrivateImageJournal().removeAsset(id); await store.remove('assets', id); return true; },
  };
}
