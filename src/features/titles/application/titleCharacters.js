import { fetchAnimeByIdsCached } from "../../../lib/anilist.js";
import { createSupabaseCatalogRepository } from "../../catalog/catalogRepository.js";
import { isCatalogSupabaseConfigured } from "../../catalog/catalogSupabaseClient.js";

export function createTitleCharactersReader({
  catalog = isCatalogSupabaseConfigured ? createSupabaseCatalogRepository() : null,
  readMedia = fetchAnimeByIdsCached,
} = {}) {
  return async ({ animeId, anilistId, page = 1 }) => {
    let catalogFailed = false;
    if (animeId && catalog?.getPeople) {
      try {
        const result = await catalog.getPeople(animeId, page);
        if (result?.entries.length) return { source: "CATALOG", page, hasMore: page * 30 < result.totalCount,
          characters: result.entries.map(row => ({ source: "CATALOG", id: row.characterId, name: row.name, role: row.role, castings: row.castings })) };
        if (page > 1) return { source: "CATALOG", page, hasMore: false, characters: [] };
      } catch { catalogFailed = true; }
    }
    // Later catalog pages must not silently append a different provider's first page.
    if (catalogFailed && page > 1) throw new Error("TITLE_CHARACTERS_UNAVAILABLE");
    const id = Number(anilistId);
    if (!Number.isSafeInteger(id) || id < 1) {
      if (catalogFailed) throw new Error("TITLE_CHARACTERS_UNAVAILABLE");
      return { source: null, page: 1, hasMore: false, characters: [] };
    }
    const media = (await readMedia([id], { includeCharacters: true, includeRelations: false })).get(id);
    if (Number(media?.id) !== id || !Array.isArray(media?.characters?.edges)) throw new Error("TITLE_CHARACTERS_UNAVAILABLE");
    const characters = media.characters.edges.flatMap(row => {
      const characterId = Number(row?.node?.id), name = String(row?.node?.name?.native || row?.node?.name?.full || "").trim();
      if (!Number.isSafeInteger(characterId) || characterId < 1 || !name) return [];
      const image = String(row.node.image?.medium || row.node.image?.large || "");
      return [{ source: "ANILIST", id: String(characterId), name, role: String(row.role || ""),
        image: /^https:\/\/s4\.anilist\.co\//u.test(image) ? image : null, castings: [] }];
    });
    return { source: "ANILIST", page: 1, hasMore: false, characters };
  };
}
