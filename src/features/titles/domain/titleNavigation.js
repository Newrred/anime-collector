import { toPlatformAppHref } from "../../../domain/search/memoryCardNavigation.js";

const ANIME_ID = /^anime:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

const joinBase = (base, path) => {
  const prefix = String(base || "/").endsWith("/") ? String(base || "/") : `${base}/`;
  return `${prefix}${path}`;
};

export function buildTitleHubHref({ base = "/", native = false, titleRef, anilistId, title } = {}) {
  const params = new URLSearchParams();
  if (titleRef?.kind === "ANIME" && ANIME_ID.test(String(titleRef.animeId || ""))) {
    params.set("animeId", String(titleRef.animeId).toLowerCase());
  } else if (titleRef?.kind === "PRIVATE_TITLE" && String(titleRef.privateTitleId || "").trim()) {
    params.set("privateTitleId", String(titleRef.privateTitleId).trim());
  } else {
    const id = Number(anilistId ?? titleRef?.anilistId);
    if (Number.isSafeInteger(id) && id > 0) params.set("anilistId", String(id));
  }
  const displayTitle = String(title || "").normalize("NFKC").trim().replace(/\s+/gu, " ").slice(0, 120);
  if (displayTitle) params.set("title", displayTitle);
  const href = `${joinBase(base, "title/")}?${params}`;
  return toPlatformAppHref(href, { native });
}

export function buildMemoryTitleHubHref({ bundle, base = "/", native = false } = {}) {
  const { card, title } = bundle || {};
  let titleRef;
  if (card?.privateTitleId) titleRef = { kind: "PRIVATE_TITLE", privateTitleId: card.privateTitleId };
  else if (ANIME_ID.test(String(title?.catalogAnimeId || ""))) titleRef = { kind: "ANIME", animeId: title.catalogAnimeId };
  else if (title?.sourceBinding?.provider === "ANILIST") {
    const id = Number(title.sourceBinding.externalId);
    if (Number.isSafeInteger(id) && id > 0) titleRef = { anilistId: id };
  }
  if (!titleRef) return null;
  return buildTitleHubHref({ base, native, titleRef, title: title?.displayTitle });
}

export function parseTitleHubRequest(search = "") {
  const params = new URLSearchParams(String(search || ""));
  const animeId = String(params.get("animeId") || "").toLowerCase();
  const privateTitleId = String(params.get("privateTitleId") || "").trim();
  const anilistId = Number(params.get("anilistId"));
  const title = String(params.get("title") || "").normalize("NFKC").trim().replace(/\s+/gu, " ").slice(0, 120);
  if (ANIME_ID.test(animeId)) return { kind: "ANIME", animeId, title };
  if (privateTitleId && privateTitleId.length <= 160) return { kind: "PRIVATE_TITLE", privateTitleId, title };
  if (Number.isSafeInteger(anilistId) && anilistId > 0) return { kind: "LEGACY_ANILIST", anilistId, title };
  return null;
}

// Keep editing on the compatibility screen until its controls move into Title Hub.
export function resolveLegacyLibraryHref({ base = "/", search = "", native = false } = {}) {
  const params = new URLSearchParams(search);
  const focus = String(params.get("focus") || "").trim().toLowerCase();
  if (focus === "quick-log" || focus === "edit") return null;
  const rawId = params.get("animeId") || "";
  if (/^[1-9]\d{0,11}$/u.test(rawId)) {
    return buildTitleHubHref({ base, native, anilistId: Number(rawId), title: params.get("title") });
  }
  if (ANIME_ID.test(rawId)) {
    return buildTitleHubHref({ base, native, titleRef: { kind: "ANIME", animeId: rawId }, title: params.get("title") });
  }
  return toPlatformAppHref(joinBase(base, "titles/"), { native });
}
