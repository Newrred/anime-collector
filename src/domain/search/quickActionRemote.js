import aliasSeed from "../../data/aliases.json";
import { fetchAnimeCardsByIds, searchAnimeByTitle } from "../../lib/anilist.js";
import {
  wikidataGetKoTitlesByAniListIds,
  wikidataSearchKoToAniListExpanded,
} from "../../lib/wikidata.js";
import {
  isFreshSearchCacheEntry,
  loadSearchCacheMap,
  persistSearchCacheMap,
  setSearchCacheEntry,
} from "../../repositories/searchCacheRepo.js";

function isHangulQuery(query) {
  return /[ㄱ-ㅎㅏ-ㅣ가-힣]/.test(String(query || ""));
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKC")
    .replace(/\s+/g, "")
    .replace(/[^\p{L}\p{N}]/gu, "");
}

function buildAliasEntries(seed) {
  if (!Array.isArray(seed)) return [];
  const rows = [];
  for (const row of seed) {
    const id = Number(row?.anilistId);
    if (!Number.isFinite(id)) continue;
    const names = [row?.ko, ...(Array.isArray(row?.aliases) ? row.aliases : [])]
      .map((value) => String(value || "").trim())
      .filter(Boolean);
    if (!names.length) continue;
    rows.push({ id, ko: String(row?.ko || "").trim() || null, names });
  }
  return rows;
}

function findAliasMatches(query, aliasEntries, limit = 18) {
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) return [];

  const hits = [];
  for (const row of aliasEntries) {
    let best = 0;
    for (const name of row.names) {
      const normalizedName = normalizeText(name);
      if (!normalizedName) continue;
      if (normalizedName === normalizedQuery) best = Math.max(best, 420);
      else if (normalizedName.startsWith(normalizedQuery)) best = Math.max(best, 320);
      else if (normalizedName.includes(normalizedQuery)) best = Math.max(best, 240);
    }
    if (best > 0) hits.push({ id: row.id, ko: row.ko, score: best, sourceRank: 0, src: "alias" });
  }

  return hits
    .sort((a, b) => b.score - a.score || a.id - b.id)
    .slice(0, limit);
}

function buildSubtitle(media) {
  const parts = [
    String(media?.title?.english || media?.title?.romaji || media?.title?.native || "").trim(),
  ];
  if (Number.isFinite(Number(media?.seasonYear))) parts.push(String(media.seasonYear));
  if (media?.format) parts.push(String(media.format));
  return parts.filter(Boolean).join(" · ");
}

const aliasEntries = buildAliasEntries(aliasSeed);

export async function searchRemoteCandidates(query, libraryIdSet = new Set()) {
  const trimmed = String(query || "").trim();
  if (trimmed.length < 2) return [];

  const key = `quick:${normalizeText(trimmed)}`;
  const cache = (await loadSearchCacheMap().catch(() => new Map())) || new Map();
  const cached = cache.get(key);

  if (cached && isFreshSearchCacheEntry(cached, Date.now())) {
    return (Array.isArray(cached.results) ? cached.results : [])
      .filter((row) => !libraryIdSet.has(Number(row?.id)))
      .slice(0, 8);
  }

  const candidateMap = new Map();

  function upsertCandidate(id, patch) {
    if (!Number.isFinite(Number(id))) return;
    const prev = candidateMap.get(Number(id));
    if (!prev) {
      candidateMap.set(Number(id), patch);
      return;
    }

    const next = { ...prev };
    if ((patch.sourceRank ?? 99) < (prev.sourceRank ?? 99)) {
      next.sourceRank = patch.sourceRank;
      next.src = patch.src;
    }
    if ((patch.score ?? 0) > (prev.score ?? 0)) next.score = patch.score;
    if (!next.ko && patch.ko) next.ko = patch.ko;
    candidateMap.set(Number(id), next);
  }

  const aliasHits = findAliasMatches(trimmed, aliasEntries, 14);
  for (const hit of aliasHits) {
    upsertCandidate(hit.id, hit);
  }

  let directMediaList = [];
  try {
    directMediaList = await searchAnimeByTitle(trimmed, 8);
    for (const media of directMediaList) {
      upsertCandidate(media?.id, { ko: null, score: 0, sourceRank: 2, src: "anilist" });
    }
  } catch {}

  if (isHangulQuery(trimmed)) {
    try {
      const depth = trimmed.length >= 4 ? 2 : 1;
      const wikidataRows = await wikidataSearchKoToAniListExpanded(trimmed, 18, depth);
      for (const row of wikidataRows) {
        upsertCandidate(row?.anilistId, {
          ko: /[가-힣]/.test(String(row?.koTitle || "")) ? String(row.koTitle).trim() : null,
          score: 0,
          sourceRank: 1,
          src: "wikidata",
        });
      }
    } catch {}
  }

  const candidateIds = [...candidateMap.entries()]
    .sort((a, b) => {
      const left = a[1] || {};
      const right = b[1] || {};
      if ((left.sourceRank ?? 99) !== (right.sourceRank ?? 99)) {
        return (left.sourceRank ?? 99) - (right.sourceRank ?? 99);
      }
      if ((left.score ?? 0) !== (right.score ?? 0)) return (right.score ?? 0) - (left.score ?? 0);
      return a[0] - b[0];
    })
    .map(([id]) => id)
    .filter((id) => !libraryIdSet.has(Number(id)))
    .slice(0, 16);

  const mediaMap = new Map();
  for (const media of directMediaList) {
    const id = Number(media?.id);
    if (candidateIds.includes(id)) mediaMap.set(id, media);
  }

  const missingIds = candidateIds.filter((id) => !mediaMap.has(id));
  if (missingIds.length) {
    const fetched = await fetchAnimeCardsByIds(missingIds).catch(() => new Map());
    for (const [id, media] of fetched.entries()) mediaMap.set(Number(id), media);
  }

  if (!isHangulQuery(trimmed) && candidateIds.length) {
    try {
      const koMap = await wikidataGetKoTitlesByAniListIds(candidateIds);
      for (const id of candidateIds) {
        const koTitle = String(koMap?.get?.(id) || "").trim();
        if (koTitle) {
          upsertCandidate(id, {
            ...(candidateMap.get(id) || {}),
            ko: koTitle,
          });
        }
      }
    } catch {}
  }

  const rows = candidateIds
    .map((id) => {
      const media = mediaMap.get(Number(id));
      if (!media) return null;
      const meta = candidateMap.get(Number(id)) || {};
      return {
        kind: "remote",
        id: Number(id),
        ko: meta.ko || null,
        media,
        src: meta.src || "anilist",
        title:
          String(meta.ko || "").trim() ||
          String(media?.title?.native || media?.title?.english || media?.title?.romaji || "").trim() ||
          `#${id}`,
        subtitle: buildSubtitle(media),
        poster: media?.coverImage?.medium || media?.coverImage?.large || "",
      };
    })
    .filter(Boolean)
    .slice(0, 8);

  setSearchCacheEntry(cache, key, rows);
  persistSearchCacheMap(cache).catch(() => {});
  return rows;
}
