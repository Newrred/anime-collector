const RESULT_KEYS = Object.freeze([
  'aliases', 'catalogSource', 'coverPreviewUrl', 'displayTitle', 'genres', 'kind',
  'readiness', 'sourceBinding', 'verificationState',
]);

function typedError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function exactObject(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const actual = Object.keys(value).sort();
  return actual.length === keys.length && actual.every((key, index) => key === keys[index]);
}

function text(value, maximum) {
  if (typeof value !== 'string') return null;
  const normalized = value.normalize('NFKC').trim().replace(/\s+/gu, ' ');
  return normalized && [...normalized].length <= maximum ? normalized : null;
}

function stringList(value, maximumItems, maximumLength) {
  if (!Array.isArray(value) || value.length > maximumItems) return null;
  const result = value.map((item) => text(item, maximumLength));
  return result.some((item) => item === null) ? null : result;
}

function candidate(value) {
  if (!exactObject(value, RESULT_KEYS)
    || !exactObject(value.sourceBinding, ['externalId', 'provider'])) return null;
  const externalId = String(value.sourceBinding.externalId ?? '');
  const displayTitle = text(value.displayTitle, 240);
  const aliases = stringList(value.aliases, 24, 240);
  const genres = stringList(value.genres, 16, 80);
  const coverUrl = value.coverPreviewUrl === null ? null : String(value.coverPreviewUrl ?? '');
  if (value.kind !== 'ANIME_REF' || !displayTitle || !aliases || !genres
    || value.sourceBinding.provider !== 'ANILIST' || !/^[1-9]\d{0,11}$/u.test(externalId)
    || value.verificationState !== 'PROVIDER_CANDIDATE'
    || value.catalogSource !== 'LOCAL_TEST_SERVICE_PROJECTION'
    || !['BLOCKED', 'READY_WITH_REVIEW', 'READY_WITH_GAPS', 'READY'].includes(value.readiness)
    || (coverUrl !== null && coverUrl !== `/__moemoa-dev/catalog/cover/${externalId}`)) return null;
  return {
    kind: 'ANIME_REF', displayTitle, aliases, genres,
    sourceBinding: { provider: 'ANILIST', externalId },
    verificationState: 'PROVIDER_CANDIDATE',
    catalogSource: 'LOCAL_TEST_SERVICE_PROJECTION',
    readiness: value.readiness,
    coverPreviewUrl: coverUrl,
  };
}

function parseResponse(value) {
  if (!exactObject(value, ['results', 'schemaVersion']) || value.schemaVersion !== 1
    || !Array.isArray(value.results) || value.results.length > 12) {
    throw typedError('DEV_CATALOG_RESPONSE_INVALID');
  }
  const results = value.results.map(candidate);
  if (results.some((row) => row === null)) throw typedError('DEV_CATALOG_RESPONSE_INVALID');
  return results;
}

export function createDevCatalogTitleResolver({
  fetchImpl = globalThis.fetch,
  endpoint = '/__moemoa-dev/catalog/search',
  timeoutMs = 1_200,
} = {}) {
  if (typeof fetchImpl !== 'function' || endpoint !== '/__moemoa-dev/catalog/search'
    || !Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 10_000) {
    throw new TypeError('Development catalog resolver configuration is invalid');
  }
  return Object.freeze({
    async search(query) {
      const normalized = String(query ?? '').normalize('NFKC').trim().replace(/\s+/gu, ' ');
      if ([...normalized].length < 2) return [];
      if ([...normalized].length > 120) throw typedError('DEV_CATALOG_QUERY_INVALID');
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetchImpl(`${endpoint}?${new URLSearchParams({ q: normalized })}`, {
          method: 'GET',
          credentials: 'same-origin',
          cache: 'no-store',
          headers: { Accept: 'application/json' },
          signal: controller.signal,
        });
        if (!response?.ok) throw typedError('DEV_CATALOG_UNAVAILABLE');
        const body = await response.text();
        if (body.length > 128 * 1024) throw typedError('DEV_CATALOG_RESPONSE_INVALID');
        let parsed;
        try { parsed = JSON.parse(body); } catch { throw typedError('DEV_CATALOG_RESPONSE_INVALID'); }
        return parseResponse(parsed);
      } catch (error) {
        if (error?.code) throw error;
        throw typedError('DEV_CATALOG_UNAVAILABLE');
      } finally {
        clearTimeout(timeout);
      }
    },
  });
}

export function createFallbackCatalogTitleResolver({ primary, fallback } = {}) {
  if (typeof primary?.search !== 'function' || typeof fallback?.search !== 'function') {
    throw new TypeError('Primary and fallback catalog resolvers are required');
  }
  return Object.freeze({
    async search(query) {
      try { return await primary.search(query); } catch { return fallback.search(query); }
    },
  });
}
