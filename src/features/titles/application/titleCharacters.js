import { createSupabaseCatalogRepository } from "../../catalog/catalogRepository.js";
import { isCatalogSupabaseConfigured } from "../../catalog/catalogSupabaseClient.js";

export function catalogCharacterAniListId(value) {
  const match = typeof value === "string" ? /^(?:anilist:)?([1-9]\d*)$/u.exec(value) : null;
  const id = typeof value === "string" ? Number(match?.[1]) : Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export function createTitleCharactersReader({
  catalog = isCatalogSupabaseConfigured ? createSupabaseCatalogRepository() : null,
} = {}) {
  return async ({ animeId, page = 1 }) => {
    if (!animeId) return { source: null, page: 1, hasMore: false, characters: [] };
    if (!catalog?.getPeople) throw new Error("TITLE_CHARACTERS_UNAVAILABLE");
    let result;
    try { result = await catalog.getPeople(animeId, page); }
    catch { throw new Error("TITLE_CHARACTERS_UNAVAILABLE"); }
    return { source: "CATALOG", page, hasMore: Boolean(result && page * 30 < result.totalCount),
      characters: (result?.entries ?? []).map(row => ({ source: "CATALOG", id: row.characterId, name: row.name, role: row.role, castings: row.castings })) };
  };
}
