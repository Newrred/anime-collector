const CATALOG_ID = /^anime:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
export const isWatchCatalogId = value => CATALOG_ID.test(String(value || ""));
export function watchLogIdentity(raw) {
  const catalogAnimeId = isWatchCatalogId(raw?.catalogAnimeId) ? String(raw.catalogAnimeId).toLowerCase() : null;
  return {
    anilistId: catalogAnimeId && raw?.anilistId == null ? null : Number(raw?.anilistId),
    ...(catalogAnimeId ? { catalogAnimeId } : {}),
  };
}
export const hasWatchLogIdentity = row => Number.isFinite(row?.anilistId) || isWatchCatalogId(row?.catalogAnimeId);
export function watchLogMatchesTitle(row, { catalogAnimeId, anilistId }) {
  return (isWatchCatalogId(catalogAnimeId) && row.catalogAnimeId === String(catalogAnimeId).toLowerCase())
    || (Number.isSafeInteger(anilistId) && anilistId > 0 && row.anilistId === anilistId);
}
