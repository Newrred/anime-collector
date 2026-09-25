import { inspectWebImage } from '../adapters/platform/webImageIntake.js';
const fail = code => { throw Object.assign(new Error(code), { code }); };
export async function blobHash(blob, crypto = globalThis.crypto) {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer()))].map(n => n.toString(16).padStart(2, '0')).join('');
}

export async function optimizePrivateImage(original, policy, { signal, decode = blob => createImageBitmap(blob), canvas = () => document.createElement('canvas') } = {}) {
  const check = () => { if (signal?.aborted) fail('REQUEST_ABORTED'); };
  check();
  if (!(original instanceof Blob) || original.size < 1 || original.size > 20_000_000) fail('IMAGE_TOO_LARGE');
  inspectWebImage(new Uint8Array(await original.arrayBuffer()), original.type);
  check();
  const bitmap = await decode(original);
  try {
    check();
    if (!bitmap.width || !bitmap.height || bitmap.width * bitmap.height > 24_000_000) fail('IMAGE_TOO_COMPLEX');
    const c = canvas(), ratio = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    c.width = Math.max(1, Math.round(bitmap.width * ratio)); c.height = Math.max(1, Math.round(bitmap.height * ratio));
    const ctx = c.getContext('2d'); if (!ctx) fail('IMAGE_DECODE_FAILED');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(bitmap, 0, 0, c.width, c.height);
    let mime = 'image/webp';
    // Bounded attempts including an optional browser format fallback. Never silently go below the quality floor.
    for (const quality of [0.85, 0.75, 0.65]) {
      const blob = await new Promise(resolve => c.toBlob(resolve, mime, quality));
      check();
      if (!blob) fail('IMAGE_DECODE_FAILED');
      if (blob.type !== mime) { mime = 'image/jpeg'; continue; }
      if (blob.size > 0 && blob.size <= Math.min(policy.mainMaxBytes, policy.transportBodyMaxBytes)) return blob;
    }
    fail('IMAGE_SIZE_LIMIT');
  } finally { bitmap.close(); }
}
