const CATALOG_ANIME_ID = /^anime:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function joinBase(base, path) {
  const normalized = String(base || "/").endsWith("/") ? String(base || "/") : `${base}/`;
  return `${normalized}${path}`;
}

export function buildMemoryCardHref({ base = "/", row } = {}) {
  const params = new URLSearchParams();
  const catalogAnimeId = String(row?.catalogAnimeId || "").trim();
  const title = String(row?.title || "").trim();
  if (CATALOG_ANIME_ID.test(catalogAnimeId)) params.set("animeId", catalogAnimeId);
  if (title) params.set("title", title);
  const query = params.toString();
  return `${joinBase(base, "memory/new/")}${query ? `?${query}` : ""}`;
}
