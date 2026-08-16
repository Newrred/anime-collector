import { createHttpClient } from '../lib/http.mjs';

const ANILIFE_ORIGIN = 'https://anilife1.tv';
const SITEMAP_URL = `${ANILIFE_ORIGIN}/sitemap.xml`;
const PARSER_VERSION = 'anilife-public-page-test-v1';
const MANUAL_REVIEW_EVIDENCE = 'MANUAL_PUBLIC_PAGE_REVIEW';
const ALLOWED_JSON_LD_TYPES = new Set(['TVSeries', 'Movie', 'VideoObject']);
const MAX_SITEMAP_BYTES = 5 * 1024 * 1024;

function typedError(code, message = code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function sourceSchemaDrift() {
  return typedError('SOURCE_SCHEMA_DRIFT', 'AniLife public page does not match the allowed schema');
}

function assertApprovedPublicUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw typedError('SOURCE_ENDPOINT_FORBIDDEN', 'AniLife URL is not an approved public endpoint');
  }
  const isSitemap = parsed.pathname === '/sitemap.xml';
  const isContent = /^\/content\/[1-9]\d*$/.test(parsed.pathname);
  if (parsed.origin !== ANILIFE_ORIGIN || parsed.username || parsed.password || parsed.search || parsed.hash
    || (!isSitemap && !isContent)) {
    throw typedError('SOURCE_ENDPOINT_FORBIDDEN', 'AniLife URL is not an approved public endpoint');
  }
  return parsed;
}

function contentPageUrl(contentId) {
  return assertApprovedPublicUrl(`${ANILIFE_ORIGIN}/content/${contentId}`).href;
}

function isPlainRecord(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function snapshotJsonRecord(value) {
  try {
    assertSafeJsonData(value);
    if (!isPlainRecord(value)) throw new TypeError('Binding is not a record');
    const cloned = structuredClone(value);
    const serialized = JSON.stringify(cloned);
    if (typeof serialized !== 'string') throw new TypeError('Binding is not JSON-safe');
    const snapshot = JSON.parse(serialized);
    if (!isPlainRecord(snapshot)) throw new TypeError('Binding is not a record');
    return snapshot;
  } catch {
    throw sourceSchemaDrift();
  }
}

function assertSafeJsonData(value, seen = new Set()) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number') {
    if (Number.isFinite(value)) return;
    throw new TypeError('Binding contains a non-JSON number');
  }
  if (typeof value !== 'object' || seen.has(value)) throw new TypeError('Binding contains unsupported data');
  const prototype = Object.getPrototypeOf(value);
  if (!(Array.isArray(value) ? prototype === Array.prototype : isPlainRecord(value))) {
    throw new TypeError('Binding contains an unsupported prototype');
  }
  seen.add(value);
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key === 'symbol') throw new TypeError('Binding contains a symbol key');
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !Object.hasOwn(descriptor, 'value')) throw new TypeError('Binding contains an accessor');
    assertSafeJsonData(descriptor.value, seen);
  }
  seen.delete(value);
}

function ownDataValue(record, key) {
  const descriptor = Object.getOwnPropertyDescriptor(record, key);
  if (!descriptor || !Object.hasOwn(descriptor, 'value')) return undefined;
  return descriptor.value;
}

function textValue(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function episodeCount(value) {
  if (Number.isSafeInteger(value) && value > 0) return value;
  if (typeof value === 'string' && /^[1-9]\d*$/.test(value)) {
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) ? parsed : null;
  }
  return null;
}

function imageValue(value) {
  if (Array.isArray(value)) return imageValue(value[0]);
  if (value && typeof value === 'object') return imageValue(value.url ?? value.contentUrl);
  return textValue(value);
}

function jsonLdNodes(value) {
  if (Array.isArray(value)) return value.flatMap(jsonLdNodes);
  if (!value || typeof value !== 'object') return [];
  return [value, ...jsonLdNodes(value['@graph'])];
}

function isAllowedMediaNode(node) {
  const types = Array.isArray(node['@type']) ? node['@type'] : [node['@type']];
  return types.some((type) => ALLOWED_JSON_LD_TYPES.has(type));
}

function parseJsonLd(html) {
  const pattern = /<script\b[^>]*\btype\s*=\s*(["'])application\/ld\+json\1[^>]*>([\s\S]*?)<\/script\s*>/gi;
  let match;
  let schemaDrift = false;
  const nodes = [];
  while ((match = pattern.exec(html))) {
    try {
      nodes.push(...jsonLdNodes(JSON.parse(match[2])));
    } catch {
      schemaDrift = true;
    }
  }
  const record = nodes.find((node) => isAllowedMediaNode(node) && textValue(node.name));
  if (!record) schemaDrift = true;
  return { record, schemaDrift };
}

function parseAttributes(markup) {
  const values = {};
  for (const match of markup.matchAll(/([:\w-]+)\s*=\s*(["'])(.*?)\2/g)) values[match[1].toLowerCase()] = match[3];
  return values;
}

const NAMED_HTML_ENTITIES = Object.freeze({
  amp: '&', apos: "'", copy: '©', cent: '¢', euro: '€', gt: '>', hellip: '…',
  laquo: '«', lt: '<', mdash: '—', nbsp: '\u00a0', ndash: '–', pound: '£', quot: '"',
  raquo: '»', reg: '®', trade: '™', yen: '¥',
});

function decodeHtmlEntities(value) {
  if (typeof value !== 'string') return null;
  let rejected = false;
  const decoded = value.replace(/&(?:(#x[0-9a-f]+)|(#\d+)|([a-z][a-z0-9]*));/gi, (match, hex, decimal, named) => {
    if (named) {
      const replacement = NAMED_HTML_ENTITIES[named.toLowerCase()];
      if (replacement !== undefined) return replacement;
      rejected = true;
      return '';
    }
    const codePoint = Number.parseInt((hex ?? decimal).slice(hex ? 2 : 1), hex ? 16 : 10);
    if (!Number.isSafeInteger(codePoint) || codePoint < 0 || codePoint > 0x10ffff
      || (codePoint >= 0xd800 && codePoint <= 0xdfff)) {
      rejected = true;
      return '';
    }
    return String.fromCodePoint(codePoint);
  });
  return rejected ? null : decoded;
}

function openGraphValue(html, property) {
  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    const attributes = parseAttributes(match[0]);
    if (attributes.property?.toLowerCase() === property) return textValue(decodeHtmlEntities(attributes.content));
  }
  return null;
}

function projectJsonLd(record, { contentId, publicPageUrl }) {
  return {
    contentId,
    title: textValue(record.name),
    alternateName: textValue(record.alternateName),
    datePublished: textValue(record.datePublished),
    numberOfEpisodes: episodeCount(record.numberOfEpisodes),
    imageUrl: imageValue(record.image),
    publicPageUrl,
  };
}

function parseAllowedPayload(html, { contentId, publicPageUrl }) {
  const { record, schemaDrift } = parseJsonLd(html);
  if (!schemaDrift && record) return projectJsonLd(record, { contentId, publicPageUrl });
  const title = openGraphValue(html, 'og:title');
  const imageUrl = openGraphValue(html, 'og:image');
  if (!title && !imageUrl) throw sourceSchemaDrift();
  return Object.freeze({
    contentId,
    ...(title ? { title } : {}),
    ...(imageUrl ? { imageUrl } : {}),
    publicPageUrl,
    errorCode: 'SOURCE_SCHEMA_DRIFT',
  });
}

function sitemapHasContentUrl(xml, publicPageUrl) {
  for (const locator of extractSitemapLocators(xml) ?? []) {
    try {
      if (assertApprovedPublicUrl(locator).href === publicPageUrl) return true;
    } catch {
      // Sitemap entries outside the narrow public allowlist are never followed.
    }
  }
  return false;
}

function extractSitemapLocators(xml) {
  const value = String(xml);
  if (value.length > MAX_SITEMAP_BYTES) return null;
  const tokens = /<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!\[CDATA\[[\s\S]*?\]\]>|<[^>]*>/g;
  const stack = [];
  const locators = [];
  let rootOpened = false;
  let rootClosed = false;
  let location = 0;
  let tokenCount = 0;

  const text = (chunk) => {
    if (stack.join('/') === 'urlset/url/loc') locators[locators.length - 1] += chunk;
    else if (['urlset/url/lastmod', 'urlset/url/changefreq', 'urlset/url/priority'].includes(stack.join('/'))) {
      return true;
    }
    else if (chunk.trim()) return false;
    return true;
  };

  for (const match of value.matchAll(tokens)) {
    if (++tokenCount > 100_000 || !text(value.slice(location, match.index))) return null;
    location = match.index + match[0].length;
    const token = match[0];
    if (token.startsWith('<!--') || token.startsWith('<?')) continue;
    if (token.startsWith('<![CDATA[')) {
      if (stack.join('/') !== 'urlset/url/loc') return null;
      locators[locators.length - 1] += token.slice(9, -3);
      continue;
    }
    if (token.startsWith('<!')) return null;
    const closing = /^<\/([A-Za-z][A-Za-z0-9-]*)\s*>$/.exec(token);
    if (closing) {
      if (stack.at(-1) !== closing[1]) return null;
      stack.pop();
      if (closing[1] === 'urlset') rootClosed = true;
      continue;
    }
    const opening = /^<([A-Za-z][A-Za-z0-9-]*)(?:\s+[^<>]*)?\s*(\/?)>$/.exec(token);
    if (!opening || rootClosed) return null;
    const [, name, selfClosing] = opening;
    const parent = stack.at(-1);
    const allowed = (!rootOpened && name === 'urlset')
      || (parent === 'urlset' && name === 'url')
      || (parent === 'url' && ['loc', 'lastmod', 'changefreq', 'priority'].includes(name));
    if (!allowed || stack.length > 2) return null;
    if (!rootOpened) rootOpened = true;
    if (name === 'loc' && selfClosing) return null;
    if (name === 'loc') locators.push('');
    if (!selfClosing) stack.push(name);
  }
  if (!text(value.slice(location)) || stack.length !== 0 || !rootOpened || !rootClosed) return null;
  return locators.map((locator) => locator.trim());
}

async function requestApprovedPublicPage(http, url) {
  assertApprovedPublicUrl(url);
  try {
    return await http.request({ url, kind: 'DATA', init: { redirect: 'error' } });
  } catch (error) {
    if (isRedirectFailure(error)) {
      throw typedError('SOURCE_REDIRECT_FORBIDDEN', 'AniLife redirect is not an approved public endpoint');
    }
    throw error;
  }
}

function isRedirectFailure(error) {
  return error?.code === 'SOURCE_REDIRECT_FORBIDDEN' || error?.cause?.code === 'SOURCE_REDIRECT_FORBIDDEN';
}

async function readSitemapBody(response) {
  const reader = response?.body?.getReader?.();
  if (!reader) throw sourceSchemaDrift();
  const decoder = new TextDecoder();
  let totalBytes = 0;
  let content = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!(value instanceof Uint8Array)) throw sourceSchemaDrift();
      totalBytes += value.byteLength;
      if (totalBytes > MAX_SITEMAP_BYTES) throw sourceSchemaDrift();
      content += decoder.decode(value, { stream: true });
    }
    return content + decoder.decode();
  } catch {
    try {
      await reader.cancel();
    } catch {
      // A failed cancellation must not replace the bounded schema error.
    }
    throw sourceSchemaDrift();
  } finally {
    reader.releaseLock?.();
  }
}

/**
 * Validates one manually reviewed local binding. Content discovery and free-text lookup are
 * deliberately unsupported: this adapter accepts only a numeric, reviewed content id.
 */
export function validateAniLifeBinding(binding) {
  const snapshot = snapshotJsonRecord(binding);
  const evidence = ownDataValue(snapshot, 'evidence');
  const contentId = ownDataValue(snapshot, 'contentId');
  if (evidence !== MANUAL_REVIEW_EVIDENCE) throw sourceSchemaDrift();
  if (typeof contentId !== 'string' || !/^[1-9]\d*$/.test(contentId)) {
    throw typedError('SOURCE_ENDPOINT_FORBIDDEN', 'AniLife content binding must be a numeric public content id');
  }
  contentPageUrl(contentId);
  return Object.freeze({ contentId });
}

function bindingForTarget(bindings, targetKey) {
  if (!isPlainRecord(bindings) || typeof targetKey !== 'string' || !targetKey) throw sourceSchemaDrift();
  if (!Object.hasOwn(bindings, targetKey)) {
    if (targetKey in bindings) throw sourceSchemaDrift();
    return { found: false };
  }
  const binding = ownDataValue(bindings, targetKey);
  if (binding === undefined) throw sourceSchemaDrift();
  return { found: true, binding };
}

function unboundEnvelope({ target, clock }) {
  return Object.freeze({
    sourceId: 'anilife_public',
    targetKey: target.targetKey,
    sourceEntityId: 'UNBOUND',
    responseStatus: 0,
    fetchedAt: clock.now(),
    requestFingerprint: 'manual-binding:absent',
    parserVersion: PARSER_VERSION,
    payload: Object.freeze({ fieldState: 'NOT_FETCHED' }),
  });
}

/**
 * Creates an adapter restricted to one public sitemap membership check and one exact manually
 * bound content page per target. It never performs title discovery, API, archive, playback, or
 * comment requests.
 */
export function createAniLifePublicPageAdapter({ fetchImpl = globalThis.fetch } = {}) {
  if (typeof fetchImpl !== 'function') throw new TypeError('fetchImpl must be a function');
  const defaultHttp = createHttpClient({ fetchImpl });

  return Object.freeze({
    async *collect({ targets, http = defaultHttp, clock, bindings }) {
      if (!Array.isArray(targets) || !http || typeof http.request !== 'function' || !clock
        || typeof clock.now !== 'function') {
        throw sourceSchemaDrift();
      }
      const safeBindings = snapshotJsonRecord(bindings);
      for (const target of targets) {
        const foundBinding = bindingForTarget(safeBindings, target?.targetKey);
        if (!foundBinding.found) {
          yield unboundEnvelope({ target, clock });
          continue;
        }
        const { contentId } = validateAniLifeBinding(foundBinding.binding);
        const publicPageUrl = contentPageUrl(contentId);
        const sitemapResponse = await requestApprovedPublicPage(http, assertApprovedPublicUrl(SITEMAP_URL).href);
        const sitemap = await readSitemapBody(sitemapResponse);
        if (!sitemapHasContentUrl(sitemap, publicPageUrl)) throw sourceSchemaDrift();
        const contentResponse = await requestApprovedPublicPage(http, publicPageUrl);
        let html;
        try {
          html = await contentResponse.text();
        } catch {
          throw sourceSchemaDrift();
        }
        yield Object.freeze({
          sourceId: 'anilife_public',
          targetKey: target.targetKey,
          sourceEntityId: contentId,
          responseStatus: contentResponse.status,
          fetchedAt: clock.now(),
          requestFingerprint: `public-content:${contentId}`,
          parserVersion: PARSER_VERSION,
          payload: parseAllowedPayload(html, { contentId, publicPageUrl }),
        });
      }
    },
  });
}
