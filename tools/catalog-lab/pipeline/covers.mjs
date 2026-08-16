import { createHash } from 'node:crypto';
import { mkdir, open, readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { toPathKey } from '../lib/path-key.mjs';

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
const MAX_COVER_PIXELS = 40_000_000;
const ANIME_ID = /^anime:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const SOF_MARKERS = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);

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
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1
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
  } finally {
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

function candidateMetadata(candidate) {
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
  return Object.freeze({ sourceId: candidate.sourceId, sourceUrl, sourceRecordId: candidate.sourceRecordId, retrievedAt: candidate.retrievedAt });
}

/** Downloads one already exact-matched candidate with redirect and byte limits enforced before storage. */
export async function downloadCoverCandidate({ candidate, http, maxBytes = MAX_COVER_BYTES }) {
  if (!http || typeof http.request !== 'function' || !Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > MAX_COVER_BYTES) {
    throw typedError('IMAGE_DOWNLOAD_INPUT_INVALID', 'Cover download requires a bounded HTTP client');
  }
  const metadata = candidateMetadata(candidate);
  const response = await http.request({ url: metadata.sourceUrl, kind: 'IMAGE', init: { redirect: 'error' } });
  if (response?.redirected) throw typedError('IMAGE_REDIRECT_FORBIDDEN', 'Cover redirects are forbidden');
  boundedContentLength(response, maxBytes);
  const declaredMime = response?.headers?.get?.('content-type');
  const bytes = await readBoundedBody(response, maxBytes);
  const inspection = inspectImageBytes({ declaredMime, bytes });
  return Object.freeze({ ...metadata, bytes, inspection, validationStatus: 'STRUCTURE_VALID', rightsStatus: 'TEST_ONLY_UNKNOWN', distributionStatus: 'PROHIBITED' });
}

function checksum(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function storeMetadata(candidate, inspection, bytes, localRef, created) {
  const source = candidate ? candidateMetadata(candidate) : {
    sourceId: 'test_fixture', sourceUrl: null, sourceRecordId: null, retrievedAt: null,
  };
  return Object.freeze({
    ...source,
    localRef,
    mimeType: inspection.mimeType,
    extension: inspection.extension,
    byteSize: inspection.byteSize,
    width: inspection.width,
    height: inspection.height,
    sha256: checksum(bytes),
    validationStatus: 'STRUCTURE_VALID',
    rightsStatus: 'TEST_ONLY_UNKNOWN',
    distributionStatus: 'PROHIBITED',
    created,
  });
}

/** Stores a validated image under a safe internal id and never overwrites an existing checksum path. */
export async function storeValidatedCover({ bytes, workspace, animeId, candidate, declaredMime }) {
  if (!workspace || typeof workspace.resolve !== 'function' || typeof workspace.root !== 'string') {
    throw typedError('COVER_WORKSPACE_INVALID', 'Validated covers require a catalog workspace');
  }
  if (typeof animeId !== 'string' || !ANIME_ID.test(animeId)) {
    throw typedError('COVER_ANIME_ID_INVALID', 'Cover anime ID is not safe for external storage');
  }
  const image = asBytes(bytes);
  const inspection = inspectImageBytes({ declaredMime, bytes: image });
  const digest = checksum(image);
  const directoryParts = ['images', 'covers', toPathKey(animeId)];
  const filename = `${digest}.${inspection.extension}`;
  const destination = workspace.resolve(...directoryParts, filename);
  await mkdir(workspace.resolve(...directoryParts), { recursive: true });
  let created = false;
  try {
    const handle = await open(destination, 'wx');
    try {
      await handle.writeFile(image);
      created = true;
    } finally {
      await handle.close();
    }
  } catch (error) {
    if (error?.code !== 'EEXIST') throw error;
    const existing = await readFile(destination);
    if (checksum(existing) !== digest) throw typedError('COVER_STORE_COLLISION', 'Existing cover path has different immutable bytes');
  }
  const localRef = [...directoryParts, filename].join('/');
  return storeMetadata(candidate, inspection, image, localRef, created);
}

/** Runs browser-native image decoding after structural validation without introducing an image package. */
export async function decodeCoverWithChromium({ bytes, inspection, browser } = {}) {
  const image = asBytes(bytes);
  if (!inspection || !MIME_DETAILS[inspection.mimeType] || inspection.byteSize !== image.byteLength) {
    throw typedError('IMAGE_DECODE_INPUT_INVALID', 'Chromium decode requires inspected image bytes');
  }
  let ownedBrowser = false;
  let activeBrowser = browser;
  if (!activeBrowser) {
    const { chromium } = await import('@playwright/test');
    activeBrowser = await chromium.launch();
    ownedBrowser = true;
  }
  try {
    const page = await activeBrowser.newPage();
    try {
      const result = await page.evaluate(async ({ base64, mimeType }) => {
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
      }, { base64: Buffer.from(image).toString('base64'), mimeType: inspection.mimeType });
      if (!result.ok || result.dimensions.width !== inspection.width || result.dimensions.height !== inspection.height) {
        throw typedError('IMAGE_DECODE_FAILED', 'Chromium could not decode the structurally valid cover');
      }
      return Object.freeze({ ...inspection, validationStatus: 'DECODED' });
    } finally {
      await page.close();
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
  const eligible = candidates.filter((row) => exactIdentityRank(row) < 2
    && ['STRUCTURE_VALID', 'DECODED'].includes(row?.validationStatus)
    && Number.isSafeInteger(row?.width) && Number.isSafeInteger(row?.height));
  if (eligible.length === 0) return null;
  const winner = [...eligible].sort(compareCover)[0];
  return Object.freeze({ ...winner, rightsStatus: 'TEST_ONLY_UNKNOWN', distributionStatus: 'PROHIBITED' });
}
