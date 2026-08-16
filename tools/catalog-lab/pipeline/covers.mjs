import { createHash } from 'node:crypto';
import { link, lstat, mkdir, open, readFile, rm, stat } from 'node:fs/promises';

import { toPathKey } from '../lib/path-key.mjs';
import { assertCatalogWorkspaceMutation } from '../lib/workspace.mjs';

export const COVER_MIME = Object.freeze({
  JPEG: 'image/jpeg',
  PNG: 'image/png',
  WEBP: 'image/webp',
});

const MIME_DETAILS = Object.freeze({
  [COVER_MIME.JPEG]: Object.freeze({ extension: 'jpg' }),
  [COVER_MIME.PNG]: Object.freeze({ extension: 'png' }),
  [COVER_MIME.WEBP]: Object.freeze({ extension: 'webp' }),
});
const PNG_SIGNATURE = Object.freeze([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const MAX_COVER_BYTES = 8 * 1024 * 1024;
const MAX_COVER_AXIS = 4096;
const MAX_COVER_PIXELS = 12_000_000;
const ANIME_ID = /^anime:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const SOF_MARKERS = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
const COVER_RECORDS = new WeakSet();
const COVER_BYTES = new WeakMap();
const COVER_POLICIES = new WeakSet();
const COVER_TRANSPORTS = new WeakSet();
const POLICIES = Object.freeze({
  anilist: Object.freeze({ sourceId: 'anilist', origins: Object.freeze(['https://s4.anilist.co']) }),
  anilife_public: Object.freeze({ sourceId: 'anilife_public', origins: Object.freeze([]) }),
  wikidata: Object.freeze({ sourceId: 'wikidata', origins: Object.freeze([]) }),
});
Object.values(POLICIES).forEach((policy) => COVER_POLICIES.add(policy));

function typedError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function asBytes(value) {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  throw typedError('IMAGE_BYTES_INVALID', 'Image bytes must be a Uint8Array or ArrayBuffer');
}

function equalsAt(bytes, offset, expected) {
  return offset >= 0 && offset + expected.length <= bytes.length
    && expected.every((value, index) => bytes[offset + index] === value);
}

function ascii(bytes, offset, length) {
  if (offset < 0 || offset + length > bytes.length) return null;
  return String.fromCharCode(...bytes.subarray(offset, offset + length));
}

function u16be(bytes, offset) {
  return (bytes[offset] << 8) | bytes[offset + 1];
}

function u16le(bytes, offset) {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function u24le(bytes, offset) {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
}

function u32be(bytes, offset) {
  return (bytes[offset] * 0x1000000) + ((bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]);
}

function u32le(bytes, offset) {
  return bytes[offset] + (bytes[offset + 1] * 0x100) + (bytes[offset + 2] * 0x10000) + (bytes[offset + 3] * 0x1000000);
}

function imageTooShort() {
  return typedError('IMAGE_TRUNCATED', 'Image bytes end before a complete supported image structure');
}

function validateDimensions(width, height) {
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1 || width > MAX_COVER_AXIS || height > MAX_COVER_AXIS
    || !Number.isSafeInteger(width * height) || width * height > MAX_COVER_PIXELS) {
    throw typedError('IMAGE_DIMENSIONS_INVALID', 'Image dimensions exceed safe cover limits');
  }
  return { width, height };
}

function inspectPng(bytes) {
  if (bytes.length < 33) throw imageTooShort();
  if (u32be(bytes, 8) !== 13 || ascii(bytes, 12, 4) !== 'IHDR') {
    throw typedError('IMAGE_STRUCTURE_INVALID', 'PNG must begin with one complete IHDR chunk');
  }
  const dimensions = validateDimensions(u32be(bytes, 16), u32be(bytes, 20));
  let offset = 8;
  let sawIend = false;
  while (offset < bytes.length) {
    if (offset + 12 > bytes.length) throw imageTooShort();
    const length = u32be(bytes, offset);
    const end = offset + 12 + length;
    if (!Number.isSafeInteger(end) || end > bytes.length) throw imageTooShort();
    const type = ascii(bytes, offset + 4, 4);
    if (type === 'IEND') {
      if (length !== 0 || end !== bytes.length) throw typedError('IMAGE_STRUCTURE_INVALID', 'PNG IEND must terminate the image');
      sawIend = true;
      break;
    }
    offset = end;
  }
  if (!sawIend) throw imageTooShort();
  return dimensions;
}

function inspectJpeg(bytes) {
  if (bytes.length < 4) throw imageTooShort();
  let offset = 2;
  let dimensions = null;
  let sawScan = false;
  while (offset < bytes.length) {
    while (offset < bytes.length && bytes[offset] === 0xff) offset += 1;
    if (offset >= bytes.length) throw imageTooShort();
    const marker = bytes[offset];
    offset += 1;
    if (marker === 0xd9) break;
    if (marker === 0x00 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) continue;
    if (offset + 2 > bytes.length) throw imageTooShort();
    const length = u16be(bytes, offset);
    if (length < 2 || offset + length > bytes.length) throw imageTooShort();
    if (SOF_MARKERS.has(marker)) {
      if (length < 8) throw typedError('IMAGE_STRUCTURE_INVALID', 'JPEG SOF segment is invalid');
      dimensions = validateDimensions(u16be(bytes, offset + 3), u16be(bytes, offset + 5));
    }
    if (marker === 0xda) {
      sawScan = true;
      break;
    }
    offset += length;
  }
  if (!dimensions || !sawScan || !bytes.subarray(offset).includes(0xd9)) throw imageTooShort();
  return dimensions;
}

function inspectWebp(bytes) {
  if (bytes.length < 30) throw imageTooShort();
  if (u32le(bytes, 4) !== bytes.length - 8) throw typedError('IMAGE_STRUCTURE_INVALID', 'WebP RIFF length is invalid');
  let offset = 12;
  let canvas = null;
  let frame = null;
  while (offset < bytes.length) {
    if (offset + 8 > bytes.length) throw imageTooShort();
    const chunkType = ascii(bytes, offset, 4);
    const chunkLength = u32le(bytes, offset + 4);
    const dataOffset = offset + 8;
    const end = dataOffset + chunkLength;
    const next = end + (chunkLength % 2);
    if (!Number.isSafeInteger(next) || next > bytes.length) throw imageTooShort();
    if (chunkType === 'VP8 ') {
      if (chunkLength < 10 || !equalsAt(bytes, dataOffset + 3, [0x9d, 0x01, 0x2a])) {
        throw typedError('IMAGE_STRUCTURE_INVALID', 'WebP VP8 header is invalid');
      }
      frame = validateDimensions(u16le(bytes, dataOffset + 6) & 0x3fff, u16le(bytes, dataOffset + 8) & 0x3fff);
    } else if (chunkType === 'VP8L') {
      if (chunkLength < 5 || bytes[dataOffset] !== 0x2f) throw typedError('IMAGE_STRUCTURE_INVALID', 'WebP VP8L header is invalid');
      const bits = u32le(bytes, dataOffset + 1);
      frame = validateDimensions(1 + (bits & 0x3fff), 1 + ((bits >>> 14) & 0x3fff));
    } else if (chunkType === 'VP8X') {
      if (canvas || chunkLength < 10) throw typedError('IMAGE_STRUCTURE_INVALID', 'WebP VP8X header is invalid');
      canvas = validateDimensions(1 + u24le(bytes, dataOffset + 4), 1 + u24le(bytes, dataOffset + 7));
    }
    offset = next;
  }
  if (!frame) {
    if (canvas) return canvas;
    throw typedError('IMAGE_STRUCTURE_INVALID', 'WebP must use a supported VP8, VP8L, or VP8X chunk');
  }
  if (canvas && (canvas.width !== frame.width || canvas.height !== frame.height)) {
    throw typedError('IMAGE_STRUCTURE_INVALID', 'WebP canvas and frame dimensions disagree');
  }
  return canvas ?? frame;
}

function signatureMime(bytes) {
  if (equalsAt(bytes, 0, [0xff, 0xd8])) return COVER_MIME.JPEG;
  if (equalsAt(bytes, 0, PNG_SIGNATURE)) return COVER_MIME.PNG;
  if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WEBP') return COVER_MIME.WEBP;
  return null;
}

function normalizedMime(value) {
  if (typeof value !== 'string') return null;
  const mime = value.split(';', 1)[0].trim().toLowerCase();
  return MIME_DETAILS[mime] ? mime : null;
}

export function getApprovedCoverSourcePolicy(sourceId) {
  const policy = POLICIES[sourceId];
  if (!policy) throw typedError('COVER_SOURCE_POLICY_INVALID', 'Cover source has no approved cover-origin policy');
  return policy;
}

function ipv4Global(address) {
  const values = address.split('.').map(Number);
  if (values.length !== 4 || values.some((value) => !Number.isInteger(value) || value < 0 || value > 255)) return false;
  const [a, b] = values;
  return !(a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127)
    || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && (b === 0 || b === 168)) || (a === 198 && (b === 18 || b === 19)));
}

function globalAddress(address) {
  if (typeof address !== 'string') return false;
  const value = address.toLowerCase();
  if (/^\d+\.\d+\.\d+\.\d+$/u.test(value)) return ipv4Global(value);
  const mapped = value.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/u);
  if (mapped) return ipv4Global(mapped[1]);
  if (!value.includes(':')) return false;
  return !(value === '::' || value === '::1' || value.startsWith('fc') || value.startsWith('fd')
    || value.startsWith('fe8') || value.startsWith('fe9') || value.startsWith('fea') || value.startsWith('feb'));
}

/** Creates the only accepted cover transport: resolution is supplied once and the chosen address is pinned into the request. */
export function createPinnedCoverTransport({ resolve, request }) {
  if (typeof resolve !== 'function' || typeof request !== 'function') throw typedError('IMAGE_TRANSPORT_INVALID', 'Pinned cover transport requires resolver and request functions');
  const transport = Object.freeze({ resolve, request });
  COVER_TRANSPORTS.add(transport);
  return transport;
}

/** Inspects only JPEG, PNG, and WebP container structure; decoding is a separate Chromium gate. */
export function inspectImageBytes({ declaredMime, bytes }) {
  const image = asBytes(bytes);
  const declared = declaredMime === undefined ? null : normalizedMime(declaredMime);
  if (declaredMime !== undefined && !declared) {
    throw typedError('IMAGE_MIME_UNSUPPORTED', 'Cover MIME type must be JPEG, PNG, or WebP');
  }
  const mimeType = signatureMime(image);
  if (!mimeType) throw typedError('IMAGE_SIGNATURE_UNSUPPORTED', 'Cover signature is not JPEG, PNG, or WebP');
  if (declared && declared !== mimeType) {
    throw typedError('IMAGE_MIME_SIGNATURE_MISMATCH', 'Cover MIME type does not match its image signature');
  }
  const dimensions = mimeType === COVER_MIME.PNG ? inspectPng(image)
    : mimeType === COVER_MIME.JPEG ? inspectJpeg(image) : inspectWebp(image);
  return Object.freeze({ mimeType, extension: MIME_DETAILS[mimeType].extension, ...dimensions, byteSize: image.byteLength });
}

function exactHttpUrl(value) {
  if (typeof value !== 'string') throw typedError('IMAGE_URL_INVALID', 'Cover URL must be an exact http(s) URL');
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw typedError('IMAGE_URL_INVALID', 'Cover URL must be an exact http(s) URL');
  }
  if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname || parsed.username || parsed.password
    || parsed.hash || parsed.href !== value) {
    throw typedError('IMAGE_URL_INVALID', 'Cover URL must be an exact http(s) URL');
  }
  return parsed.href;
}

function boundedContentLength(response, maxBytes) {
  const raw = response?.headers?.get?.('content-length');
  if (raw === null || raw === undefined) return;
  if (!/^\d+$/u.test(raw.trim())) throw typedError('IMAGE_CONTENT_LENGTH_INVALID', 'Cover Content-Length must be a safe integer');
  const length = Number(raw);
  if (!Number.isSafeInteger(length)) throw typedError('IMAGE_CONTENT_LENGTH_INVALID', 'Cover Content-Length must be a safe integer');
  if (length > maxBytes) throw typedError('IMAGE_RESPONSE_TOO_LARGE', 'Cover response exceeds the byte limit');
}

async function readBoundedBody(response, maxBytes) {
  if (!response?.body?.getReader) throw typedError('IMAGE_RESPONSE_BODY_MISSING', 'Cover response has no readable body');
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  let completed = false;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = asBytes(value);
      size += chunk.byteLength;
      if (!Number.isSafeInteger(size) || size > maxBytes) {
        await reader.cancel();
        throw typedError('IMAGE_RESPONSE_TOO_LARGE', 'Cover response exceeds the byte limit');
      }
      chunks.push(chunk);
    }
    completed = true;
  } finally {
    if (!completed) await reader.cancel().catch(() => {});
    reader.releaseLock?.();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

function candidateMetadata(candidate, policy) {
  if (!candidate || typeof candidate !== 'object' || !['anilist', 'anilife_public', 'wikidata'].includes(candidate.sourceId)
    || typeof candidate.sourceRecordId !== 'string' || !/^[a-f0-9]{64}$/u.test(candidate.sourceRecordId)
    || typeof candidate.retrievedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(candidate.retrievedAt)) {
    throw typedError('COVER_CANDIDATE_INVALID', 'Cover candidate lacks immutable source provenance');
  }
  const identity = candidate.identity;
  if (!identity || identity.status !== 'MATCHED'
    || !['EXACT_ID', 'EXACT_RULE'].includes(identity.confidenceClass)) {
    throw typedError('COVER_IDENTITY_NOT_EXACT', 'Only exact identity matches may download covers');
  }
  const sourceUrl = exactHttpUrl(candidate.sourceUrl);
  if (!COVER_POLICIES.has(policy) || policy.sourceId !== candidate.sourceId || !policy.origins.includes(new URL(sourceUrl).origin)) {
    throw typedError('COVER_ORIGIN_FORBIDDEN', 'Cover URL is not an approved HTTPS source origin');
  }
  if (!sourceUrl.startsWith('https://')) throw typedError('COVER_ORIGIN_FORBIDDEN', 'Cover downloads require HTTPS');
  return Object.freeze({ identity: Object.freeze({ ...candidate.identity }), sourceId: candidate.sourceId, sourceUrl, sourceRecordId: candidate.sourceRecordId, retrievedAt: candidate.retrievedAt });
}

/** Downloads one already exact-matched candidate with redirect and byte limits enforced before storage. */
export async function downloadCoverCandidate({ candidate, policy, transport, maxBytes = MAX_COVER_BYTES }) {
  if (!COVER_TRANSPORTS.has(transport) || !Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > MAX_COVER_BYTES) throw typedError('IMAGE_DOWNLOAD_INPUT_INVALID', 'Cover download requires a pinned bounded transport');
  const metadata = candidateMetadata(candidate, policy);
  const hostname = new URL(metadata.sourceUrl).hostname;
  const addresses = await transport.resolve(hostname);
  if (!Array.isArray(addresses) || addresses.length === 0 || addresses.some((entry) => !globalAddress(entry?.address))) throw typedError('IMAGE_ADDRESS_FORBIDDEN', 'Cover hostname resolves to a non-global address');
  const address = addresses[0].address;
  let response;
  let consumed = false;
  try {
    response = await transport.request({ url: metadata.sourceUrl, address, hostname, kind: 'IMAGE', init: { redirect: 'error' } });
    if (!response || response.redirected || response.url !== metadata.sourceUrl || response.connectedAddress !== address) throw typedError('IMAGE_REDIRECT_FORBIDDEN', 'Cover redirect or final destination is forbidden');
    boundedContentLength(response, maxBytes);
    const declaredMime = response.headers?.get?.('content-type');
    const bytes = await readBoundedBody(response, maxBytes);
    consumed = true;
    const inspection = inspectImageBytes({ declaredMime, bytes });
    const record = Object.freeze({ ...metadata, ...inspection, checksum: checksum(bytes), localRef: null, validationStatus: 'SNIFFED', rightsStatus: 'TEST_ONLY_UNKNOWN', distributionStatus: 'PROHIBITED' });
    COVER_RECORDS.add(record);
    COVER_BYTES.set(record, bytes);
    return record;
  } finally {
    if (!consumed) await response?.body?.cancel?.().catch(() => {});
  }
}

function checksum(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

/** Stores a validated image under a safe internal id and never overwrites an existing checksum path. */
export async function storeValidatedCover({ record, workspace, animeId }) {
  if (!COVER_RECORDS.has(record) || record.validationStatus !== 'DECODED' || !COVER_BYTES.has(record)) throw typedError('COVER_RECORD_UNTRUSTED', 'Only decoded authenticated CoverRecords may be stored');
  if (typeof animeId !== 'string' || !ANIME_ID.test(animeId)) {
    throw typedError('COVER_ANIME_ID_INVALID', 'Cover anime ID is not safe for external storage');
  }
  const image = COVER_BYTES.get(record);
  const digest = record.checksum;
  const directoryParts = ['images', 'covers', toPathKey(animeId)];
  const filename = `${digest}.${record.extension}`;
  await assertCatalogWorkspaceMutation(workspace, directoryParts);
  const directory = workspace.resolve(...directoryParts);
  await mkdir(directory, { recursive: true });
  await assertCatalogWorkspaceMutation(workspace, directoryParts);
  const destination = workspace.resolve(...directoryParts, filename);
  const temporary = workspace.resolve(...directoryParts, `.${digest}.${process.pid}.${Date.now()}.tmp`);
  let created = false;
  try {
    const handle = await open(temporary, 'wx');
    try {
      await handle.writeFile(image);
      await handle.sync();
      created = true;
    } finally {
      await handle.close();
    }
    try { await link(temporary, destination); } catch (error) {
      if (error?.code !== 'EEXIST') throw error;
      created = false;
    }
  } catch (error) {
    throw error;
  } finally {
    await rm(temporary, { force: true }).catch(() => {});
  }
  const existingInfo = await lstat(destination);
  if (!existingInfo.isFile() || existingInfo.isSymbolicLink() || existingInfo.size > MAX_COVER_BYTES) throw typedError('COVER_STORE_COLLISION', 'Existing cover path is not a bounded regular file');
  const existing = await readFile(destination);
  if (checksum(existing) !== digest) throw typedError('COVER_STORE_COLLISION', 'Existing cover path has different immutable bytes');
  const localRef = [...directoryParts, filename].join('/');
  const stored = Object.freeze({ ...record, localRef, created });
  COVER_RECORDS.add(stored);
  COVER_BYTES.set(stored, image);
  return stored;
}

/** Runs browser-native image decoding after structural validation without introducing an image package. */
export async function decodeCoverWithChromium({ record, browser, timeoutMs = 5_000 } = {}) {
  if (!COVER_RECORDS.has(record) || record.validationStatus !== 'SNIFFED' || !COVER_BYTES.has(record)
    || !Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 10_000) throw typedError('IMAGE_DECODE_INPUT_INVALID', 'Chromium decode requires an authenticated sniffed CoverRecord');
  const image = COVER_BYTES.get(record);
  let ownedBrowser = false;
  let activeBrowser = browser;
  if (!activeBrowser) {
    const { chromium } = await import('@playwright/test');
    activeBrowser = await chromium.launch();
    ownedBrowser = true;
  }
  try {
    const page = await activeBrowser.newPage();
    let timer;
    try {
      const evaluation = page.evaluate(async ({ base64, mimeType }) => {
        const binary = atob(base64);
        const pixels = Uint8Array.from(binary, (character) => character.charCodeAt(0));
        try {
          const bitmap = await createImageBitmap(new Blob([pixels], { type: mimeType }));
          const dimensions = { width: bitmap.width, height: bitmap.height };
          bitmap.close();
          return { ok: true, dimensions };
        } catch (error) {
          return { ok: false, message: String(error?.message ?? error) };
        }
      }, { base64: Buffer.from(image).toString('base64'), mimeType: record.mimeType });
      const timeout = new Promise((_, reject) => { timer = setTimeout(() => { page.close().catch(() => {}); reject(typedError('IMAGE_DECODE_TIMEOUT', 'Chromium cover decode exceeded its deadline')); }, timeoutMs); });
      const result = await Promise.race([evaluation, timeout]);
      if (!result.ok || result.dimensions.width !== record.width || result.dimensions.height !== record.height) {
        throw typedError('IMAGE_DECODE_FAILED', 'Chromium could not decode the structurally valid cover');
      }
      const decoded = Object.freeze({ ...record, validationStatus: 'DECODED' });
      COVER_RECORDS.add(decoded);
      COVER_BYTES.set(decoded, image);
      return decoded;
    } finally {
      clearTimeout(timer);
      await page.close().catch(() => {});
    }
  } finally {
    if (ownedBrowser) await activeBrowser.close();
  }
}

function exactIdentityRank(row) {
  const confidence = row?.identity?.confidenceClass ?? row?.confidenceClass;
  const status = row?.identity?.status ?? row?.identityStatus;
  return status === 'MATCHED' && confidence === 'EXACT_ID' ? 0
    : status === 'MATCHED' && confidence === 'EXACT_RULE' ? 1 : 2;
}

function compareCover(left, right) {
  const identity = exactIdentityRank(left) - exactIdentityRank(right);
  if (identity) return identity;
  const decoded = Number(right.validationStatus === 'DECODED') - Number(left.validationStatus === 'DECODED');
  if (decoded) return decoded;
  const leftArea = Number.isSafeInteger(left.width) && Number.isSafeInteger(left.height) ? left.width * left.height : -1;
  const rightArea = Number.isSafeInteger(right.width) && Number.isSafeInteger(right.height) ? right.width * right.height : -1;
  if (leftArea !== rightArea) return rightArea - leftArea;
  return String(left.sourceId).localeCompare(String(right.sourceId))
    || String(left.sourceRecordId ?? '').localeCompare(String(right.sourceRecordId ?? ''))
    || String(left.sourceUrl ?? '').localeCompare(String(right.sourceUrl ?? ''));
}

/** Selects a single test-only canonical cover without changing any text catalog record. */
export function selectCanonicalCover(candidates) {
  if (!Array.isArray(candidates)) throw typedError('COVER_SELECTION_INPUT_INVALID', 'Cover candidates must be an array');
  const eligible = candidates.filter((row) => COVER_RECORDS.has(row) && exactIdentityRank(row) < 2
    && row.validationStatus === 'DECODED' && typeof row.localRef === 'string'
    && Number.isSafeInteger(row.width) && Number.isSafeInteger(row.height));
  if (eligible.length === 0) return null;
  return [...eligible].sort(compareCover)[0];
}
