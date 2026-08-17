import { createHash, randomUUID } from 'node:crypto';
import { link, lstat, mkdir, open, readFile, rm } from 'node:fs/promises';
import { lookup } from 'node:dns/promises';
import { request as httpsRequest } from 'node:https';
import { isIP } from 'node:net';

import { classifyHttpFailure, RETRY_POLICY } from '../lib/http.mjs';
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
const IMAGE_ATTEMPT_TIMEOUT_MS = 10_000;
const IMAGE_OVERALL_TIMEOUT_MS = 45_000;
const MAX_NODE_TIMER_DELAY_MS = 2_147_483_647;
const RETRY_AFTER_VALID_TOO_LARGE = Object.freeze({ kind: 'VALID_TOO_LARGE' });
const ANIME_ID = /^anime:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const SOF_MARKERS = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
const COVER_RECORDS = new WeakSet();
const PRODUCTION_COVER_RECORDS = new WeakSet();
const COVER_BYTES = new WeakMap();
const COVER_POLICIES = new WeakSet();
const COVER_TRANSPORTS = new WeakMap();
const POLICIES = Object.freeze({
  anilist: Object.freeze({ sourceId: 'anilist', origins: Object.freeze(['https://s4.anilist.co']) }),
  anilife_public: Object.freeze({ sourceId: 'anilife_public', origins: Object.freeze(['https://anilife1.tv']) }),
  wikidata: Object.freeze({ sourceId: 'wikidata', origins: Object.freeze([]) }),
});
Object.values(POLICIES).forEach((policy) => COVER_POLICIES.add(policy));

function typedError(code, message, details = {}) {
  const error = new Error(message);
  error.code = code;
  Object.assign(error, details);
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

const IPV4_SPECIAL_REACHABILITY = Object.freeze([
  ['192.0.0.9', 32, true],
  ['192.0.0.10', 32, true],
  ['192.0.0.8', 32, false],
  ['192.0.0.170', 32, false],
  ['192.0.0.171', 32, false],
  ['192.88.99.2', 32, false],
  ['192.0.0.0', 29, false],
  ['192.0.0.0', 24, false],
  ['192.0.2.0', 24, false],
  ['192.31.196.0', 24, true],
  ['192.52.193.0', 24, true],
  ['192.88.99.0', 24, false],
  ['192.175.48.0', 24, true],
  ['198.51.100.0', 24, false],
  ['203.0.113.0', 24, false],
  ['169.254.0.0', 16, false],
  ['192.168.0.0', 16, false],
  ['198.18.0.0', 15, false],
  ['172.16.0.0', 12, false],
  ['100.64.0.0', 10, false],
  ['0.0.0.0', 8, false],
  ['10.0.0.0', 8, false],
  ['127.0.0.0', 8, false],
  ['224.0.0.0', 4, false],
  ['240.0.0.0', 4, false],
]);

function ipv4Number(address) {
  const values = address.split('.').map(Number);
  if (values.length !== 4 || values.some((value) => !Number.isInteger(value) || value < 0 || value > 255)) return null;
  return (((values[0] * 0x1000000) + (values[1] << 16) + (values[2] << 8) + values[3]) >>> 0);
}

function ipv4PrefixMatches(value, prefix, length) {
  const mask = length === 0 ? 0 : (0xffffffff << (32 - length)) >>> 0;
  return (value & mask) === (prefix & mask);
}

function ipv4Global(address) {
  const value = ipv4Number(address);
  if (value === null) return false;
  for (const [prefix, length, globallyReachable] of IPV4_SPECIAL_REACHABILITY) {
    if (ipv4PrefixMatches(value, ipv4Number(prefix), length)) return globallyReachable;
  }
  return true;
}

function ipv6Words(address) {
  const lower = address.toLowerCase().replace(/%.*$/u, '');
  const dottedIndex = lower.lastIndexOf(':');
  let normalized = lower;
  if (lower.includes('.')) {
    if (dottedIndex < 0) return null;
    const embedded = ipv4Number(lower.slice(dottedIndex + 1));
    if (embedded === null) return null;
    normalized = `${lower.slice(0, dottedIndex)}:${(embedded >>> 16).toString(16)}:${(embedded & 0xffff).toString(16)}`;
  }
  const halves = normalized.split('::');
  if (halves.length > 2) return null;
  const left = halves[0] ? halves[0].split(':') : [];
  const right = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
  if (left.some((part) => !/^[0-9a-f]{1,4}$/u.test(part)) || right.some((part) => !/^[0-9a-f]{1,4}$/u.test(part))) return null;
  if ((halves.length === 1 && left.length !== 8) || (halves.length === 2 && left.length + right.length >= 8)) return null;
  const words = [...left.map((part) => Number.parseInt(part, 16)), ...Array(Math.max(0, 8 - left.length - right.length)).fill(0), ...right.map((part) => Number.parseInt(part, 16))];
  return words.length === 8 ? words : null;
}

// Snapshot of the IANA IPv6 Special-Purpose registry (updated 2025-10-09).
// More-specific globally reachable exceptions precede the fail-closed
// 2001::/23 parent allocation, as required by the registry footnote.
const IPV6_SPECIAL_REACHABILITY = Object.freeze([
  ['::', 128, false],
  ['::1', 128, false],
  ['2001:1::1', 128, true],
  ['2001:1::2', 128, true],
  ['2001:1::3', 128, true],
  ['::ffff:0:0', 96, false],
  ['64:ff9b::', 96, true],
  ['64:ff9b:1::', 48, false],
  ['2001:2::', 48, false],
  ['2001:4:112::', 48, true],
  ['2620:4f:8000::', 48, true],
  ['2001::', 32, false],
  ['2001:3::', 32, true],
  ['2001:db8::', 32, false],
  ['2001:10::', 28, false],
  ['2001:20::', 28, true],
  ['2001:30::', 28, true],
  ['2001::', 23, false],
  ['3fff::', 20, false],
  ['2002::', 16, false],
  ['5f00::', 16, false],
  ['100::', 64, false],
  ['100:0:0:1::', 64, false],
  ['fe80::', 10, false],
  ['fc00::', 7, false],
]);

function ipv6PrefixMatches(words, prefixAddress, length) {
  const prefix = ipv6Words(prefixAddress);
  if (!prefix) return false;
  const completeWords = Math.floor(length / 16);
  for (let index = 0; index < completeWords; index += 1) {
    if (words[index] !== prefix[index]) return false;
  }
  const remaining = length % 16;
  if (remaining === 0) return true;
  const mask = (0xffff << (16 - remaining)) & 0xffff;
  return (words[completeWords] & mask) === (prefix[completeWords] & mask);
}

function embeddedIpv4(words) {
  return `${words[6] >>> 8}.${words[6] & 255}.${words[7] >>> 8}.${words[7] & 255}`;
}

function globalAddress(address) {
  if (typeof address !== 'string' || !isIP(address.replace(/%.*$/u, ''))) return false;
  const value = address.toLowerCase().replace(/%.*$/u, '');
  if (isIP(value) === 4) return ipv4Global(value);
  const words = ipv6Words(value);
  if (!words) return false;
  const mapped = words.slice(0, 6).every((word, index) => word === (index === 5 ? 0xffff : 0));
  if (mapped) return ipv4Global(embeddedIpv4(words));
  if (ipv6PrefixMatches(words, '64:ff9b::', 96)) return ipv4Global(embeddedIpv4(words));
  if (ipv6PrefixMatches(words, '2002::', 16)) {
    const sixToFourIpv4 = `${words[1] >>> 8}.${words[1] & 255}.${words[2] >>> 8}.${words[2] & 255}`;
    if (!ipv4Global(sixToFourIpv4)) return false;
    return false; // IANA marks 6to4 global reachability N/A, including global embedded IPv4.
  }
  if ((words[0] & 0xe000) !== 0x2000) return false;
  for (const [prefix, length, globallyReachable] of IPV6_SPECIAL_REACHABILITY) {
    if (ipv6PrefixMatches(words, prefix, length)) return globallyReachable;
  }
  return true;
}

function retryAfterMilliseconds(headers, now) {
  const raw = headers?.get?.('retry-after');
  if (!raw) return null;
  const value = raw.trim();
  if (/^\d+$/u.test(value)) {
    const milliseconds = BigInt(value) * 1000n;
    if (milliseconds > BigInt(MAX_NODE_TIMER_DELAY_MS)) return RETRY_AFTER_VALID_TOO_LARGE;
    return Object.freeze({ kind: 'VALID', milliseconds: Number(milliseconds) });
  }
  if (!/^(Sun|Mon|Tue|Wed|Thu|Fri|Sat), \d{2} (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{4} \d{2}:\d{2}:\d{2} GMT$/u.test(value)) return null;
  const timestamp = Date.parse(value);
  const current = now();
  if (!Number.isFinite(timestamp) || new Date(timestamp).toUTCString() !== value || timestamp <= current) return null;
  const milliseconds = Math.ceil(timestamp - current);
  if (!Number.isSafeInteger(milliseconds) || milliseconds > MAX_NODE_TIMER_DELAY_MS) return RETRY_AFTER_VALID_TOO_LARGE;
  return Object.freeze({ kind: 'VALID', milliseconds });
}

function retryDelay(attempt, random) {
  const exponential = Math.min(RETRY_POLICY.maxDelayMs, RETRY_POLICY.baseDelayMs * (2 ** attempt));
  return Math.min(RETRY_POLICY.maxDelayMs, exponential + Math.floor(random() * RETRY_POLICY.baseDelayMs));
}

function sameAddress(left, right) {
  const leftVersion = isIP(left?.replace?.(/%.*$/u, '') ?? '');
  const rightVersion = isIP(right?.replace?.(/%.*$/u, '') ?? '');
  if (leftVersion === 4 && rightVersion === 4) return ipv4Number(left) === ipv4Number(right);
  const leftWords = ipv6Words(left ?? '');
  const rightWords = ipv6Words(right ?? '');
  return Boolean(leftWords && rightWords && leftWords.every((word, index) => word === rightWords[index]));
}

function abortable(promise, signal) {
  if (signal.aborted) return Promise.reject(signal.reason);
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason);
    signal.addEventListener('abort', abort, { once: true });
    Promise.resolve(promise).then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
  });
}

async function readNodeBody(response, headers, maxBytes, signal) {
  boundedContentLength({ headers }, maxBytes);
  const chunks = [];
  let size = 0;
  try {
    for await (const value of response) {
      if (signal.aborted) throw signal.reason;
      const chunk = asBytes(value);
      size += chunk.byteLength;
      if (!Number.isSafeInteger(size) || size > maxBytes) {
        throw typedError('IMAGE_RESPONSE_TOO_LARGE', 'Cover response exceeds the byte limit', { retryable: false });
      }
      chunks.push(chunk);
    }
  } catch (error) {
    response.destroy?.();
    throw error;
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

function requestConcreteAttempt({ url, address, hostname, maxBytes, httpsRequestImpl, signal, now }) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    let response;
    let settled = false;
    const finish = (handler, value) => {
      if (settled) return;
      settled = true;
      signal.removeEventListener('abort', abort);
      handler(value);
    };
    const abort = () => {
      response?.destroy?.();
      request.destroy?.(signal.reason);
      finish(reject, signal.reason);
    };
    const options = {
      hostname: address,
      port: 443,
      path: `${parsed.pathname}${parsed.search}`,
      method: 'GET',
      servername: hostname,
      headers: { host: hostname },
      lookup: (_name, _options, callback) => callback(null, address, isIP(address)),
      signal,
    };
    const request = httpsRequestImpl(options, (incoming) => {
      response = incoming;
      const remoteAddress = incoming.socket?.remoteAddress;
      if (!sameAddress(remoteAddress, address)) {
        incoming.destroy?.();
        finish(reject, typedError('IMAGE_ADDRESS_MISMATCH', 'Pinned cover socket connected to a different address', { retryable: false }));
        return;
      }
      const status = incoming.statusCode;
      const headers = new Headers(incoming.headers);
      if (!Number.isInteger(status) || status < 200 || status >= 300) {
        const failure = Number.isInteger(status) ? classifyHttpFailure(status) : 'FAILED_PERMANENT';
        const retryable = failure === 'RATE_LIMITED' || failure === 'FAILED_RETRYABLE';
        const retryAfter = status === 429 ? retryAfterMilliseconds(headers, now) : null;
        incoming.destroy?.();
        finish(reject, typedError('IMAGE_HTTP_STATUS_INVALID', 'Pinned cover response is not successful', {
          status, retryable, retryAfter,
        }));
        return;
      }
      readNodeBody(incoming, headers, maxBytes, signal).then(
        (bytes) => finish(resolve, { url, connectedAddress: remoteAddress, redirected: false, status, headers, bytes }),
        (error) => finish(reject, error),
      );
    });
    request.once('error', (error) => finish(reject, error));
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) abort();
    else request.end();
  });
}

function overallTimeoutError() {
  return typedError('IMAGE_TIMEOUT', 'Pinned cover download exceeded its overall deadline');
}

function waitForRetry(milliseconds, { signal, retryTimers }) {
  if (milliseconds <= 0) return;
  if (!Number.isSafeInteger(milliseconds) || milliseconds > MAX_NODE_TIMER_DELAY_MS) throw overallTimeoutError();
  if (signal.aborted) return Promise.reject(signal.reason);
  return new Promise((resolve, reject) => {
    let handle;
    let settled = false;
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      if (handle !== undefined) retryTimers.clearTimeout(handle);
      signal.removeEventListener('abort', abort);
      callback(value);
    };
    const abort = () => finish(reject, signal.reason);
    signal.addEventListener('abort', abort, { once: true });
    try {
      handle = retryTimers.setTimeout(() => finish(resolve), milliseconds);
    } catch (error) {
      finish(reject, error);
      return;
    }
    if (settled) retryTimers.clearTimeout(handle);
    else if (signal.aborted) abort();
  });
}

function createConcreteDownloader({
  resolve, httpsRequestImpl, retryTimers, operationSignal, random, now, attemptTimeoutMs, overallTimeoutMs,
}) {
  return async ({ url, hostname, maxBytes }) => {
    const operation = new AbortController();
    const deadlineAt = now() + overallTimeoutMs;
    const forwardExternal = () => operation.abort(operationSignal.reason);
    operationSignal?.addEventListener('abort', forwardExternal, { once: true });
    if (operationSignal?.aborted) forwardExternal();
    const overallTimer = setTimeout(() => operation.abort(overallTimeoutError()), overallTimeoutMs);
    try {
      for (let attempt = 0; attempt <= RETRY_POLICY.imageRetries; attempt += 1) {
        if (operation.signal.aborted) throw operation.signal.reason;
        const attemptController = new AbortController();
        const forwardOverall = () => attemptController.abort(operation.signal.reason);
        operation.signal.addEventListener('abort', forwardOverall, { once: true });
        const attemptTimer = setTimeout(() => attemptController.abort(typedError('IMAGE_ATTEMPT_TIMEOUT', 'Pinned cover attempt timed out', { retryable: true })), attemptTimeoutMs);
        let failure;
        try {
          const addresses = await abortable(resolve(hostname, { signal: attemptController.signal }), attemptController.signal);
          if (!Array.isArray(addresses) || addresses.length === 0 || addresses.some((entry) => !globalAddress(entry?.address))) {
            throw typedError('IMAGE_ADDRESS_FORBIDDEN', 'Cover hostname resolves to a non-global address', { retryable: false });
          }
          return await requestConcreteAttempt({
            url, address: addresses[0].address, hostname, maxBytes, httpsRequestImpl, signal: attemptController.signal, now,
          });
        } catch (error) {
          failure = operation.signal.aborted ? operation.signal.reason : attemptController.signal.aborted ? attemptController.signal.reason : error;
        } finally {
          clearTimeout(attemptTimer);
          operation.signal.removeEventListener('abort', forwardOverall);
        }
        if (operation.signal.aborted) throw operation.signal.reason;
        if (failure?.retryable === false) throw failure;
        if (attempt >= RETRY_POLICY.imageRetries) {
          throw typedError('IMAGE_RETRY_EXHAUSTED', 'Pinned cover retries were exhausted', {
            status: failure?.status, cause: failure,
          });
        }
        if (failure?.retryAfter?.kind === 'VALID_TOO_LARGE') throw overallTimeoutError();
        const delay = failure?.retryAfter?.kind === 'VALID'
          ? failure.retryAfter.milliseconds
          : retryDelay(attempt, random);
        const remaining = Math.ceil(deadlineAt - now());
        if (operation.signal.aborted) throw operation.signal.reason;
        if (remaining < 1 || delay >= remaining) throw overallTimeoutError();
        await waitForRetry(delay, { signal: operation.signal, retryTimers });
      }
      throw typedError('IMAGE_RETRY_EXHAUSTED', 'Pinned cover retries were exhausted');
    } finally {
      clearTimeout(overallTimer);
      operationSignal?.removeEventListener('abort', forwardExternal);
    }
  };
}

function registerTransport(metadata) {
  const transport = Object.freeze({});
  COVER_TRANSPORTS.set(transport, Object.freeze(metadata));
  return transport;
}

/** Creates the production transport, or a branded synthetic fixture transport when callbacks are supplied. */
export function createPinnedCoverTransport({ resolve, request } = {}) {
  if (request !== undefined || resolve !== undefined) {
    if (typeof resolve !== 'function' || typeof request !== 'function') throw typedError('IMAGE_TRANSPORT_INVALID', 'Synthetic cover transport requires resolver and request functions');
    return registerTransport({ kind: 'SYNTHETIC_TEST', production: false, concrete: false, resolve, request });
  }
  return registerTransport({
    kind: 'CONCRETE', production: true, concrete: true,
    download: createConcreteDownloader({
      resolve: (host) => lookup(host, { all: true, verbatim: true }),
      httpsRequestImpl: httpsRequest,
      retryTimers: Object.freeze({
        setTimeout: (callback, milliseconds) => setTimeout(callback, milliseconds),
        clearTimeout: (handle) => clearTimeout(handle),
      }),
      random: Math.random,
      now: Date.now,
      attemptTimeoutMs: IMAGE_ATTEMPT_TIMEOUT_MS,
      overallTimeoutMs: IMAGE_OVERALL_TIMEOUT_MS,
    }),
  });
}

/** Exercises the concrete production algorithm with low-level fakes, but brands every resulting record TEST-only. */
export function createConcreteCoverTransportTestHarness({
  resolve,
  httpsRequest: httpsRequestImpl,
  retryTimers = Object.freeze({
    setTimeout: (callback, milliseconds) => setTimeout(callback, milliseconds),
    clearTimeout: (handle) => clearTimeout(handle),
  }),
  operationSignal,
  random = Math.random,
  now = Date.now,
  attemptTimeoutMs = IMAGE_ATTEMPT_TIMEOUT_MS,
  overallTimeoutMs = IMAGE_OVERALL_TIMEOUT_MS,
} = {}) {
  if (typeof resolve !== 'function' || typeof httpsRequestImpl !== 'function'
    || typeof retryTimers?.setTimeout !== 'function' || typeof retryTimers?.clearTimeout !== 'function'
    || (operationSignal !== undefined && !(operationSignal instanceof AbortSignal))
    || typeof random !== 'function' || typeof now !== 'function'
    || !Number.isSafeInteger(attemptTimeoutMs) || attemptTimeoutMs < 1
    || !Number.isSafeInteger(overallTimeoutMs) || overallTimeoutMs < 1) {
    throw typedError('IMAGE_TRANSPORT_INVALID', 'Concrete cover test harness dependencies are invalid');
  }
  return registerTransport({
    kind: 'CONCRETE_TEST', production: false, concrete: true,
    download: createConcreteDownloader({ resolve, httpsRequestImpl, retryTimers, operationSignal, random, now, attemptTimeoutMs, overallTimeoutMs }),
  });
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
  if (!/^\d+$/u.test(raw.trim())) throw typedError('IMAGE_CONTENT_LENGTH_INVALID', 'Cover Content-Length must be a safe integer', { retryable: false });
  const length = Number(raw);
  if (!Number.isSafeInteger(length)) throw typedError('IMAGE_CONTENT_LENGTH_INVALID', 'Cover Content-Length must be a safe integer', { retryable: false });
  if (length > maxBytes) throw typedError('IMAGE_RESPONSE_TOO_LARGE', 'Cover response exceeds the byte limit', { retryable: false });
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
        const error = typedError('IMAGE_RESPONSE_TOO_LARGE', 'Cover response exceeds the byte limit');
        await reader.cancel().catch(() => {});
        throw error;
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
  const transportMetadata = COVER_TRANSPORTS.get(transport);
  if (!transportMetadata || !Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > MAX_COVER_BYTES) throw typedError('IMAGE_DOWNLOAD_INPUT_INVALID', 'Cover download requires a pinned bounded transport');
  const metadata = candidateMetadata(candidate, policy);
  const hostname = new URL(metadata.sourceUrl).hostname;
  let response;
  let consumed = false;
  try {
    let address;
    if (transportMetadata.concrete) {
      response = await transportMetadata.download({ url: metadata.sourceUrl, hostname, maxBytes });
      address = response?.connectedAddress;
    } else {
      const addresses = await transportMetadata.resolve(hostname);
      if (!Array.isArray(addresses) || addresses.length === 0 || addresses.some((entry) => !globalAddress(entry?.address))) throw typedError('IMAGE_ADDRESS_FORBIDDEN', 'Cover hostname resolves to a non-global address');
      address = addresses[0].address;
      response = await transportMetadata.request({ url: metadata.sourceUrl, address, hostname, kind: 'IMAGE', init: { redirect: 'error' } });
    }
    if (!response || response.redirected || response.url !== metadata.sourceUrl || !sameAddress(response.connectedAddress, address)) throw typedError('IMAGE_REDIRECT_FORBIDDEN', 'Cover redirect or final destination is forbidden');
    if (response.status !== undefined && (!Number.isInteger(response.status) || response.status < 200 || response.status >= 300)) throw typedError('IMAGE_HTTP_STATUS_INVALID', 'Cover response is not successful');
    boundedContentLength(response, maxBytes);
    const declaredMime = response.headers?.get?.('content-type');
    const bytes = response.bytes === undefined ? await readBoundedBody(response, maxBytes) : asBytes(response.bytes);
    if (bytes.byteLength > maxBytes) throw typedError('IMAGE_RESPONSE_TOO_LARGE', 'Cover response exceeds the byte limit');
    consumed = true;
    const inspection = inspectImageBytes({ declaredMime, bytes });
    const record = Object.freeze({ ...metadata, ...inspection, checksum: checksum(bytes), localRef: null, validationStatus: 'SNIFFED', rightsStatus: 'TEST_ONLY_UNKNOWN', distributionStatus: 'PROHIBITED' });
    COVER_RECORDS.add(record);
    COVER_BYTES.set(record, bytes);
    if (transportMetadata.production) PRODUCTION_COVER_RECORDS.add(record);
    return record;
  } finally {
    if (!consumed) {
      response?.destroy?.();
      await response?.body?.cancel?.().catch(() => {});
    }
  }
}

function checksum(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

async function persistCoverBytes({ image, digest, extension, workspace, animeId }) {
  if (typeof animeId !== 'string' || !ANIME_ID.test(animeId)) {
    throw typedError('COVER_ANIME_ID_INVALID', 'Cover anime ID is not safe for external storage');
  }
  const directoryParts = ['images', 'covers', toPathKey(animeId)];
  const filename = `${digest}.${extension}`;
  await assertCatalogWorkspaceMutation(workspace, directoryParts);
  const directory = workspace.resolve(...directoryParts);
  await mkdir(directory, { recursive: true });
  await assertCatalogWorkspaceMutation(workspace, directoryParts);
  const destination = workspace.resolve(...directoryParts, filename);
  const temporary = workspace.resolve(...directoryParts, `.${digest}.${randomUUID()}.tmp`);
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
  return Object.freeze({ localRef, created });
}

/** Stores a validated image under a safe internal id and never overwrites an existing checksum path. */
export async function storeValidatedCover({ record, workspace, animeId }) {
  if (!COVER_RECORDS.has(record) || !PRODUCTION_COVER_RECORDS.has(record)
    || record.validationStatus !== 'DECODED' || !COVER_BYTES.has(record)) {
    throw typedError('COVER_RECORD_UNTRUSTED', 'Only decoded production-acquired CoverRecords may be stored');
  }
  const image = COVER_BYTES.get(record);
  const persisted = await persistCoverBytes({
    image, digest: record.checksum, extension: record.extension, workspace, animeId,
  });
  const { localRef, created } = persisted;
  const stored = Object.freeze({ ...record, localRef, created });
  COVER_RECORDS.add(stored);
  PRODUCTION_COVER_RECORDS.add(stored);
  COVER_BYTES.set(stored, image);
  return stored;
}

/** Test-only persistence observation. It never creates, brands, decodes, or selects a CoverRecord. */
export function createCoverStorageTestHarness() {
  return Object.freeze({
    async storeFixture({ bytes, declaredMime, workspace, animeId } = {}) {
      await assertCatalogWorkspaceMutation(workspace, []);
      const image = asBytes(bytes);
      const inspection = inspectImageBytes({ declaredMime, bytes: image });
      const digest = checksum(image);
      const persisted = await persistCoverBytes({
        image, digest, extension: inspection.extension, workspace, animeId,
      });
      return Object.freeze({
        checksum: digest,
        byteSize: inspection.byteSize,
        localRef: persisted.localRef,
        created: persisted.created,
      });
    },
  });
}

const loadProductionChromium = () => import('@playwright/test');

function decodeTimeoutError() {
  return typedError('IMAGE_DECODE_TIMEOUT', 'Chromium cover decode exceeded its operation deadline');
}

function remainingMilliseconds(deadlineAt) {
  return Math.max(0, Math.ceil(deadlineAt - Date.now()));
}

async function beforeDeadline(promise, deadlineAt) {
  const remaining = remainingMilliseconds(deadlineAt);
  if (remaining < 1) throw decodeTimeoutError();
  let timer;
  try {
    return await Promise.race([
      Promise.resolve(promise),
      new Promise((_, reject) => { timer = setTimeout(() => reject(decodeTimeoutError()), remaining); }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

async function boundedCleanup(close, timeoutMs) {
  let timer;
  const operation = Promise.resolve().then(close).catch(() => {});
  try {
    await Promise.race([
      operation,
      new Promise((resolve) => { timer = setTimeout(resolve, timeoutMs); }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

async function acquireBeforeDeadline(acquisition, deadlineAt, closeLate) {
  let abandoned = false;
  const promise = Promise.resolve(acquisition);
  promise.then((resource) => {
    if (abandoned) void closeLate(resource);
  }, () => {});
  try {
    return await beforeDeadline(promise, deadlineAt);
  } catch (error) {
    abandoned = true;
    throw error;
  }
}

function normalizeDecodeFailure(error, deadlineAt) {
  if (error?.code === 'IMAGE_DECODE_TIMEOUT' || error?.code === 'IMAGE_DECODE_FAILED') return error;
  if (remainingMilliseconds(deadlineAt) < 1 || error?.name === 'TimeoutError') return decodeTimeoutError();
  return typedError('IMAGE_DECODE_FAILED', 'Chromium could not decode the structurally valid cover', { cause: error });
}

async function runChromiumLifecycle({ record, loadChromium, timeoutMs, cleanupTimeoutMs }) {
  if (!COVER_RECORDS.has(record) || record.validationStatus !== 'SNIFFED' || !COVER_BYTES.has(record)) {
    throw typedError('IMAGE_DECODE_INPUT_INVALID', 'Chromium decode requires an authenticated sniffed CoverRecord');
  }
  const image = COVER_BYTES.get(record);
  const deadlineAt = Date.now() + timeoutMs;
  let browser;
  let page;
  let context;
  const closePage = (resource) => boundedCleanup(() => resource?.close?.({ runBeforeUnload: false }), cleanupTimeoutMs);
  const closeContext = (resource) => boundedCleanup(() => resource?.close?.({ reason: 'MOEMOA cover decode complete' }), cleanupTimeoutMs);
  const closeBrowser = (resource) => boundedCleanup(() => resource?.close?.({ reason: 'MOEMOA cover decode complete' }), cleanupTimeoutMs);
  const closeLatePage = async (resource) => {
    await closePage(resource);
    const lateContext = typeof resource?.context === 'function' ? resource.context() : undefined;
    if (lateContext) await closeContext(lateContext);
  };
  try {
    const module = await beforeDeadline(Promise.resolve().then(loadChromium), deadlineAt);
    if (!module?.chromium || typeof module.chromium.launch !== 'function') {
      throw typedError('IMAGE_DECODE_FAILED', 'Chromium module is unavailable');
    }
    const launchTimeout = remainingMilliseconds(deadlineAt);
    if (launchTimeout < 1) throw decodeTimeoutError();
    browser = await acquireBeforeDeadline(module.chromium.launch({ timeout: launchTimeout }), deadlineAt, closeBrowser);
    page = await acquireBeforeDeadline(browser.newPage(), deadlineAt, closeLatePage);
    context = typeof page.context === 'function' ? page.context() : undefined;
    const result = await beforeDeadline(page.evaluate(async ({ base64, mimeType }) => {
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
    }, { base64: Buffer.from(image).toString('base64'), mimeType: record.mimeType }), deadlineAt);
    if (!result?.ok || result.dimensions?.width !== record.width || result.dimensions?.height !== record.height) {
      throw typedError('IMAGE_DECODE_FAILED', 'Chromium could not decode the structurally valid cover');
    }
    return Object.freeze({ ok: true, dimensions: Object.freeze({ ...result.dimensions }) });
  } catch (error) {
    throw normalizeDecodeFailure(error, deadlineAt);
  } finally {
    if (page) await closePage(page);
    if (context) await closeContext(context);
    if (browser) await closeBrowser(browser);
  }
}

/** Runs browser-native image decoding with module-owned Playwright Chromium only. */
export async function decodeCoverWithChromium({ record, timeoutMs = 5_000, browser } = {}) {
  if (browser !== undefined || !Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 10_000) {
    throw typedError('IMAGE_DECODE_INPUT_INVALID', 'Chromium decode requires an authenticated sniffed CoverRecord');
  }
  if (!PRODUCTION_COVER_RECORDS.has(record)) {
    throw typedError('COVER_RECORD_UNTRUSTED', 'Production Chromium decode requires a module-acquired CoverRecord');
  }
  await runChromiumLifecycle({ record, loadChromium: loadProductionChromium, timeoutMs, cleanupTimeoutMs: 250 });
  const image = COVER_BYTES.get(record);
  const decoded = Object.freeze({ ...record, validationStatus: 'DECODED' });
  COVER_RECORDS.add(decoded);
  PRODUCTION_COVER_RECORDS.add(decoded);
  COVER_BYTES.set(decoded, image);
  return decoded;
}

/** Lifecycle-only seam: injected Chromium can be observed but can never mint a DECODED CoverRecord. */
export function createChromiumLifecycleTestHarness({ loadChromium } = {}) {
  if (typeof loadChromium !== 'function') throw typedError('IMAGE_DECODE_INPUT_INVALID', 'Chromium lifecycle test loader is invalid');
  return Object.freeze({
    async run({ record, timeoutMs = 100, cleanupTimeoutMs = 10 } = {}) {
      if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 10_000
        || !Number.isSafeInteger(cleanupTimeoutMs) || cleanupTimeoutMs < 1 || cleanupTimeoutMs > 1_000) {
        throw typedError('IMAGE_DECODE_INPUT_INVALID', 'Chromium lifecycle test deadline is invalid');
      }
      return runChromiumLifecycle({ record, loadChromium, timeoutMs, cleanupTimeoutMs });
    },
  });
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
    && PRODUCTION_COVER_RECORDS.has(row)
    && row.validationStatus === 'DECODED' && typeof row.localRef === 'string'
    && Number.isSafeInteger(row.width) && Number.isSafeInteger(row.height));
  if (eligible.length === 0) return null;
  return [...eligible].sort(compareCover)[0];
}
