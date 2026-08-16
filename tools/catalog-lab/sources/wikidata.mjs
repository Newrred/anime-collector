import { createHttpClient } from '../lib/http.mjs';

const WDQS_URL = 'https://query.wikidata.org/sparql';
const WIKIDATA_API_URL = 'https://www.wikidata.org/w/api.php';
const PARSER_VERSION = 'wikidata-p8729-v1';
const WDQS_ANILIST_BATCH_SIZE = 25;
const ENTITY_BATCH_SIZE = 50;
const LANGUAGES = Object.freeze(['ko', 'ja', 'en']);
const CLAIM_PROPERTIES = Object.freeze(['P8729', 'P856', 'P577', 'P136', 'P272']);

function sourceSchemaDrift() {
  const error = new Error('Wikidata response does not match the requested target schema');
  error.code = 'SOURCE_SCHEMA_DRIFT';
  return error;
}

function targetAniListId(target) {
  const value = target?.seedExternalIds?.find((id) => id?.sourceId === 'anilist')?.value;
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) throw sourceSchemaDrift();
  return value;
}

function chunks(values, size) {
  const result = [];
  for (let index = 0; index < values.length; index += size) result.push(values.slice(index, index + size));
  return result;
}

function buildP8729Query(anilistIds) {
  const values = anilistIds.map((id) => `"${id}"`).join(' ');
  return `SELECT ?item ?anilistId WHERE {\n  VALUES ?anilistId { ${values} }\n  ?item wdt:P8729 ?anilistId .\n}`;
}

function requestHeaders(userAgent) {
  return { accept: 'application/json', 'user-agent': userAgent };
}

async function jsonResponse(response) {
  try {
    return await response.json();
  } catch {
    throw sourceSchemaDrift();
  }
}

async function fetchMappings({ http, userAgent, anilistIds }) {
  const mappings = new Map();
  for (const ids of chunks(anilistIds, WDQS_ANILIST_BATCH_SIZE)) {
    const url = new URL(WDQS_URL);
    url.searchParams.set('query', buildP8729Query(ids));
    url.searchParams.set('format', 'json');
    const body = await jsonResponse(await http.request({
      url: url.toString(), kind: 'DATA', init: { headers: requestHeaders(userAgent) },
    }));
    if (!Array.isArray(body?.results?.bindings)) throw sourceSchemaDrift();
    const requested = new Set(ids);
    for (const binding of body.results.bindings) {
      const anilistId = binding?.anilistId?.value;
      const item = binding?.item?.value;
      const qid = typeof item === 'string' ? item.match(/^https?:\/\/www\.wikidata\.org\/entity\/(Q[1-9]\d*)$/)?.[1] : null;
      if (typeof anilistId !== 'string' || !requested.has(anilistId) || !qid) throw sourceSchemaDrift();
      const current = mappings.get(anilistId);
      if (current && current !== qid) throw sourceSchemaDrift();
      mappings.set(anilistId, qid);
    }
  }
  return mappings;
}

async function fetchEntities({ http, userAgent, qids }) {
  const entities = new Map();
  for (const ids of chunks(qids, ENTITY_BATCH_SIZE)) {
    const url = new URL(WIKIDATA_API_URL);
    url.searchParams.set('action', 'wbgetentities');
    url.searchParams.set('ids', ids.join('|'));
    url.searchParams.set('props', 'labels|aliases|claims|sitelinks');
    url.searchParams.set('languages', LANGUAGES.join('|'));
    url.searchParams.set('format', 'json');
    const body = await jsonResponse(await http.request({
      url: url.toString(), kind: 'DATA', init: { headers: requestHeaders(userAgent) },
    }));
    if (!body?.entities || typeof body.entities !== 'object') throw sourceSchemaDrift();
    for (const qid of ids) {
      const entity = body.entities[qid];
      if (entity && typeof entity === 'object' && entity.id === qid) entities.set(qid, entity);
    }
  }
  return entities;
}

function projectLanguageValues(values, isAliases = false) {
  if (!values || typeof values !== 'object') return {};
  const projected = {};
  for (const language of LANGUAGES) {
    const value = values[language];
    if (isAliases) {
      if (Array.isArray(value)) {
        const aliases = value
          .filter((entry) => entry?.language === language && typeof entry.value === 'string')
          .map((entry) => entry.value);
        if (aliases.length > 0) projected[language] = aliases;
      }
    } else if (value?.language === language && typeof value.value === 'string') {
      projected[language] = value.value;
    }
  }
  return projected;
}

function projectClaims(claims) {
  if (!claims || typeof claims !== 'object') return {};
  return Object.fromEntries(CLAIM_PROPERTIES
    .filter((property) => Array.isArray(claims[property]))
    .map((property) => [property, structuredClone(claims[property])]));
}

function projectSitelinks(sitelinks) {
  if (!sitelinks || typeof sitelinks !== 'object') return {};
  return Object.fromEntries(Object.entries(sitelinks)
    .filter(([, sitelink]) => sitelink && typeof sitelink.site === 'string' && typeof sitelink.title === 'string')
    .map(([key, sitelink]) => [key, { site: sitelink.site, title: sitelink.title }]));
}

function hasExactP8729(entity, anilistId) {
  return Array.isArray(entity?.claims?.P8729) && entity.claims.P8729.some((claim) => (
    claim?.mainsnak?.datavalue?.value === anilistId
  ));
}

function sourceNotAvailableEnvelope({ target, anilistId, clock, qid }) {
  return Object.freeze({
    sourceId: 'wikidata',
    targetKey: target.targetKey,
    sourceEntityId: qid ?? `P8729:${anilistId}`,
    responseStatus: 404,
    fetchedAt: clock.now(),
    requestFingerprint: `p8729:${anilistId}`,
    parserVersion: PARSER_VERSION,
    payload: Object.freeze({ errorCode: 'SOURCE_NOT_AVAILABLE', externalIds: { anilist: anilistId } }),
  });
}

function sourceEnvelope({ target, anilistId, qid, entity, clock }) {
  return Object.freeze({
    sourceId: 'wikidata',
    targetKey: target.targetKey,
    sourceEntityId: qid,
    responseStatus: 200,
    fetchedAt: clock.now(),
    requestFingerprint: `p8729:${anilistId};entity:${qid}`,
    parserVersion: PARSER_VERSION,
    payload: Object.freeze({
      externalIds: { anilist: anilistId },
      labels: projectLanguageValues(entity.labels),
      aliases: projectLanguageValues(entity.aliases, true),
      claims: projectClaims(entity.claims),
      sitelinks: projectSitelinks(entity.sitelinks),
    }),
  });
}

/**
 * Creates a Wikidata adapter that maps only exact AniList P8729 identifiers before loading
 * the known entities. It deliberately contains no title-search endpoint or fallback.
 */
export function createWikidataAdapter({ userAgent, fetchImpl = globalThis.fetch } = {}) {
  if (typeof userAgent !== 'string' || !userAgent.trim()) throw new TypeError('userAgent must be a non-empty string');
  if (typeof fetchImpl !== 'function') throw new TypeError('fetchImpl must be a function');
  const defaultHttp = createHttpClient({ fetchImpl });

  return Object.freeze({
    async *collect({ targets, http = defaultHttp, clock }) {
      if (!Array.isArray(targets) || !http || typeof http.request !== 'function' || !clock
        || typeof clock.now !== 'function') throw sourceSchemaDrift();
      const rows = targets.map((target) => ({ target, anilistId: targetAniListId(target) }));
      const anilistIds = [...new Set(rows.map(({ anilistId }) => anilistId))];
      const mappings = await fetchMappings({ http, userAgent, anilistIds });
      const qids = [...new Set([...mappings.values()])];
      const entities = qids.length === 0 ? new Map() : await fetchEntities({ http, userAgent, qids });

      for (const { target, anilistId } of rows) {
        const qid = mappings.get(anilistId);
        const entity = qid ? entities.get(qid) : undefined;
        if (!qid || !entity || !hasExactP8729(entity, anilistId)) {
          yield sourceNotAvailableEnvelope({ target, anilistId, clock, qid });
          continue;
        }
        yield sourceEnvelope({ target, anilistId, qid, entity, clock });
      }
    },
  });
}

export { CLAIM_PROPERTIES, ENTITY_BATCH_SIZE, LANGUAGES, PARSER_VERSION, WDQS_ANILIST_BATCH_SIZE, buildP8729Query };
