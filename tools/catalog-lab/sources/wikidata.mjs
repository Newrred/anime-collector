import { createHttpClient } from '../lib/http.mjs';
import { assertSourceEndpoint } from '../contracts/catalogContracts.mjs';

const WDQS_URL = 'https://query.wikidata.org/sparql';
const WIKIDATA_API_URL = 'https://www.wikidata.org/w/api.php';
const PARSER_VERSION = 'wikidata-p8729-v2';
const WDQS_ANILIST_BATCH_SIZE = 25;
const ENTITY_BATCH_SIZE = 50;
const LANGUAGES = Object.freeze(['ko', 'ja', 'en']);
const CLAIM_PROPERTIES = Object.freeze(['P8729', 'P856', 'P577', 'P136', 'P272']);
const DATAVALUE_TYPES = Object.freeze({
  P8729: 'string', P856: 'string', P577: 'time',
  P136: 'wikibase-entityid', P272: 'wikibase-entityid',
});
const WIKIDATA_DATATYPES = Object.freeze({
  P8729: 'external-id', P856: 'url', P577: 'time',
  P136: 'wikibase-item', P272: 'wikibase-item',
});

function sourceSchemaDrift() {
  const error = new Error('Wikidata response does not match the requested target schema');
  error.code = 'SOURCE_SCHEMA_DRIFT';
  return error;
}

function isPlainJsonRecord(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
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
    assertSourceEndpoint('wikidata', url.toString());
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
    assertSourceEndpoint('wikidata', url.toString());
    const body = await jsonResponse(await http.request({
      url: url.toString(), kind: 'DATA', init: { headers: requestHeaders(userAgent) },
    }));
    if (!isPlainJsonRecord(body?.entities)) throw sourceSchemaDrift();
    for (const qid of ids) {
      if (!Object.hasOwn(body.entities, qid)) throw sourceSchemaDrift();
      const entity = body.entities[qid];
      if (!isPlainJsonRecord(entity) || entity.id !== qid || !isPlainJsonRecord(entity.claims)) {
        throw sourceSchemaDrift();
      }
      entities.set(qid, entity);
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
  if (!isPlainJsonRecord(claims)) throw sourceSchemaDrift();
  const projected = {};
  for (const property of CLAIM_PROPERTIES) {
    if (!(property in claims)) continue;
    if (!Array.isArray(claims[property])) throw sourceSchemaDrift();
    projected[property] = claims[property].map((claim) => {
      const snak = claim?.mainsnak;
      if (!isPlainJsonRecord(claim) || !isPlainJsonRecord(snak)
        || !['value', 'novalue', 'somevalue'].includes(snak.snaktype)
        || snak.property !== property || snak.datatype !== WIKIDATA_DATATYPES[property]) {
        throw sourceSchemaDrift();
      }
      if (snak.snaktype !== 'value') {
        if (Object.hasOwn(snak, 'datavalue')) throw sourceSchemaDrift();
        return structuredClone(claim);
      }
      if (!isPlainJsonRecord(snak.datavalue)
        || snak.datavalue.type !== DATAVALUE_TYPES[property]
        || !Object.hasOwn(snak.datavalue, 'value')) throw sourceSchemaDrift();
      const value = snak.datavalue.value;
      const validValue = property === 'P8729' ? typeof value === 'string' && /^[1-9]\d*$/u.test(value)
        : property === 'P856' ? typeof value === 'string'
          : property === 'P577' ? isPlainJsonRecord(value)
            && typeof value.time === 'string' && Number.isInteger(value.precision)
            : isPlainJsonRecord(value) && typeof value.id === 'string'
              && /^Q[1-9]\d*$/u.test(value.id);
      if (!validValue) throw sourceSchemaDrift();
      return structuredClone(claim);
    });
  }
  return projected;
}

function projectSitelinks(sitelinks) {
  if (!sitelinks || typeof sitelinks !== 'object') return {};
  return Object.fromEntries(Object.entries(sitelinks)
    .filter(([, sitelink]) => sitelink && typeof sitelink.site === 'string' && typeof sitelink.title === 'string')
    .map(([key, sitelink]) => [key, { site: sitelink.site, title: sitelink.title }]));
}

function hasExactP8729(claims, anilistId) {
  return Array.isArray(claims?.P8729) && claims.P8729.some((claim) => (
    claim.mainsnak.snaktype === 'value' && claim.mainsnak.datavalue.value === anilistId
  ));
}

function sourceNotAvailableEnvelope({ target, anilistId, clock }) {
  return Object.freeze({
    sourceId: 'wikidata',
    targetKey: target.targetKey,
    sourceEntityId: `P8729:${anilistId}`,
    responseStatus: 404,
    fetchedAt: clock.now(),
    requestFingerprint: `p8729:${anilistId}`,
    parserVersion: PARSER_VERSION,
    payload: Object.freeze({ errorCode: 'SOURCE_NOT_AVAILABLE', externalIds: { anilist: anilistId } }),
  });
}

function sourceEnvelope({ target, anilistId, qid, entity, claims, clock }) {
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
      claims,
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
        const claims = entity ? projectClaims(entity.claims) : null;
        if (!qid || !entity || !hasExactP8729(claims, anilistId)) {
          yield sourceNotAvailableEnvelope({ target, anilistId, clock });
          continue;
        }
        yield sourceEnvelope({ target, anilistId, qid, entity, claims, clock });
      }
    },
  });
}

export { CLAIM_PROPERTIES, ENTITY_BATCH_SIZE, LANGUAGES, PARSER_VERSION, WDQS_ANILIST_BATCH_SIZE, buildP8729Query };
