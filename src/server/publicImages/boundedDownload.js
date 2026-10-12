import { OUTPUT_LIMIT, PublicImageError } from './processImage.js';

// Only receives a path authorized by the resolver and size bound by the service RPC.
export async function downloadSizedImage({ url, key, path, bytes, signal, fetchImpl = fetch }) {
  if (!/^[a-f0-9-]{36}\/(full|thumb)\.webp$/.test(path) ||
      !Number.isSafeInteger(bytes) || bytes < 1 || bytes > OUTPUT_LIMIT) {
    throw new PublicImageError('IMAGE_STORAGE_FAILED', 503);
  }
  let response, reader;
  try {
    response = await fetchImpl(url.replace(/\/$/, '') + '/storage/v1/object/memory-public-derivatives/' + path, {
      headers: { apikey: key, Authorization: 'Bearer ' + key, Range: 'bytes=0-' + (bytes - 1), 'Accept-Encoding': 'identity' },
      cache: 'no-store', redirect: 'error', signal,
    });
    const length = response.headers.get('content-length');
    const range = response.headers.get('content-range');
    const encoding = response.headers.get('content-encoding');
    // A partial prefix of a larger object is not the approved immutable image.
    if (![200, 206].includes(response.status) || length !== String(bytes) ||
        (encoding && encoding !== 'identity') ||
        (response.status === 206 ? range !== 'bytes 0-' + (bytes - 1) + '/' + bytes : range !== null) ||
        !response.body) throw new Error('invalid storage response');
    reader = response.body.getReader();
    const chunks = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > bytes) throw new Error('oversized storage response');
      chunks.push(Buffer.from(value));
    }
    if (size !== bytes) throw new Error('truncated storage response');
    return Buffer.concat(chunks, size);
  } catch {
    // Never expose storage headers, credentials, paths or provider error bodies.
    throw new PublicImageError('IMAGE_STORAGE_FAILED', 503);
  } finally {
    if (reader) { await reader.cancel().catch(() => {}); reader.releaseLock(); }
    else if (response?.body) await response.body.cancel().catch(() => {});
  }
}
