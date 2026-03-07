const ENDPOINT = "https://graphql.anilist.co";
const ANILIST_API = ENDPOINT; // ✅ alias (변수명 유지용)
const REQUEST_TIMEOUT_MS = 7000;
const REQUEST_RETRIES = 2;
const RETRY_DELAYS_MS = [300, 900, 1800];

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function retryDelay(attempt) {
  return RETRY_DELAYS_MS[Math.min(attempt, RETRY_DELAYS_MS.length - 1)];
}

function isRetryableStatus(status) {
  return status === 429 || status >= 500;
}

function isRetryableError(err) {
  const message = String(err?.message || "").toLowerCase();
  return (
    err?.name === "AbortError" ||
    message.includes("failed to fetch") ||
    message.includes("networkerror") ||
    message.includes("timed out")
  );
}

async function postGraphQL(query, variables) {
  for (let attempt = 0; attempt <= REQUEST_RETRIES; attempt++) {
    try {
      const ac = new AbortController();
      const timer = setTimeout(() => ac.abort(), REQUEST_TIMEOUT_MS);

      let res;
      try {
        res = await fetch(ANILIST_API, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ query, variables }),
          signal: ac.signal,
        });
      } finally {
        clearTimeout(timer);
      }

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        if (attempt < REQUEST_RETRIES && isRetryableStatus(res.status)) {
          await sleep(retryDelay(attempt));
          continue;
        }
        throw new Error(`AniList ${res.status}: ${text}`);
      }

      const json = await res.json();
      if (json.errors?.length) {
        const message = String(json.errors[0]?.message || "AniList GraphQL error");
        if (attempt < REQUEST_RETRIES && /timeout|rate|temporar|internal/i.test(message)) {
          await sleep(retryDelay(attempt));
          continue;
        }
        throw new Error(message);
      }

      return json.data;
    } catch (err) {
      if (attempt < REQUEST_RETRIES && isRetryableError(err)) {
        await sleep(retryDelay(attempt));
        continue;
      }
      throw err;
    }
  }

  throw new Error("AniList request failed after retries");
}

const CARD_FIELDS = `
  id
  siteUrl
  title { romaji english native }
  synonyms
  genres
  coverImage { large }
  seasonYear
  format
  episodes
`;

async function fetchAnimeByIdsInternal(ids, { includeCharacters = true } = {}) {
  const unique = Array.from(new Set(ids))
    .map((x) => Number(x))
    .filter(Number.isFinite);

  if (!unique.length) return new Map();

  const extraFields = includeCharacters
    ? `
      characters(page: 1, perPage: 12, sort: [ROLE, RELEVANCE]) {
        edges {
          role
          node {
            id
            name { full native }
            image { medium large }
          }
        }
      }
    `
    : "";

  const QUERY = `
    query ($ids: [Int]) {
      Page(perPage: 50) {
        media(id_in: $ids, type: ANIME) {
${CARD_FIELDS}
${extraFields}
        }
      }
    }
  `;

  const map = new Map();
  for (const part of chunk(unique, 50)) {
    const data = await postGraphQL(QUERY, { ids: part });
    const list = data?.Page?.media ?? [];
    for (const m of list) map.set(m.id, m);
  }
  return map;
}

/**
 * 영문/로마자 제목으로 AniList에서 "바로 검색" (자동완성용)
 * @param {string} search
 * @param {number} perPage
 * @returns {Promise<any[]>} media[]
 */
export async function searchAnimeByTitle(search, perPage = 10) {
  const QUERY = `
    query ($search: String, $perPage: Int) {
      Page(page: 1, perPage: $perPage) {
        media(search: $search, type: ANIME, sort: POPULARITY_DESC) {
          id
          siteUrl
          title { romaji english native }
          synonyms
          genres
          coverImage { large }
          seasonYear
          format
          episodes
        }
      }
    }
  `;
  const data = await postGraphQL(QUERY, { search, perPage });
  return data?.Page?.media ?? [];
}

// ---- cache ----
const MEDIA_CACHE_KEY = "anime:mediaCache:v1";
const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7일
const CACHE_MAX_ENTRIES = 1500;

function pruneMediaCacheObject(obj) {
  const now = Date.now();
  let changed = false;
  const validEntries = [];

  for (const [id, entry] of Object.entries(obj || {})) {
    if (!entry || typeof entry !== "object" || !entry.media || typeof entry.media !== "object") {
      changed = true;
      continue;
    }

    const ts = Number(entry.ts);
    if (Number.isFinite(ts) && now - ts > CACHE_TTL_MS) {
      changed = true;
      continue;
    }

    const safeTs = Number.isFinite(ts) ? ts : now;
    if (!Number.isFinite(ts)) changed = true;
    validEntries.push([id, { ts: safeTs, media: entry.media }]);
  }

  validEntries.sort((a, b) => b[1].ts - a[1].ts);
  if (validEntries.length > CACHE_MAX_ENTRIES) changed = true;

  return {
    cache: Object.fromEntries(validEntries.slice(0, CACHE_MAX_ENTRIES)),
    changed,
  };
}

function isFreshCacheEntry(entry, now = Date.now()) {
  if (!entry?.media || typeof entry.media !== "object") return false;
  const ts = Number(entry.ts);
  if (!Number.isFinite(ts)) return true;
  return now - ts <= CACHE_TTL_MS;
}

function loadMediaCache() {
  try {
    // SSR 대비(혹시 서버에서 import될 경우)
    if (typeof window === "undefined") return {};
    const raw = localStorage.getItem(MEDIA_CACHE_KEY);
    const obj = raw ? JSON.parse(raw) : {};
    if (!obj || typeof obj !== "object") return {};

    const { cache, changed } = pruneMediaCacheObject(obj);
    if (changed) localStorage.setItem(MEDIA_CACHE_KEY, JSON.stringify(cache));
    return cache;
  } catch {
    return {};
  }
}

function saveMediaCache(patch) {
  try {
    if (typeof window === "undefined") return;
    const cur = loadMediaCache();
    const merged = { ...cur, ...patch };
    const { cache } = pruneMediaCacheObject(merged);
    localStorage.setItem(MEDIA_CACHE_KEY, JSON.stringify(cache));
  } catch {}
}

// 캐시에서만 Map을 만들어 반환(네트워크 X)
export function getCachedAnimeMap(ids) {
  const cache = loadMediaCache();
  const map = new Map();
  const now = Date.now();
  for (const id of ids) {
    const e = cache[id];
    if (!isFreshCacheEntry(e, now)) continue;
    map.set(Number(id), e.media);
  }
  return map;
}

/**
 * 여러 anilistId를 한 번에 조회(상세/캐릭터 포함)
 * @param {number[]} ids
 * @returns {Promise<Map<number, any>>}
 */
export async function fetchAnimeByIds(ids) {
  return fetchAnimeByIdsInternal(ids, { includeCharacters: true });
}

/**
 * 검색 카드용 경량 조회(캐릭터 미포함)
 * @param {number[]} ids
 * @returns {Promise<Map<number, any>>}
 */
export async function fetchAnimeCardsByIds(ids) {
  return fetchAnimeByIdsInternal(ids, { includeCharacters: false });
}

// 캐시 + 누락분만 네트워크 조회해서 Map 반환
export async function fetchAnimeByIdsCached(ids, options = {}) {
  const includeCharacters = options?.includeCharacters !== false;
  const cache = loadMediaCache();
  const now = Date.now();
  const need = [];

  for (const id of ids) {
    const e = cache[id];

    // ✅ 새로 추가: genres가 없는 캐시는 한 번 갱신해서 채우기
    const missingGenres = !!e?.media && !Array.isArray(e.media.genres);
    const missingCharacters = includeCharacters && !!e?.media && !e.media.characters;

    if (!isFreshCacheEntry(e, now)) {
      need.push(id);
      continue;
    }
    if (missingGenres) {
      need.push(id);
      continue;
    }
    if (missingCharacters) {
      need.push(id);
      continue;
    }
  }

  const map = new Map();
  for (const id of ids) {
    const e = cache[id];
    if (isFreshCacheEntry(e, now)) map.set(Number(id), e.media);
  }

  if (need.length) {
    const freshMap = includeCharacters
      ? await fetchAnimeByIds(need)
      : await fetchAnimeCardsByIds(need);
    const patch = {};
    for (const [id, media] of freshMap.entries()) {
      patch[id] = { ts: Date.now(), media };
      map.set(id, media);
    }
    saveMediaCache(patch);
  }

  return map;
}
