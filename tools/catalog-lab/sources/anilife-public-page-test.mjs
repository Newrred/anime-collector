import { createHttpClient } from '../lib/http.mjs';

const ANILIFE_ORIGIN = 'https://anilife1.tv';
const SITEMAP_URL = `${ANILIFE_ORIGIN}/sitemap.xml`;
const PARSER_VERSION = 'anilife-public-page-test-v1';
const MANUAL_REVIEW_EVIDENCE = 'MANUAL_PUBLIC_PAGE_REVIEW';
const ALLOWED_JSON_LD_TYPES = new Set(['TVSeries', 'Movie', 'VideoObject']);

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

function textValue(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function episodeCount(value) {
  if (Number.isInteger(value) && value > 0) return value;
  if (typeof value === 'string' && /^[1-9]\d*$/.test(value)) return Number(value);
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

function openGraphValue(html, property) {
  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    const attributes = parseAttributes(match[0]);
    if (attributes.property?.toLowerCase() === property) return textValue(attributes.content);
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
  for (const match of xml.matchAll(/<loc\b[^>]*>([\s\S]*?)<\/loc\s*>/gi)) {
    try {
      if (assertApprovedPublicUrl(match[1].trim()).href === publicPageUrl) return true;
    } catch {
      // Sitemap entries outside the narrow public allowlist are never followed.
    }
  }
  return false;
}

async function requestApprovedPublicPage(http, url) {
  assertApprovedPublicUrl(url);
  return http.request({ url, kind: 'DATA' });
}

/**
 * Validates one manually reviewed local binding. Content discovery and free-text lookup are
 * deliberately unsupported: this adapter accepts only a numeric, reviewed content id.
 */
export function validateAniLifeBinding(binding) {
  if (!binding || typeof binding !== 'object' || binding.evidence !== MANUAL_REVIEW_EVIDENCE) {
    throw sourceSchemaDrift();
  }
  if (typeof binding.contentId !== 'string' || !/^[1-9]\d*$/.test(binding.contentId)) {
    throw typedError('SOURCE_ENDPOINT_FORBIDDEN', 'AniLife content binding must be a numeric public content id');
  }
  contentPageUrl(binding.contentId);
  return Object.freeze({ contentId: binding.contentId });
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
        || typeof clock.now !== 'function' || !bindings || typeof bindings !== 'object') {
        throw sourceSchemaDrift();
      }
      for (const target of targets) {
        const binding = bindings[target?.targetKey];
        if (!binding) {
          yield unboundEnvelope({ target, clock });
          continue;
        }
        const { contentId } = validateAniLifeBinding(binding);
        const publicPageUrl = contentPageUrl(contentId);
        const sitemapResponse = await requestApprovedPublicPage(http, assertApprovedPublicUrl(SITEMAP_URL).href);
        let sitemap;
        try {
          sitemap = await sitemapResponse.text();
        } catch {
          throw sourceSchemaDrift();
        }
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
