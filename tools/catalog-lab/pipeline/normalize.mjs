import { sha256, stableStringify } from '../lib/hash.mjs';
import { toPathKey } from '../lib/path-key.mjs';
import genreConfig from '../config/core-genre-map.json' with { type: 'json' };

export const FIELD_STATES = Object.freeze([
  'VALUE', 'SOURCE_NOT_AVAILABLE', 'NOT_FETCHED', 'CONFLICTED',
]);
export const FORMAT_VALUES = Object.freeze([
  'TV', 'MOVIE', 'OVA', 'ONA', 'SPECIAL', 'MUSIC', 'WEB_SHORT', 'OTHER', 'UNKNOWN',
]);
export const STATUS_VALUES = Object.freeze([
  'ANNOUNCED', 'UPCOMING', 'AIRING', 'FINISHED', 'PAUSED', 'CANCELLED', 'UNKNOWN',
]);
export const SEASON_VALUES = Object.freeze(['WINTER', 'SPRING', 'SUMMER', 'FALL']);
export const SOURCE_MATERIAL_VALUES = Object.freeze([
  'ORIGINAL', 'MANGA', 'LIGHT_NOVEL', 'NOVEL', 'WEB_NOVEL', 'GAME', 'VISUAL_NOVEL',
  'WEBTOON', 'OTHER', 'MIXED', 'UNKNOWN',
]);
export const RELATION_VALUES = Object.freeze([
  'SEQUEL', 'PREQUEL', 'SIDE_STORY', 'SPIN_OFF', 'ADAPTATION', 'REMAKE', 'RECAP',
  'ALTERNATIVE_VERSION', 'SHARED_UNIVERSE', 'CHARACTER_CROSSOVER', 'OTHER',
]);
export const STUDIO_ROLE_VALUES = Object.freeze([
  'ANIMATION_PRODUCTION', 'CO_PRODUCTION', 'PRODUCTION_ASSISTANCE', 'PLANNING',
  'PRODUCTION_COMMITTEE', 'DISTRIBUTOR', 'BROADCASTER', 'OTHER',
]);
export const CANONICAL_FIELD_PATHS = Object.freeze([
  'externalIds', 'titles', 'format', 'status', 'season', 'startDate', 'endDate',
  'episodeCount', 'sourceMaterialType', 'officialSiteUrl', 'studios', 'relations',
  'sourceGenres', 'coreGenres', 'characters', 'castings', 'cover',
]);
export const COLLECTION_FIELD_PATHS = Object.freeze([
  'externalIds', 'titles', 'studios', 'relations', 'sourceGenres', 'coreGenres',
  'characters', 'castings',
]);

function configError() {
  const error = new Error('Catalog normalization configuration is invalid');
  error.code = 'CATALOG_CONFIG_INVALID';
  return error;
}

function validateGenreConfig(config) {
  if (!isPlainRecord(config) || config.status !== 'TEST_ONLY' || !Array.isArray(config.genres)
    || config.genres.length !== 13 || new Set(config.genres).size !== config.genres.length
    || !config.genres.every((genre) => typeof genre === 'string' && genre)
    || !isPlainRecord(config.mappings)
    || Object.entries(config.mappings).some(([raw, mapped]) => !raw || !config.genres.includes(mapped))) {
    throw configError();
  }
}

validateGenreConfig(genreConfig);
export const CORE_GENRES = Object.freeze([...genreConfig.genres]);
const CORE_GENRE_MAP = Object.freeze({ ...genreConfig.mappings });

const FORMAT_MAP = Object.freeze({
  TV: 'TV', TV_SHORT: 'WEB_SHORT', MOVIE: 'MOVIE', OVA: 'OVA', ONA: 'ONA',
  SPECIAL: 'SPECIAL', MUSIC: 'MUSIC', WEB: 'WEB_SHORT', WEB_SHORT: 'WEB_SHORT', OTHER: 'OTHER',
});
const STATUS_MAP = Object.freeze({
  ANNOUNCED: 'ANNOUNCED', NOT_YET_RELEASED: 'UPCOMING', UPCOMING: 'UPCOMING',
  RELEASING: 'AIRING', AIRING: 'AIRING', FINISHED: 'FINISHED', HIATUS: 'PAUSED',
  PAUSED: 'PAUSED', CANCELLED: 'CANCELLED',
});
const SOURCE_MATERIAL_MAP = Object.freeze({
  ORIGINAL: 'ORIGINAL', MANGA: 'MANGA', LIGHT_NOVEL: 'LIGHT_NOVEL', NOVEL: 'NOVEL',
  WEB_NOVEL: 'WEB_NOVEL', GAME: 'GAME', VIDEO_GAME: 'GAME', VISUAL_NOVEL: 'VISUAL_NOVEL',
  WEBTOON: 'WEBTOON', OTHER: 'OTHER', MIXED: 'MIXED', MULTIMEDIA_PROJECT: 'MIXED',
});
const RELATION_MAP = Object.freeze({
  SEQUEL: 'SEQUEL', PREQUEL: 'PREQUEL', SIDE_STORY: 'SIDE_STORY', SPIN_OFF: 'SPIN_OFF',
  ADAPTATION: 'ADAPTATION', REMAKE: 'REMAKE', RECAP: 'RECAP',
  ALTERNATIVE: 'ALTERNATIVE_VERSION', ALTERNATIVE_VERSION: 'ALTERNATIVE_VERSION',
  SUMMARY: 'RECAP', CHARACTER: 'CHARACTER_CROSSOVER',
  SHARED_CHARACTER: 'CHARACTER_CROSSOVER', CHARACTER_CROSSOVER: 'CHARACTER_CROSSOVER',
  OTHER: 'OTHER',
});
const SOURCE_RECORD_KEYS = Object.freeze([
  'fetchStatus', 'fetchedAt', 'parserVersion', 'payload', 'payloadHash', 'rawPayloadRef',
  'requestFingerprint', 'responseStatus', 'sourceEntityId', 'sourceId', 'sourceRecordId', 'targetKey',
]);
const ANILIST_KEYS = Object.freeze([
  'characters', 'coverImage', 'endDate', 'episodes', 'externalLinks', 'format', 'genres', 'id',
  'idMal', 'relations', 'season', 'seasonYear', 'source', 'startDate', 'status', 'studios',
  'synonyms', 'title',
]);
const WIKIDATA_KEYS = Object.freeze(['aliases', 'claims', 'externalIds', 'labels', 'sitelinks']);
const ANILIFE_KEYS = Object.freeze([
  'alternateName', 'contentId', 'datePublished', 'imageUrl', 'numberOfEpisodes', 'publicPageUrl',
  'identityEvidence', 'title',
]);
const ANILIFE_IDENTITY_EVIDENCE_KEYS = Object.freeze([
  'candidateCountBasis', 'contentId', 'evidenceHash', 'exactTitleCandidateCount',
  'reviewReference', 'reviewedAt', 'reviewedBy', 'ruleId', 'targetKey', 'version',
]);
const WIKIDATA_PROPERTIES = new Set(['P8729', 'P856', 'P577', 'P136', 'P272']);

function typedError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function schemaError() {
  return typedError('SOURCE_SCHEMA_DRIFT', 'SourceRecord does not match its approved source schema');
}

export function isPlainRecord(value) {
  try {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    const descriptors = Object.getOwnPropertyDescriptors(value);
    return Reflect.ownKeys(value).every((key) => typeof key === 'string')
      && (prototype === Object.prototype || prototype === null)
      && Object.values(descriptors).every((descriptor) => 'value' in descriptor);
  } catch {
    return false;
  }
}

function hasExactKeys(value, keys) {
  return isPlainRecord(value)
    && stableStringify(Object.keys(value).sort()) === stableStringify([...keys].sort());
}

function hasOnlyKeys(value, keys) {
  return isPlainRecord(value) && Object.keys(value).every((key) => keys.includes(key));
}

function deepFreeze(value, seen = new Set()) {
  if (value === null || typeof value !== 'object' || seen.has(value)) return value;
  seen.add(value);
  for (const child of Object.values(value)) deepFreeze(child, seen);
  return Object.freeze(value);
}

export function deepFrozenSnapshot(value, {
  code = 'SOURCE_SCHEMA_DRIFT', message = 'SourceRecord does not match its approved source schema',
} = {}) {
  let snapshot;
  try {
    if (!jsonSafe(value)) throw new TypeError('Value must be plain JSON data');
    snapshot = structuredClone(value);
    return deepFreeze(snapshot);
  } catch {
    throw typedError(code, message);
  }
}

function jsonSafe(value, ancestors = new Set()) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value !== 'object' || ancestors.has(value)) return false;
  ancestors.add(value);
  let valid;
  if (Array.isArray(value)) {
    let descriptors;
    try {
      descriptors = Object.getOwnPropertyDescriptors(value);
    } catch {
      ancestors.delete(value);
      return false;
    }
    valid = Reflect.ownKeys(value).every((key) => typeof key === 'string')
      && Object.keys(value).length === value.length
      && Object.entries(descriptors).every(([key, descriptor]) => key === 'length' || ('value' in descriptor && /^\d+$/u.test(key)))
      && Object.keys(value).every((key) => jsonSafe(descriptors[key].value, ancestors));
  } else {
    valid = isPlainRecord(value) && Object.values(Object.getOwnPropertyDescriptors(value))
      .every((descriptor) => jsonSafe(descriptor.value, ancestors));
  }
  ancestors.delete(value);
  return valid;
}

export function normalizeText(value) {
  if (typeof value !== 'string') return null;
  const normalized = value.normalize('NFKC').trim();
  return normalized || null;
}

export function isExactIsoTimestamp(value) {
  if (typeof value !== 'string'
    || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value)) return false;
  try {
    return new Date(value).toISOString() === value;
  } catch {
    return false;
  }
}

export function isAniLifeIdentityEvidence(value, { targetKey, contentId } = {}) {
  if (!hasExactKeys(value, ANILIFE_IDENTITY_EVIDENCE_KEYS)) return false;
  const { evidenceHash, ...content } = value;
  return value.version === 'ANILIFE_IDENTITY_EVIDENCE_V1'
    && value.targetKey === targetKey
    && value.contentId === contentId
    && value.ruleId === 'EXACT_TITLE_CANDIDATE_COUNT_V1'
    && value.candidateCountBasis === 'MANUAL_EXACT_TITLE_CANDIDATE_REVIEW'
    && Number.isSafeInteger(value.exactTitleCandidateCount)
    && value.exactTitleCandidateCount >= 1
    && isExactIsoTimestamp(value.reviewedAt)
    && typeof value.reviewedBy === 'string' && Boolean(value.reviewedBy.trim())
    && typeof value.reviewReference === 'string' && Boolean(value.reviewReference.trim())
    && /^[a-f0-9]{64}$/u.test(evidenceHash)
    && evidenceHash === sha256(content);
}

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function safeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function safeYear(value) {
  const year = typeof value === 'string' && /^\d{4}$/.test(value) ? Number(value) : value;
  return Number.isInteger(year) && year >= 1000 && year <= 9999 ? year : null;
}

function stringId(value) {
  if ((typeof value !== 'string' && typeof value !== 'number') || value === '') return null;
  const result = String(value);
  return /^(?:[1-9]\d*|Q[1-9]\d*)$/.test(result) && Number.isSafeInteger(Number(result.replace(/^Q/, '')))
    ? result : null;
}

function enumValue(value, map, fallback = 'UNKNOWN') {
  return typeof value === 'string' ? (map[value] ?? fallback) : fallback;
}

function normalizedDate(value) {
  let year;
  let month;
  let day;
  if (typeof value === 'string') {
    const plain = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    const wikidata = value.match(/^\+(\d{4})-(\d{2})-(\d{2})T\d{2}:\d{2}:\d{2}Z$/);
    const match = plain ?? wikidata;
    if (!match) return null;
    [, year, month, day] = match;
  } else if (isPlainRecord(value)) {
    ({ year, month, day } = value);
    if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
    year = String(year).padStart(4, '0');
    month = String(month).padStart(2, '0');
    day = String(day).padStart(2, '0');
  } else return null;
  const iso = `${year}-${month}-${day}`;
  const date = new Date(`${iso}T00:00:00.000Z`);
  return Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== iso ? null : iso;
}

function normalizedHttpUrl(value) {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
    url.hash = '';
    return url.href;
  } catch {
    return null;
  }
}

function rawYearEvidence(value) {
  if (typeof value !== 'string') return null;
  const match = value.match(/^(\d{4})(?:-\d{2}-\d{2})?$/);
  return match ? safeYear(match[1]) : null;
}

function uniqueEntries(entries, fieldPath) {
  const groups = new Map();
  for (const entry of entries) {
    const key = stableStringify(entry.normalizedValue);
    const existing = groups.get(key);
    if (!existing) groups.set(key, { ...entry, rawValues: [entry.rawValue], statuses: [entry.status] });
    else {
      existing.rawValues.push(entry.rawValue);
      existing.statuses.push(entry.status);
    }
  }
  return [...groups.values()].map(({ rawValues, statuses, ...entry }) => {
    const uniqueRaw = [...new Map(rawValues.map((raw) => [stableStringify(raw), raw])).values()]
      .sort((left, right) => compareText(stableStringify(left), stableStringify(right)));
    const status = statuses.includes('SOURCE_NOT_AVAILABLE') ? 'SOURCE_NOT_AVAILABLE'
      : statuses.includes('NOT_FETCHED') ? 'NOT_FETCHED' : 'VALUE';
    return { ...entry, status, rawValue: uniqueRaw.length === 1 ? uniqueRaw[0] : uniqueRaw };
  }).sort((left, right) => {
    if (fieldPath === 'titles') {
      const localeOrder = ['ja-Latn', 'ja', 'en', 'und'];
      const leftRank = localeOrder.indexOf(left.normalizedValue.locale);
      const rightRank = localeOrder.indexOf(right.normalizedValue.locale);
      const ranked = compareText(leftRank < 0 ? Number.MAX_SAFE_INTEGER : leftRank,
        rightRank < 0 ? Number.MAX_SAFE_INTEGER : rightRank);
      if (ranked) return ranked;
    }
    return compareText(stableStringify(left.normalizedValue), stableStringify(right.normalizedValue))
      || compareText(stableStringify(left.rawValue), stableStringify(right.rawValue));
  });
}

function titleEntry(locale, rawValue) {
  const value = normalizeText(rawValue);
  return value ? { rawValue: { locale, value: rawValue }, normalizedValue: { locale, value } } : null;
}

function textEntry(rawValue) {
  const normalizedValue = normalizeText(rawValue);
  return normalizedValue === null ? null : { rawValue, normalizedValue };
}

function requireArray(value, validator = () => true) {
  if (!Array.isArray(value) || !value.every(validator)) throw schemaError();
}

function optionalString(value) {
  return value === null || value === undefined || typeof value === 'string';
}

function validateName(value) {
  return hasOnlyKeys(value, ['full', 'native', 'alternative'])
    && optionalString(value.full) && optionalString(value.native)
    && (value.alternative === undefined || (Array.isArray(value.alternative)
      && value.alternative.every((entry) => typeof entry === 'string')));
}

function validateAniListPayload(record) {
  const payload = record.payload;
  if (!hasExactKeys(payload, ANILIST_KEYS) || !Number.isSafeInteger(payload.id) || payload.id < 1
    || String(payload.id) !== record.sourceEntityId
    || !hasOnlyKeys(payload.title, ['romaji', 'english', 'native'])
    || !['romaji', 'english', 'native'].every((key) => optionalString(payload.title[key]))) throw schemaError();
  requireArray(payload.synonyms, (value) => typeof value === 'string');
  requireArray(payload.genres, (value) => typeof value === 'string');
  requireArray(payload.externalLinks, (link) => hasOnlyKeys(link, ['id', 'site', 'url', 'type'])
    && (link.id === undefined || (Number.isSafeInteger(link.id) && link.id > 0)) && optionalString(link.site)
    && optionalString(link.url) && optionalString(link.type));
  if (!hasOnlyKeys(payload.coverImage, ['extraLarge', 'large', 'medium']) || !['extraLarge', 'large', 'medium']
    .every((key) => optionalString(payload.coverImage[key]))) throw schemaError();
  if (!hasExactKeys(payload.studios, ['nodes'])) throw schemaError();
  requireArray(payload.studios.nodes, (studio) => hasExactKeys(studio, ['id', 'isAnimationStudio', 'name'])
    && Number.isSafeInteger(studio.id) && studio.id > 0 && typeof studio.name === 'string'
    && typeof studio.isAnimationStudio === 'boolean');
  if (!hasExactKeys(payload.relations, ['edges'])) throw schemaError();
  requireArray(payload.relations.edges, (edge) => hasExactKeys(edge, ['node', 'relationType'])
    && typeof edge.relationType === 'string'
    && hasExactKeys(edge.node, ['format', 'id', 'title', 'type'])
    && Number.isSafeInteger(edge.node.id) && edge.node.id > 0 && optionalString(edge.node.type)
    && optionalString(edge.node.format) && hasOnlyKeys(edge.node.title, ['romaji', 'english', 'native'])
    && ['romaji', 'english', 'native'].every((key) => optionalString(edge.node.title[key])));
  requireArray(payload.characters, (edge) => hasExactKeys(edge, ['node', 'role', 'voiceActors'])
    && typeof edge.role === 'string' && hasExactKeys(edge.node, ['id', 'name'])
    && Number.isSafeInteger(edge.node.id) && edge.node.id > 0
    && validateName(edge.node.name) && Array.isArray(edge.voiceActors)
    && edge.voiceActors.every((actor) => hasExactKeys(actor, ['id', 'language', 'name'])
      && Number.isSafeInteger(actor.id)
      && actor.id > 0 && typeof actor.language === 'string' && validateName(actor.name)));
  for (const date of [payload.startDate, payload.endDate]) {
    if (!hasOnlyKeys(date, ['year', 'month', 'day']) || !['year', 'month', 'day'].every((key) => (
      date[key] === null || date[key] === undefined || Number.isInteger(date[key])
    ))) throw schemaError();
  }
  if (!optionalString(payload.format) || !optionalString(payload.status) || !optionalString(payload.season)
    || !optionalString(payload.source) || (payload.seasonYear !== null && payload.seasonYear !== undefined
      && safeYear(payload.seasonYear) === null) || (payload.episodes !== null && payload.episodes !== undefined
      && safeInteger(payload.episodes) === null)) throw schemaError();
}

function wikidataSnaks(payload, property) {
  const rows = payload.claims[property] ?? [];
  const typeByProperty = {
    P8729: 'string', P856: 'string', P577: 'time',
    P136: 'wikibase-entityid', P272: 'wikibase-entityid',
  };
  requireArray(rows, (claim) => {
    if (!isPlainRecord(claim) || !isPlainRecord(claim.mainsnak)
      || !['value', 'novalue', 'somevalue'].includes(claim.mainsnak.snaktype)) return false;
    if (claim.mainsnak.snaktype !== 'value') return !Object.hasOwn(claim.mainsnak, 'datavalue');
    return hasExactKeys(claim.mainsnak.datavalue, ['type', 'value'])
      && claim.mainsnak.datavalue.type === typeByProperty[property];
  });
  return rows.map((claim) => ({
    snaktype: claim.mainsnak.snaktype,
    mainsnak: claim.mainsnak,
    ...(claim.mainsnak.snaktype === 'value' ? { value: claim.mainsnak.datavalue.value } : {}),
  }));
}

function validateWikidataPayload(record) {
  const payload = record.payload;
  if (!hasExactKeys(payload, WIKIDATA_KEYS) || !/^Q[1-9]\d*$/.test(record.sourceEntityId)
    || !hasExactKeys(payload.externalIds, ['anilist']) || !isPlainRecord(payload.labels)
    || !isPlainRecord(payload.aliases) || !isPlainRecord(payload.claims) || !isPlainRecord(payload.sitelinks)
    || Object.keys(payload.labels).some((locale) => !['ko', 'ja', 'en'].includes(locale))
    || Object.keys(payload.aliases).some((locale) => !['ko', 'ja', 'en'].includes(locale))
    || Object.values(payload.sitelinks).some((value) => !hasExactKeys(value, ['site', 'title'])
      || typeof value.site !== 'string' || typeof value.title !== 'string')
    || Object.keys(payload.claims).some((property) => !WIKIDATA_PROPERTIES.has(property))) throw schemaError();
  const anilistId = payload.externalIds.anilist;
  if (typeof anilistId !== 'string' || !/^[1-9]\d*$/.test(anilistId)
    || anilistId !== targetAniListId(record.targetKey)) throw schemaError();
  const p8729 = wikidataSnaks(payload, 'P8729')
    .filter((snak) => snak.snaktype === 'value').map((snak) => snak.value);
  if (p8729.length === 0 || p8729.some((value) => value !== anilistId)) throw schemaError();
  const valueShapeByProperty = {
    P8729: (value) => typeof value === 'string' && /^[1-9]\d*$/u.test(value),
    P856: (value) => typeof value === 'string',
    P577: (value) => isPlainRecord(value) && typeof value.time === 'string'
      && Number.isInteger(value.precision),
    P136: (value) => isPlainRecord(value) && typeof value.id === 'string'
      && /^Q[1-9]\d*$/u.test(value.id),
    P272: (value) => isPlainRecord(value) && typeof value.id === 'string'
      && /^Q[1-9]\d*$/u.test(value.id),
  };
  for (const value of Object.values(payload.labels)) if (typeof value !== 'string') throw schemaError();
  for (const value of Object.values(payload.aliases)) requireArray(value, (entry) => typeof entry === 'string');
  for (const property of Object.keys(payload.claims)) {
    if (!wikidataSnaks(payload, property).filter((snak) => snak.snaktype === 'value')
      .every((snak) => valueShapeByProperty[property](snak.value))) throw schemaError();
  }
}

function validateAniLifePayload(record) {
  const payload = record.payload;
  if (!hasExactKeys(payload, ANILIFE_KEYS) || typeof payload.contentId !== 'string'
    || !/^[1-9]\d*$/.test(payload.contentId) || payload.contentId !== record.sourceEntityId
    || !optionalString(payload.title) || !optionalString(payload.alternateName)
    || !optionalString(payload.datePublished) || !optionalString(payload.imageUrl)
    || !optionalString(payload.publicPageUrl) || (payload.numberOfEpisodes !== null
      && payload.numberOfEpisodes !== undefined && safeInteger(payload.numberOfEpisodes) === null)
    || !(payload.identityEvidence === null || isAniLifeIdentityEvidence(payload.identityEvidence, {
      targetKey: record.targetKey, contentId: record.sourceEntityId,
    }))) throw schemaError();
}

function targetAniListId(targetKey) {
  return typeof targetKey === 'string' ? targetKey.match(/^ANILIST:([1-9]\d*)$/)?.[1] ?? null : null;
}

function sourceAbsenceState(record) {
  const targetId = targetAniListId(record.targetKey);
  if (record.sourceId === 'wikidata' && record.responseStatus === 404
    && record.fetchStatus === 'FAILED_PERMANENT' && record.sourceEntityId === `P8729:${targetId}`
    && hasExactKeys(record.payload, ['errorCode', 'externalIds'])
    && record.payload.errorCode === 'SOURCE_NOT_AVAILABLE'
    && isPlainRecord(record.payload.externalIds)
    && record.payload.externalIds.anilist === targetId) return 'SOURCE_NOT_AVAILABLE';
  if (record.sourceId === 'anilife_public' && record.responseStatus === 0
    && record.fetchStatus === 'FAILED_PERMANENT' && record.sourceEntityId === 'UNBOUND'
    && hasExactKeys(record.payload, ['fieldState']) && record.payload.fieldState === 'NOT_FETCHED') {
    return 'NOT_FETCHED';
  }
  return null;
}

function validateSourceRecord(record) {
  if (!hasExactKeys(record, SOURCE_RECORD_KEYS) || !/^[a-f0-9]{64}$/.test(record.sourceRecordId)
    || !/^[a-f0-9]{64}$/.test(record.payloadHash) || typeof record.targetKey !== 'string'
    || typeof record.sourceId !== 'string' || typeof record.sourceEntityId !== 'string'
    || !isExactIsoTimestamp(record.fetchedAt)
    || typeof record.requestFingerprint !== 'string' || !record.requestFingerprint
    || typeof record.parserVersion !== 'string' || !record.parserVersion
    || typeof record.rawPayloadRef !== 'string' || !record.rawPayloadRef
    || !Number.isInteger(record.responseStatus) || !isPlainRecord(record.payload)) throw schemaError();
  if (sha256(record.payload) !== record.payloadHash) {
    throw typedError('SOURCE_RECORD_INTEGRITY_INVALID', 'SourceRecord payload hash is invalid');
  }
  const expectedId = sha256({
    sourceId: record.sourceId,
    targetKey: record.targetKey,
    sourceEntityId: record.sourceEntityId,
    responseStatus: record.responseStatus,
    requestFingerprint: record.requestFingerprint,
    parserVersion: record.parserVersion,
    payload: record.payload,
  });
  const expectedRawRef = `raw/${toPathKey(record.sourceId)}/${toPathKey(record.targetKey)}/${record.sourceRecordId}.json`;
  if (record.sourceRecordId !== expectedId
    || record.rawPayloadRef.replaceAll('\\', '/') !== expectedRawRef) {
    throw typedError('SOURCE_RECORD_INTEGRITY_INVALID', 'SourceRecord immutable identity is invalid');
  }
  const absenceState = sourceAbsenceState(record);
  if (absenceState) return absenceState;
  if (!['anilist', 'wikidata', 'anilife_public'].includes(record.sourceId)
    || Object.hasOwn(record.payload, 'errorCode') || Object.hasOwn(record.payload, 'fieldState')) {
    throw schemaError();
  }
  if (record.fetchStatus !== 'FETCHED' || record.responseStatus < 200 || record.responseStatus >= 300) {
    throw typedError('SOURCE_RECORD_STATE_INVALID', 'SourceRecord is not a successful or approved absence record');
  }
  if (record.sourceId === 'anilist') validateAniListPayload(record);
  else if (record.sourceId === 'wikidata') validateWikidataPayload(record);
  else if (record.sourceId === 'anilife_public') validateAniLifePayload(record);
  else throw schemaError();
  return null;
}

function anilistFields(record) {
  const payload = record.payload;
  const titleEntries = uniqueEntries([
    titleEntry('ja-Latn', payload.title.romaji), titleEntry('en', payload.title.english),
    titleEntry('ja', payload.title.native), ...payload.synonyms.map((value) => titleEntry('und', value)),
  ].filter(Boolean));
  const externalEntries = [
    { rawValue: { sourceId: 'anilist', value: payload.id }, normalizedValue: { sourceId: 'anilist', value: String(payload.id) } },
    stringId(payload.idMal) ? { rawValue: { sourceId: 'mal', value: payload.idMal }, normalizedValue: { sourceId: 'mal', value: String(payload.idMal) } } : null,
  ].filter(Boolean);
  const genreEntries = uniqueEntries(payload.genres.map(textEntry).filter(Boolean));
  const coreEntries = genreEntries.map(({ rawValue, normalizedValue }) => ({
    rawValue, normalizedValue: CORE_GENRE_MAP[normalizedValue],
  })).filter(({ normalizedValue }) => normalizedValue !== undefined);
  const studios = payload.studios.nodes.map((studio) => ({
    rawValue: studio,
    normalizedValue: {
      id: `anilist:${studio.id}`, name: normalizeText(studio.name),
      role: studio.isAnimationStudio ? 'ANIMATION_PRODUCTION' : 'OTHER',
    },
  }));
  const relations = payload.relations.edges.map((edge) => ({
    rawValue: edge,
    normalizedValue: {
      targetId: `anilist:${edge.node.id}`, type: RELATION_MAP[edge.relationType] ?? 'OTHER',
      title: normalizeText(edge.node.title.romaji) ?? normalizeText(edge.node.title.english)
        ?? normalizeText(edge.node.title.native),
      format: enumValue(edge.node.format, FORMAT_MAP),
    },
  }));
  const characters = [];
  const castings = [];
  for (const edge of payload.characters) {
    if (!['MAIN', 'SUPPORTING'].includes(edge.role)) continue;
    const canonicalName = normalizeText(edge.node.name.full) ?? normalizeText(edge.node.name.native);
    if (!canonicalName) continue;
    const characterId = `anilist:${edge.node.id}`;
    const characterContext = { role: edge.role, node: edge.node };
    characters.push({
      rawValue: characterContext,
      normalizedValue: {
        id: characterId, role: edge.role, canonicalName,
        localizedNames: uniqueEntries([
          titleEntry('ja', edge.node.name.native),
          ...(edge.node.name.alternative ?? []).map((value) => titleEntry('und', value)),
        ].filter(Boolean)).map(({ normalizedValue }) => normalizedValue),
      },
    });
    for (const actor of edge.voiceActors) {
      if (actor.language !== 'JAPANESE') continue;
      const creditedName = normalizeText(actor.name.native) ?? normalizeText(actor.name.full);
      if (!creditedName) continue;
      castings.push({
        rawValue: { character: characterContext, voiceActor: actor },
        normalizedValue: {
          characterId, personId: `anilist:${actor.id}`, language: 'ja', roleType: edge.role,
          creditedName,
        },
      });
    }
  }
  const officialLinks = payload.externalLinks.filter((link) => /official/i.test(link.site ?? ''))
    .map((link) => ({ rawValue: link, normalizedValue: normalizedHttpUrl(link.url) }))
    .filter(({ normalizedValue }) => normalizedValue !== null);
  const coverRaw = payload.coverImage.extraLarge ?? payload.coverImage.large ?? payload.coverImage.medium;
  const coverUrl = normalizedHttpUrl(coverRaw);
  const startDate = normalizedDate(payload.startDate);
  const endDate = normalizedDate(payload.endDate);
  const releaseYearEvidence = [safeYear(payload.startDate.year), safeYear(payload.seasonYear)].filter(Boolean);
  return {
    entries: {
      externalIds: externalEntries, titles: titleEntries,
      format: typeof payload.format === 'string' ? [{ rawValue: payload.format, normalizedValue: enumValue(payload.format, FORMAT_MAP) }] : [],
      status: typeof payload.status === 'string' ? [{ rawValue: payload.status, normalizedValue: enumValue(payload.status, STATUS_MAP) }] : [],
      season: SEASON_VALUES.includes(payload.season) ? [{ rawValue: payload.season, normalizedValue: payload.season }] : [],
      startDate: startDate ? [{ rawValue: payload.startDate, normalizedValue: startDate }] : [],
      endDate: endDate ? [{ rawValue: payload.endDate, normalizedValue: endDate }] : [],
      episodeCount: safeInteger(payload.episodes) !== null ? [{ rawValue: payload.episodes, normalizedValue: payload.episodes }] : [],
      sourceMaterialType: typeof payload.source === 'string' ? [{ rawValue: payload.source, normalizedValue: enumValue(payload.source, SOURCE_MATERIAL_MAP) }] : [],
      officialSiteUrl: officialLinks, studios, relations, sourceGenres: genreEntries,
      coreGenres: coreEntries, characters, castings,
      cover: coverUrl ? [{ rawValue: payload.coverImage, normalizedValue: {
        sourceUrl: coverUrl, rightsStatus: 'TEST_ONLY_UNKNOWN', distributionStatus: 'PROHIBITED',
      } }] : [],
    },
    releaseYearEvidence,
  };
}

function wikidataFields(record) {
  const payload = record.payload;
  const anilistId = payload.externalIds.anilist;
  const externalIds = [
    { rawValue: { sourceId: 'wikidata', value: record.sourceEntityId }, normalizedValue: { sourceId: 'wikidata', value: record.sourceEntityId } },
    { rawValue: { sourceId: 'anilist', value: anilistId }, normalizedValue: { sourceId: 'anilist', value: anilistId } },
  ];
  const titles = [];
  for (const locale of ['ko', 'ja', 'en']) {
    const label = titleEntry(locale, payload.labels[locale]);
    if (label) titles.push(label);
    for (const alias of payload.aliases[locale] ?? []) {
      const entry = titleEntry(locale, alias);
      if (entry) titles.push(entry);
    }
  }
  const missingEntry = (snak) => ({
    rawValue: snak.mainsnak,
    normalizedValue: null,
    status: 'SOURCE_NOT_AVAILABLE',
  });
  const dateEntries = wikidataSnaks(payload, 'P577').map((snak) => {
    if (snak.snaktype !== 'value') return missingEntry(snak);
    const normalizedValue = normalizedDate(snak.value.time);
    return normalizedValue === null ? null : { rawValue: snak.value, normalizedValue };
  }).filter(Boolean);
  const officialSites = wikidataSnaks(payload, 'P856').map((snak) => {
    if (snak.snaktype !== 'value') return missingEntry(snak);
    const normalizedValue = normalizedHttpUrl(snak.value);
    return normalizedValue === null ? null : { rawValue: snak.value, normalizedValue };
  }).filter(Boolean);
  const studios = wikidataSnaks(payload, 'P272').map((snak) => (
    snak.snaktype !== 'value' ? missingEntry(snak) : {
      rawValue: snak.value,
      normalizedValue: { id: `wikidata:${snak.value.id}`, name: null, role: 'OTHER' },
    }
  ));
  const sourceGenres = wikidataSnaks(payload, 'P136').map((snak) => (
    snak.snaktype !== 'value' ? missingEntry(snak) : {
      rawValue: snak.value, normalizedValue: `wikidata:${snak.value.id}`,
    }
  ));
  return {
    entries: {
      externalIds, titles, startDate: dateEntries, officialSiteUrl: officialSites, studios, sourceGenres,
    },
    releaseYearEvidence: dateEntries.filter((entry) => entry.normalizedValue !== null)
      .map(({ normalizedValue }) => Number(normalizedValue.slice(0, 4))),
  };
}

function anilifeFields(record) {
  const payload = record.payload;
  const startDate = normalizedDate(payload.datePublished);
  const coverUrl = normalizedHttpUrl(payload.imageUrl);
  return {
    entries: {
      externalIds: [{
        rawValue: { sourceId: 'anilife_public', value: payload.contentId },
        normalizedValue: { sourceId: 'anilife_public', value: payload.contentId },
      }],
      titles: uniqueEntries([
        titleEntry('und', payload.title), titleEntry('ko', payload.alternateName),
      ].filter(Boolean)),
      startDate: startDate ? [{ rawValue: payload.datePublished, normalizedValue: startDate }] : [],
      episodeCount: safeInteger(payload.numberOfEpisodes) !== null
        ? [{ rawValue: payload.numberOfEpisodes, normalizedValue: payload.numberOfEpisodes }] : [],
      cover: coverUrl ? [{ rawValue: payload.imageUrl, normalizedValue: {
        sourceUrl: coverUrl, rightsStatus: 'TEST_ONLY_UNKNOWN', distributionStatus: 'PROHIBITED',
      } }] : [],
    },
    releaseYearEvidence: [rawYearEvidence(payload.datePublished)].filter(Boolean),
    identityEvidence: payload.identityEvidence,
  };
}

function sourceQualifiedId(value, sources) {
  if (typeof value !== 'string') return false;
  return sources.some((source) => source === 'wikidata'
    ? /^wikidata:Q[1-9]\d*$/u.test(value)
    : new RegExp(`^${source}:[1-9]\\d*$`, 'u').test(value));
}

function normalizedName(value) {
  return typeof value === 'string' && normalizeText(value) === value;
}

export function isNormalizedFieldValue(fieldPath, value) {
  if (fieldPath === 'externalIds') return hasExactKeys(value, ['sourceId', 'value'])
    && ((['anilist', 'mal', 'anilife_public'].includes(value.sourceId) && /^[1-9]\d*$/u.test(value.value))
      || (value.sourceId === 'wikidata' && /^Q[1-9]\d*$/u.test(value.value)));
  if (fieldPath === 'titles') return hasExactKeys(value, ['locale', 'value']) && typeof value.locale === 'string'
    && value.locale.length > 0 && normalizedName(value.value);
  if (fieldPath === 'format') return FORMAT_VALUES.includes(value);
  if (fieldPath === 'status') return STATUS_VALUES.includes(value);
  if (fieldPath === 'season') return SEASON_VALUES.includes(value);
  if (fieldPath === 'startDate' || fieldPath === 'endDate') return normalizedDate(value) === value;
  if (fieldPath === 'episodeCount') return safeInteger(value) !== null;
  if (fieldPath === 'sourceMaterialType') return SOURCE_MATERIAL_VALUES.includes(value);
  if (fieldPath === 'officialSiteUrl') return normalizedHttpUrl(value) === value;
  if (fieldPath === 'studios') return hasExactKeys(value, ['id', 'name', 'role'])
    && sourceQualifiedId(value.id, ['anilist', 'wikidata'])
    && (value.name === null || normalizedName(value.name)) && STUDIO_ROLE_VALUES.includes(value.role);
  if (fieldPath === 'relations') return hasExactKeys(value, ['format', 'targetId', 'title', 'type'])
    && sourceQualifiedId(value.targetId, ['anilist', 'wikidata'])
    && RELATION_VALUES.includes(value.type) && (value.title === null || normalizedName(value.title))
    && FORMAT_VALUES.includes(value.format);
  if (fieldPath === 'sourceGenres') return typeof value === 'string' && value.length > 0;
  if (fieldPath === 'coreGenres') return CORE_GENRES.includes(value);
  if (fieldPath === 'characters') return hasExactKeys(value, ['canonicalName', 'id', 'localizedNames', 'role'])
    && sourceQualifiedId(value.id, ['anilist', 'wikidata'])
    && ['MAIN', 'SUPPORTING'].includes(value.role) && normalizedName(value.canonicalName)
    && Array.isArray(value.localizedNames) && value.localizedNames.every((name) => isNormalizedFieldValue('titles', name));
  if (fieldPath === 'castings') return hasExactKeys(value, ['characterId', 'creditedName', 'language', 'personId', 'roleType'])
    && sourceQualifiedId(value.characterId, ['anilist', 'wikidata'])
    && sourceQualifiedId(value.personId, ['anilist', 'wikidata']) && value.language === 'ja'
    && ['MAIN', 'SUPPORTING'].includes(value.roleType) && normalizedName(value.creditedName);
  if (fieldPath === 'cover') return hasExactKeys(value, ['distributionStatus', 'rightsStatus', 'sourceUrl'])
    && normalizedHttpUrl(value.sourceUrl) === value.sourceUrl
    && value.rightsStatus === 'TEST_ONLY_UNKNOWN' && value.distributionStatus === 'PROHIBITED';
  return false;
}

function finalize(record, normalized, overallState) {
  const entriesByField = normalized.entries;
  const fieldStates = {};
  const fieldValues = [];
  const summaries = {};
  for (const fieldPath of CANONICAL_FIELD_PATHS) {
    const isCollection = COLLECTION_FIELD_PATHS.includes(fieldPath);
    const entries = overallState ? [] : uniqueEntries(entriesByField[fieldPath] ?? [], fieldPath);
    if (entries.length > 0) {
      const valueEntries = entries.filter((entry) => (entry.status ?? 'VALUE') === 'VALUE');
      const scalarConflict = !isCollection && valueEntries.length > 1;
      const missingState = entries.some((entry) => entry.status === 'SOURCE_NOT_AVAILABLE')
        ? 'SOURCE_NOT_AVAILABLE' : 'NOT_FETCHED';
      const state = valueEntries.length > 0 ? (scalarConflict ? 'CONFLICTED' : 'VALUE') : missingState;
      fieldStates[fieldPath] = state;
      summaries[fieldPath] = isCollection
        ? valueEntries.map(({ normalizedValue }) => structuredClone(normalizedValue))
        : valueEntries.length === 1 ? structuredClone(valueEntries[0].normalizedValue) : null;
      for (const entry of entries) fieldValues.push({
        fieldPath, rawValue: structuredClone(entry.rawValue),
        normalizedValue: structuredClone(entry.normalizedValue), status: entry.status ?? 'VALUE',
      });
    } else {
      const state = overallState ?? 'SOURCE_NOT_AVAILABLE';
      fieldStates[fieldPath] = state;
      summaries[fieldPath] = isCollection ? [] : null;
      fieldValues.push({ fieldPath, rawValue: null, normalizedValue: null, status: state });
    }
  }
  fieldValues.sort((left, right) => compareText(left.fieldPath, right.fieldPath)
    || compareText(stableStringify(left.normalizedValue), stableStringify(right.normalizedValue))
    || compareText(stableStringify(left.rawValue), stableStringify(right.rawValue)));
  const releaseYearEvidence = [...new Set(normalized.releaseYearEvidence.filter((year) => safeYear(year) !== null))]
    .sort((left, right) => left - right);
  return deepFrozenSnapshot({
    sourceRecordId: record.sourceRecordId,
    targetKey: record.targetKey,
    sourceId: record.sourceId,
    sourceEntityId: record.sourceEntityId,
    retrievedAt: record.fetchedAt,
    releaseYear: releaseYearEvidence.length === 1 ? releaseYearEvidence[0] : null,
    releaseYearEvidence,
    identityEvidence: normalized.identityEvidence ?? null,
    ...summaries,
    fieldStates,
    fieldValues,
  });
}

/** Converts one validated immutable SourceRecord into an independent normalized snapshot. */
export function normalizeSourceRecord(input) {
  const record = deepFrozenSnapshot(input);
  const overallState = validateSourceRecord(record);
  if (overallState) return finalize(record, { entries: {}, releaseYearEvidence: [] }, overallState);
  const normalized = record.sourceId === 'anilist' ? anilistFields(record)
    : record.sourceId === 'wikidata' ? wikidataFields(record)
      : record.sourceId === 'anilife_public' ? anilifeFields(record) : null;
  if (!normalized) throw schemaError();
  return finalize(record, normalized, null);
}
