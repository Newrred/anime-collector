import { stableStringify } from '../lib/hash.mjs';

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
export const CORE_GENRES = Object.freeze([
  'Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy', 'Horror', 'Mystery',
  'Romance', 'Sci-Fi', 'Slice of Life', 'Sports', 'Supernatural', 'Thriller',
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

function schemaError() {
  const error = new Error('SourceRecord cannot be normalized by the catalog contract');
  error.code = 'SOURCE_SCHEMA_DRIFT';
  return error;
}

export function normalizeText(value) {
  if (typeof value !== 'string') return null;
  const normalized = value.normalize('NFKC').trim();
  return normalized || null;
}

function safeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function stringId(value) {
  if ((typeof value !== 'string' && typeof value !== 'number') || value === '') return null;
  const result = String(value);
  return /^(?:[1-9]\d*|Q[1-9]\d*)$/.test(result) ? result : null;
}

function enumValue(value, map, fallback = 'UNKNOWN') {
  return typeof value === 'string' ? (map[value] ?? fallback) : fallback;
}

function normalizedDate(value) {
  if (typeof value === 'string') {
    const match = value.match(/^\+?(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return null;
    const [, year, month, day] = match;
    const date = new Date(`${year}-${month}-${day}T00:00:00.000Z`);
    return Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== `${year}-${month}-${day}`
      ? null : `${year}-${month}-${day}`;
  }
  if (!value || typeof value !== 'object') return null;
  const { year, month, day } = value;
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  return normalizedDate(`${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
}

function uniqueEntries(entries) {
  const seen = new Set();
  return entries.filter(({ normalizedValue }) => {
    const key = stableStringify(normalizedValue);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
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

function sourceOverallState(record) {
  if (record.payload?.fieldState === 'NOT_FETCHED') return 'NOT_FETCHED';
  if (record.payload?.fieldState === 'SOURCE_NOT_AVAILABLE'
    || record.payload?.errorCode === 'SOURCE_NOT_AVAILABLE') return 'SOURCE_NOT_AVAILABLE';
  return null;
}

function anilistFields(record) {
  const payload = record.payload;
  if (stringId(payload.id) && String(payload.id) !== record.sourceEntityId) throw schemaError();
  const titleEntries = uniqueEntries([
    titleEntry('ja-Latn', payload.title?.romaji),
    titleEntry('en', payload.title?.english),
    titleEntry('ja', payload.title?.native),
    ...(Array.isArray(payload.synonyms) ? payload.synonyms.map((value) => titleEntry('und', value)) : []),
  ].filter(Boolean));
  const externalEntries = [
    stringId(payload.id) ? { rawValue: { sourceId: 'anilist', value: payload.id }, normalizedValue: { sourceId: 'anilist', value: String(payload.id) } } : null,
    stringId(payload.idMal) ? { rawValue: { sourceId: 'mal', value: payload.idMal }, normalizedValue: { sourceId: 'mal', value: String(payload.idMal) } } : null,
  ].filter(Boolean);
  const genreEntries = uniqueEntries((Array.isArray(payload.genres) ? payload.genres : [])
    .map(textEntry).filter(Boolean));
  const coreEntries = genreEntries.filter(({ normalizedValue }) => CORE_GENRES.includes(normalizedValue));
  const studioEntries = (Array.isArray(payload.studios?.nodes) ? payload.studios.nodes : [])
    .filter((studio) => stringId(studio?.id) && normalizeText(studio?.name))
    .map((studio) => ({
      rawValue: studio,
      normalizedValue: {
        id: `anilist:${studio.id}`, name: normalizeText(studio.name),
        role: studio.isAnimationStudio ? 'ANIMATION_PRODUCTION' : 'OTHER',
      },
    }));
  const relationEntries = (Array.isArray(payload.relations?.edges) ? payload.relations.edges : [])
    .filter((edge) => stringId(edge?.node?.id))
    .map((edge) => ({
      rawValue: edge,
      normalizedValue: {
        targetId: `anilist:${edge.node.id}`,
        type: RELATION_MAP[edge.relationType] ?? 'OTHER',
        title: normalizeText(edge.node.title?.romaji) ?? normalizeText(edge.node.title?.english)
          ?? normalizeText(edge.node.title?.native),
        format: enumValue(edge.node.format, FORMAT_MAP),
      },
    }));
  const characterEntries = [];
  const castingEntries = [];
  for (const edge of Array.isArray(payload.characters) ? payload.characters : []) {
    if (!['MAIN', 'SUPPORTING'].includes(edge?.role) || !stringId(edge?.node?.id)) continue;
    const canonicalName = normalizeText(edge.node.name?.full) ?? normalizeText(edge.node.name?.native);
    if (!canonicalName) continue;
    const characterId = `anilist:${edge.node.id}`;
    characterEntries.push({
      rawValue: edge.node,
      normalizedValue: {
        id: characterId, role: edge.role, canonicalName,
        localizedNames: uniqueEntries([
          titleEntry('ja', edge.node.name?.native),
          ...(Array.isArray(edge.node.name?.alternative)
            ? edge.node.name.alternative.map((value) => titleEntry('und', value)) : []),
        ].filter(Boolean)).map(({ normalizedValue }) => normalizedValue),
      },
    });
    for (const actor of Array.isArray(edge.voiceActors) ? edge.voiceActors : []) {
      if (actor?.language !== 'JAPANESE' || !stringId(actor.id)) continue;
      const creditedName = normalizeText(actor.name?.native) ?? normalizeText(actor.name?.full);
      if (!creditedName) continue;
      castingEntries.push({
        rawValue: actor,
        normalizedValue: {
          characterId, personId: `anilist:${actor.id}`, language: 'ja', roleType: edge.role,
          creditedName,
        },
      });
    }
  }
  const officialLink = (Array.isArray(payload.externalLinks) ? payload.externalLinks : [])
    .find((link) => /official/i.test(link?.site ?? '') && normalizeText(link?.url));
  const coverUrl = normalizeText(payload.coverImage?.extraLarge)
    ?? normalizeText(payload.coverImage?.large) ?? normalizeText(payload.coverImage?.medium);
  return {
    externalIds: externalEntries,
    titles: titleEntries,
    format: typeof payload.format === 'string'
      ? [{ rawValue: payload.format, normalizedValue: enumValue(payload.format, FORMAT_MAP) }] : [],
    status: typeof payload.status === 'string'
      ? [{ rawValue: payload.status, normalizedValue: enumValue(payload.status, STATUS_MAP) }] : [],
    season: SEASON_VALUES.includes(payload.season)
      ? [{ rawValue: payload.season, normalizedValue: payload.season }] : [],
    startDate: normalizedDate(payload.startDate)
      ? [{ rawValue: payload.startDate, normalizedValue: normalizedDate(payload.startDate) }] : [],
    endDate: normalizedDate(payload.endDate)
      ? [{ rawValue: payload.endDate, normalizedValue: normalizedDate(payload.endDate) }] : [],
    episodeCount: safeInteger(payload.episodes) !== null
      ? [{ rawValue: payload.episodes, normalizedValue: payload.episodes }] : [],
    sourceMaterialType: typeof payload.source === 'string' ? [{
      rawValue: payload.source,
      normalizedValue: enumValue(payload.source, SOURCE_MATERIAL_MAP),
    }] : [],
    officialSiteUrl: officialLink
      ? [{ rawValue: officialLink.url, normalizedValue: normalizeText(officialLink.url) }] : [],
    studios: studioEntries,
    relations: relationEntries,
    sourceGenres: genreEntries,
    coreGenres: coreEntries,
    characters: characterEntries,
    castings: castingEntries,
    cover: coverUrl ? [{
      rawValue: payload.coverImage,
      normalizedValue: {
        sourceUrl: coverUrl, rightsStatus: 'TEST_ONLY_UNKNOWN', distributionStatus: 'PROHIBITED',
      },
    }] : [],
  };
}

function wikidataClaimValues(payload, property) {
  return Array.isArray(payload.claims?.[property]) ? payload.claims[property]
    .map((claim) => claim?.mainsnak?.datavalue?.value).filter((value) => value !== undefined) : [];
}

function wikidataFields(record) {
  const payload = record.payload;
  const externalEntries = [];
  if (/^Q[1-9]\d*$/.test(record.sourceEntityId)) externalEntries.push({
    rawValue: { sourceId: 'wikidata', value: record.sourceEntityId },
    normalizedValue: { sourceId: 'wikidata', value: record.sourceEntityId },
  });
  for (const [sourceId, rawValue] of Object.entries(payload.externalIds ?? {})) {
    const value = stringId(rawValue);
    if (value) externalEntries.push({ rawValue: { sourceId, value: rawValue }, normalizedValue: { sourceId, value } });
  }
  const titleEntries = [];
  for (const locale of ['ko', 'ja', 'en']) {
    const label = titleEntry(locale, payload.labels?.[locale]);
    if (label) titleEntries.push(label);
    for (const alias of Array.isArray(payload.aliases?.[locale]) ? payload.aliases[locale] : []) {
      const entry = titleEntry(locale, alias);
      if (entry) titleEntries.push(entry);
    }
  }
  const dateEntries = wikidataClaimValues(payload, 'P577').map((value) => {
    const rawValue = typeof value === 'object' ? value.time : value;
    return { rawValue, normalizedValue: normalizedDate(rawValue) };
  }).filter(({ normalizedValue }) => normalizedValue !== null);
  const officialSite = wikidataClaimValues(payload, 'P856').map((value) => normalizeText(value)).find(Boolean);
  const studios = wikidataClaimValues(payload, 'P272').map((value) => value?.id ?? value)
    .filter((value) => typeof value === 'string' && /^Q[1-9]\d*$/.test(value))
    .map((value) => ({ rawValue: value, normalizedValue: { id: `wikidata:${value}`, name: null, role: 'OTHER' } }));
  const sourceGenres = wikidataClaimValues(payload, 'P136').map((value) => value?.id ?? value)
    .filter((value) => typeof value === 'string' && /^Q[1-9]\d*$/.test(value))
    .map((value) => ({ rawValue: value, normalizedValue: `wikidata:${value}` }));
  return {
    externalIds: uniqueEntries(externalEntries), titles: uniqueEntries(titleEntries),
    startDate: dateEntries.slice(0, 1),
    officialSiteUrl: officialSite ? [{ rawValue: officialSite, normalizedValue: officialSite }] : [],
    studios, sourceGenres,
  };
}

function anilifeFields(record) {
  const payload = record.payload;
  if (payload.contentId !== undefined && String(payload.contentId) !== record.sourceEntityId) throw schemaError();
  const contentId = stringId(payload.contentId ?? record.sourceEntityId);
  const externalIds = contentId && contentId !== 'UNBOUND' ? [{
    rawValue: { sourceId: 'anilife_public', value: payload.contentId ?? record.sourceEntityId },
    normalizedValue: { sourceId: 'anilife_public', value: contentId },
  }] : [];
  const titles = uniqueEntries([
    titleEntry('und', payload.title), titleEntry('ko', payload.alternateName),
  ].filter(Boolean));
  const startDate = normalizedDate(payload.datePublished);
  const coverUrl = normalizeText(payload.imageUrl);
  return {
    externalIds, titles,
    startDate: startDate ? [{ rawValue: payload.datePublished, normalizedValue: startDate }] : [],
    episodeCount: safeInteger(payload.numberOfEpisodes) !== null
      ? [{ rawValue: payload.numberOfEpisodes, normalizedValue: payload.numberOfEpisodes }] : [],
    cover: coverUrl ? [{
      rawValue: payload.imageUrl,
      normalizedValue: {
        sourceUrl: coverUrl, rightsStatus: 'TEST_ONLY_UNKNOWN', distributionStatus: 'PROHIBITED',
      },
    }] : [],
  };
}

function finalize(record, entriesByField) {
  const overallState = sourceOverallState(record);
  const fieldStates = {};
  const fieldValues = [];
  const values = {};
  for (const fieldPath of CANONICAL_FIELD_PATHS) {
    const isCollection = COLLECTION_FIELD_PATHS.includes(fieldPath);
    const entries = overallState ? [] : uniqueEntries(entriesByField[fieldPath] ?? []);
    if (entries.length > 0) {
      fieldStates[fieldPath] = 'VALUE';
      values[fieldPath] = isCollection
        ? entries.map(({ normalizedValue }) => normalizedValue)
        : entries[0].normalizedValue;
      for (const entry of entries) fieldValues.push({ fieldPath, ...entry, status: 'VALUE' });
    } else {
      const state = overallState ?? 'SOURCE_NOT_AVAILABLE';
      fieldStates[fieldPath] = state;
      values[fieldPath] = isCollection ? [] : null;
      fieldValues.push({ fieldPath, rawValue: null, normalizedValue: null, status: state });
    }
  }
  const releaseYear = values.startDate ? Number(values.startDate.slice(0, 4)) : null;
  return Object.freeze({
    sourceRecordId: record.sourceRecordId,
    targetKey: record.targetKey,
    sourceId: record.sourceId,
    sourceEntityId: record.sourceEntityId,
    retrievedAt: record.fetchedAt,
    releaseYear,
    ...values,
    fieldStates: Object.freeze(fieldStates),
    fieldValues: Object.freeze(fieldValues.map((entry) => Object.freeze(entry))),
  });
}

/** Converts one immutable SourceRecord into a source-neutral normalized candidate. */
export function normalizeSourceRecord(record) {
  if (!record || typeof record !== 'object' || typeof record.sourceRecordId !== 'string'
    || typeof record.targetKey !== 'string' || typeof record.sourceId !== 'string'
    || typeof record.sourceEntityId !== 'string' || typeof record.fetchedAt !== 'string'
    || !record.payload || typeof record.payload !== 'object') throw schemaError();
  const entries = record.sourceId === 'anilist' ? anilistFields(record)
    : record.sourceId === 'wikidata' ? wikidataFields(record)
      : record.sourceId === 'anilife_public' ? anilifeFields(record) : null;
  if (!entries) throw schemaError();
  return finalize(record, entries);
}
