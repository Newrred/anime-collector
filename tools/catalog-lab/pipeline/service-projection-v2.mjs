import { sha256 } from '../lib/hash.mjs';

export const SERVICE_PROJECTION_V2_SCHEMA_VERSION = 2;
export const SERVICE_PROJECTION_V2_POLICY_VERSION = 'SERVICE_PROJECTION_V2_PREVIEW_2026_08_19';

const HASH = /^[a-f0-9]{64}$/u;
const ANIME_ID = /^anime:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

function typedError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function clone(value) {
  try { return structuredClone(value); } catch {
    throw typedError('SERVICE_PROJECTION_V2_INPUT_INVALID', 'Projection input must be JSON-safe');
  }
}

function deepFreeze(value, seen = new Set()) {
  if (value === null || typeof value !== 'object' || seen.has(value)) return value;
  seen.add(value);
  Object.values(value).forEach((child) => deepFreeze(child, seen));
  return Object.freeze(value);
}

function frozen(value) { return deepFreeze(clone(value)); }

function plainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype;
}

function text(value, maximum = 240) {
  if (typeof value !== 'string') return null;
  const normalized = value.normalize('NFKC').trim().replace(/\s+/gu, ' ');
  return normalized && [...normalized].length <= maximum ? normalized : null;
}

function scalar(field) {
  if (field?.state === 'VALUE') return field.value ?? null;
  if (field?.state === 'CONFLICTED' && Array.isArray(field.values)) return field.values[0] ?? null;
  return null;
}

function values(field) {
  const candidate = field?.state === 'VALUE' ? field.value
    : field?.state === 'CONFLICTED' ? field.values : [];
  return Array.isArray(candidate) ? candidate : candidate == null ? [] : [candidate];
}

function unique(rows, keyOf) {
  const map = new Map();
  for (const row of rows) {
    const key = keyOf(row);
    if (key && !map.has(key)) map.set(key, row);
  }
  return [...map.values()];
}

function hashed(core) { return { ...core, rowHash: sha256(core) }; }

function validateInputs(target, canonical, projection) {
  if (!plainObject(target) || !ANIME_ID.test(target.moemoaAnimeId ?? '')
    || typeof target.targetKey !== 'string' || canonical?.id !== target.moemoaAnimeId
    || projection?.animeId !== target.moemoaAnimeId || projection?.targetKey !== target.targetKey) {
    throw typedError('SERVICE_PROJECTION_V2_IDENTITY_INVALID', 'Target, canonical, and projection identity must match');
  }
  if (canonical?.revision?.algorithm !== 'SHA-256' || !HASH.test(canonical.revision?.contentHash ?? '')) {
    throw typedError('SERVICE_PROJECTION_V2_CANONICAL_INVALID', 'Canonical revision metadata is invalid');
  }
  const { revision, ...canonicalCore } = canonical;
  if (sha256(canonicalCore) !== revision.contentHash || projection.canonicalHash !== revision.contentHash) {
    throw typedError('SERVICE_PROJECTION_V2_CANONICAL_INVALID', 'Canonical content hash does not match');
  }
  if (projection.schemaVersion !== 1 || !HASH.test(projection.projectionHash ?? '')) {
    throw typedError('SERVICE_PROJECTION_V2_SOURCE_INVALID', 'Service projection v1 is invalid');
  }
  const { projectionHash, ...projectionCore } = projection;
  if (sha256(projectionCore) !== projectionHash) {
    throw typedError('SERVICE_PROJECTION_V2_SOURCE_INVALID', 'Service projection v1 hash does not match');
  }
}

function titleRows(canonical, serviceProjection) {
  const candidates = [serviceProjection.preferredTitle, ...serviceProjection.searchTitles]
    .map((row) => ({ locale: text(row?.locale, 20), value: text(row?.value) }))
    .filter((row) => row.locale && row.value);
  return unique(candidates, (row) => `${row.locale}\u0000${row.value}`);
}

function externalIdRows(canonical) {
  return unique(values(canonical.externalIds).flatMap((row) => {
    const provider = text(row?.sourceId, 40);
    const externalId = text(row?.value, 120);
    return provider && externalId ? [{ provider, externalId }] : [];
  }), (row) => `${row.provider}\u0000${row.externalId}`)
    .sort((a, b) => a.provider.localeCompare(b.provider) || a.externalId.localeCompare(b.externalId));
}

function studioRows(canonical) {
  return unique(values(canonical.studios).flatMap((row) => {
    const id = text(row?.id, 160);
    const name = text(row?.name);
    const role = text(row?.role, 80) ?? 'OTHER';
    return id && name ? [{ id, name, role }] : [];
  }), (row) => row.id).sort((a, b) => a.role.localeCompare(b.role) || a.name.localeCompare(b.name));
}

function stringValues(field, maximumItems = 128, maximumLength = 120) {
  return unique(values(field).map((value) => text(value, maximumLength)).filter(Boolean), (value) => value)
    .sort((a, b) => a.localeCompare(b)).slice(0, maximumItems);
}

function officialLinks(serviceProjection) {
  return (Array.isArray(serviceProjection.officialLinks) ? serviceProjection.officialLinks : [])
    .flatMap((row) => {
      const url = text(row?.url, 2048);
      const locale = text(row?.locale, 20) ?? 'und';
      const role = text(row?.role, 80) ?? 'SECONDARY_OFFICIAL';
      if (!url) return [];
      try {
        const parsed = new URL(url);
        if (parsed.protocol !== 'https:' || parsed.username || parsed.password) return [];
      } catch { return []; }
      return [{ url, locale, role }];
    }).slice(0, 16);
}

function relationRows(canonical) {
  return unique(values(canonical.relations).flatMap((row) => {
    const targetId = text(row?.targetId, 160);
    const type = text(row?.type, 80);
    const title = text(row?.title);
    const format = text(row?.format, 40);
    return targetId && type ? [{ targetId, type, title, format }] : [];
  }), (row) => `${row.targetId}\u0000${row.type}`);
}

function peopleRows(canonical) {
  const castingsByCharacter = new Map();
  for (const row of values(canonical.castings)) {
    const characterId = text(row?.characterId, 160);
    const personId = text(row?.personId, 160);
    const creditedName = text(row?.creditedName);
    if (!characterId || !personId || !creditedName) continue;
    const list = castingsByCharacter.get(characterId) ?? [];
    list.push({
      personId,
      creditedName,
      language: text(row?.language, 40) ?? 'UNKNOWN',
      roleType: text(row?.roleType, 40) ?? 'VOICE',
    });
    castingsByCharacter.set(characterId, list);
  }
  const roleRank = new Map([['MAIN', 0], ['SUPPORTING', 1], ['BACKGROUND', 2]]);
  return unique(values(canonical.characters).flatMap((row) => {
    const characterId = text(row?.id, 160);
    const canonicalName = text(row?.canonicalName);
    if (!characterId || !canonicalName) return [];
    const localizedNames = unique((Array.isArray(row.localizedNames) ? row.localizedNames : [])
      .flatMap((name) => {
        const locale = text(name?.locale, 20);
        const value = text(name?.value);
        return locale && value ? [{ locale, value }] : [];
      }), (name) => `${name.locale}\u0000${name.value}`);
    return [{
      characterId,
      canonicalName,
      role: text(row?.role, 40) ?? 'UNKNOWN',
      localizedNames,
      castings: unique(castingsByCharacter.get(characterId) ?? [], (casting) => (
        `${casting.personId}\u0000${casting.language}\u0000${casting.roleType}`
      )),
    }];
  }), (row) => row.characterId).sort((a, b) => (
    (roleRank.get(a.role) ?? 9) - (roleRank.get(b.role) ?? 9)
      || a.canonicalName.localeCompare(b.canonicalName)
  ));
}

function safeInteger(value, minimum = 0) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= minimum ? number : null;
}

/** Creates service-safe, payload-bounded projections from one authenticated canonical revision. */
export function buildServiceProjectionV2(input = {}) {
  const target = clone(input.target);
  const canonical = clone(input.canonical);
  const source = clone(input.serviceProjection);
  validateInputs(target, canonical, source);
  const pageSize = safeInteger(input.peoplePageSize, 1) ?? 30;
  if (pageSize < 1 || pageSize > 50) {
    throw typedError('SERVICE_PROJECTION_V2_INPUT_INVALID', 'People page size must be between 1 and 50');
  }

  const titles = titleRows(canonical, source);
  const preferred = titles.find((row) => row.locale === source.preferredTitle.locale
    && row.value === source.preferredTitle.value) ?? titles[0];
  if (!preferred) throw typedError('SERVICE_PROJECTION_V2_TITLE_REQUIRED', 'Preferred title is required');
  const studios = studioRows(canonical);
  const sourceGenres = stringValues(canonical.sourceGenres, 32);
  const coreGenres = stringValues(canonical.coreGenres, 16);
  const people = peopleRows(canonical);
  const assetId = `asset:${sha256(['SYSTEM_DESIGN', target.moemoaAnimeId]).slice(0, 40)}`;
  const releaseYear = /^\d{4}/u.exec(String(scalar(canonical.startDate) ?? ''))?.[0];
  const aliases = titles.filter((row) => row.locale !== preferred.locale || row.value !== preferred.value);

  const asset = hashed({
    schemaVersion: SERVICE_PROJECTION_V2_SCHEMA_VERSION,
    policyVersion: SERVICE_PROJECTION_V2_POLICY_VERSION,
    assetId,
    animeId: target.moemoaAnimeId,
    kind: 'SYSTEM_DESIGN',
    availability: 'SERVICE_GENERATED',
    rightsBasis: 'SYSTEM_GENERATED',
  });
  const search = hashed({
    schemaVersion: SERVICE_PROJECTION_V2_SCHEMA_VERSION,
    policyVersion: SERVICE_PROJECTION_V2_POLICY_VERSION,
    animeId: target.moemoaAnimeId,
    anilistId: externalIdRows(canonical).find((row) => row.provider === 'anilist')?.externalId ?? null,
    preferredTitle: preferred.value,
    preferredLocale: preferred.locale,
    searchAliases: aliases.slice(0, 32),
    format: text(scalar(canonical.format), 40),
    status: text(scalar(canonical.status), 40),
    episodeCount: safeInteger(scalar(canonical.episodeCount), 1),
    sourceMaterialType: text(scalar(canonical.sourceMaterialType), 60),
    releaseYear: releaseYear ? Number(releaseYear) : null,
    season: text(scalar(canonical.season), 20),
    studios: studios.map((row) => row.name).slice(0, 3),
    genres: (coreGenres.length ? coreGenres : sourceGenres).slice(0, 8),
    readiness: source.readiness.status,
    coverAssetId: assetId,
  });
  const pages = [];
  for (let index = 0; index < people.length; index += pageSize) {
    const entries = people.slice(index, index + pageSize);
    pages.push(hashed({
      schemaVersion: SERVICE_PROJECTION_V2_SCHEMA_VERSION,
      policyVersion: SERVICE_PROJECTION_V2_POLICY_VERSION,
      animeId: target.moemoaAnimeId,
      page: pages.length + 1,
      pageSize,
      totalCount: people.length,
      entries,
    }));
  }
  const detail = hashed({
    schemaVersion: SERVICE_PROJECTION_V2_SCHEMA_VERSION,
    policyVersion: SERVICE_PROJECTION_V2_POLICY_VERSION,
    animeId: target.moemoaAnimeId,
    externalIds: externalIdRows(canonical),
    titles,
    preferredTitle: preferred,
    release: {
      format: text(scalar(canonical.format), 40), status: text(scalar(canonical.status), 40),
      season: text(scalar(canonical.season), 20),
      startDate: text(scalar(canonical.startDate), 40), endDate: text(scalar(canonical.endDate), 40),
      episodeCount: safeInteger(scalar(canonical.episodeCount), 1),
      sourceMaterialType: text(scalar(canonical.sourceMaterialType), 60),
    },
    studios,
    genres: { core: coreGenres, source: sourceGenres },
    officialLinks: officialLinks(source),
    relations: relationRows(canonical),
    people: {
      characterCount: people.length,
      castingCount: people.reduce((sum, row) => sum + row.castings.length, 0),
      pageCount: pages.length,
      pageSize,
      featuredCharacterIds: people.slice(0, 8).map((row) => row.characterId),
    },
    readiness: clone(source.readiness),
    dataQuality: { warnings: clone(source.qualityWarnings), reviewItems: clone(source.reviewItems) },
    coverAssetId: assetId,
  });
  const core = {
    schemaVersion: SERVICE_PROJECTION_V2_SCHEMA_VERSION,
    animeId: target.moemoaAnimeId,
    search,
    detail,
    people: pages,
    asset,
  };
  return frozen({ ...core, bundleHash: sha256(core) });
}

function validHashedRow(row) {
  if (!plainObject(row) || !HASH.test(row.rowHash ?? '')) return false;
  const { rowHash, ...core } = row;
  return sha256(core) === rowHash;
}

export function validateServiceProjectionV2Bundle(value) {
  if (!plainObject(value) || value.schemaVersion !== SERVICE_PROJECTION_V2_SCHEMA_VERSION
    || !ANIME_ID.test(value.animeId ?? '') || !HASH.test(value.bundleHash ?? '')
    || !validHashedRow(value.search) || !validHashedRow(value.detail) || !validHashedRow(value.asset)
    || !Array.isArray(value.people) || value.people.some((row) => !validHashedRow(row))
    || value.search.animeId !== value.animeId || value.detail.animeId !== value.animeId
    || value.asset.animeId !== value.animeId || value.search.coverAssetId !== value.asset.assetId
    || value.detail.coverAssetId !== value.asset.assetId
    || value.people.some((row, index) => row.animeId !== value.animeId || row.page !== index + 1)) return false;
  const { bundleHash, ...core } = value;
  return sha256(core) === bundleHash;
}
