import { buildTitleAlbumProjections } from "./titleAlbumProjection.js";

const normalize = (value) => String(value || "").normalize("NFKC").toLowerCase().replace(/\s+/gu, "");

// The runtime supplies only the active owner's archive. Never resolve image bytes for search.
export function buildMemorySearchRows(bundles = []) {
  return buildTitleAlbumProjections({ memoryBundles: bundles }).map((album) => ({
    id: album.anilistId || album.key,
    kind: "memory",
    titleRef: album.titleRef,
    catalogAnimeId: album.titleRef.kind === "ANIME" ? album.titleRef.animeId : null,
    title: album.displayTitle,
    memoryCount: album.memoryCount,
    poster: "",
  }));
}

export function withTitlePresence(rows, memoryRows, savedIds) {
  const memories = new Map((memoryRows || []).map((row) => [row.id, row]));
  return rows.map((row) => ({
    ...memories.get(row.id),
    ...row,
    catalogAnimeId: row.catalogAnimeId || memories.get(row.id)?.catalogAnimeId,
    isSaved: savedIds.has(row.id),
    // null is an unavailable count, not a verified zero.
    memoryCount: memoryRows == null ? null : memories.get(row.id)?.memoryCount || 0,
  }));
}

export function searchMemoryOnlyRows(memoryRows, savedIds, query) {
  const term = normalize(query);
  if (!term) return [];
  return memoryRows.filter((row) => !savedIds.has(row.id) && normalize(row.title).includes(term)).slice(0, 6);
}
