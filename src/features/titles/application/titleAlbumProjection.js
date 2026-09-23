const ANIME_ID = /^anime:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const POSITIVE_INTEGER = /^[1-9]\d{0,11}$/u;

const text = (value) => String(value || "").normalize("NFKC").trim().replace(/\s+/gu, " ");

const anilistIdOf = (value) => {
  const raw = String(value ?? "");
  if (!POSITIVE_INTEGER.test(raw)) return null;
  const id = Number(raw);
  return Number.isSafeInteger(id) ? id : null;
};

const memorySourceKind = (asset) => {
  if (asset?.imageType === "CATALOG_COVER") return "CATALOG_COVER";
  if (asset?.imageType === "SYSTEM_DESIGN" || asset?.designSpec) return "SYSTEM_DESIGN";
  if (text(asset?.localRef)) return "USER_IMAGE";
  return "MISSING";
};

const previewPriority = Object.freeze({
  USER_IMAGE: 0,
  SYSTEM_DESIGN: 1,
  CATALOG_COVER: 2,
  MISSING: 3,
});

function memoryIdentity(bundle) {
  if (!bundle?.card || bundle.card.status !== "COMPLETE_PRIVATE" || bundle.card.deletedAt) return null;
  const title = bundle.title;
  if (bundle.card.privateTitleId) {
    const privateTitleId = text(bundle.card.privateTitleId);
    if (!privateTitleId || text(title?.id) !== privateTitleId) return null;
    return {
      key: `PRIVATE:${privateTitleId}`,
      titleRef: { kind: "PRIVATE_TITLE", privateTitleId },
      anilistId: null,
      displayTitle: text(title?.displayTitle) || "Private title",
      isPrivateTitle: true,
    };
  }
  const anilistId = title?.sourceBinding?.provider === "ANILIST"
    ? anilistIdOf(title.sourceBinding.externalId)
    : null;
  const animeId = text(title?.catalogAnimeId).toLowerCase();
  if (anilistId == null && !ANIME_ID.test(animeId)) return null;
  return {
    key: anilistId == null ? animeId : `ANILIST:${anilistId}`,
    titleRef: ANIME_ID.test(animeId)
      ? { kind: "ANIME", animeId }
      : { kind: "LEGACY_ANILIST", anilistId },
    anilistId,
    displayTitle: text(title?.displayTitle) || `#${anilistId}`,
    isPrivateTitle: false,
  };
}

function detailIdentity(detail) {
  const animeId = text(detail?.animeId).toLowerCase();
  const anilistId = detail?.sourceBinding?.provider === "ANILIST"
    ? anilistIdOf(detail.sourceBinding.externalId)
    : null;
  if (!ANIME_ID.test(animeId)) return null;
  return {
    key: anilistId == null ? animeId : `ANILIST:${anilistId}`,
    titleRef: { kind: "ANIME", animeId },
    anilistId,
    displayTitle: text(detail?.preferredTitle?.value) || `#${anilistId}`,
    isPrivateTitle: false,
  };
}

const createAlbum = (identity) => ({
  ...identity,
  aliases: [],
  genres: [],
  officialCover: null,
  catalogDetail: null,
  libraryItem: null,
  tracking: { isSaved: false, watchStatus: null, rating: null },
  memories: [],
});

const ensureAlbum = (albums, identity) => {
  if (!albums.has(identity.key)) albums.set(identity.key, createAlbum(identity));
  return albums.get(identity.key);
};

function applyDetail(album, detail, identity) {
  album.titleRef = identity.titleRef;
  album.anilistId = identity.anilistId;
  album.displayTitle = identity.displayTitle;
  album.catalogDetail = detail;
  album.aliases = (Array.isArray(detail.titles) ? detail.titles : [])
    .map((row) => text(row?.value)).filter((value) => value && value !== album.displayTitle).slice(0, 24);
  const genres = detail.genres?.core?.length ? detail.genres.core : detail.genres?.source;
  album.genres = Array.isArray(genres) ? genres.map(text).filter(Boolean).slice(0, 16) : [];
  const src = text(detail.cover?.publicUrl);
  album.officialCover = src ? {
    catalogCoverId: detail.cover?.catalogCoverRef?.catalogCoverId || null,
    src,
    width: Number(detail.cover?.width) || null,
    height: Number(detail.cover?.height) || null,
  } : null;
}

function finalize(album) {
  const memories = album.memories.sort((left, right) => (
    right.card.updatedAt.localeCompare(left.card.updatedAt) || left.card.id.localeCompare(right.card.id)
  ));
  const previewMemories = [...memories].sort((left, right) => (
    previewPriority[left.sourceKind] - previewPriority[right.sourceKind]
    || right.card.updatedAt.localeCompare(left.card.updatedAt)
  )).slice(0, 3);
  const isSaved = album.tracking.isSaved;
  const memoryCount = memories.length;
  return Object.freeze({
    ...album,
    memories,
    memoryCount,
    previewMemories,
    latestMemoryAt: memories[0]?.card.updatedAt || null,
    presence: isSaved
      ? (memoryCount ? "SAVED_WITH_MEMORY" : "SAVED_NO_MEMORY")
      : (memoryCount ? "NOT_SAVED_WITH_MEMORY" : "NOT_SAVED_NO_MEMORY"),
  });
}

export function buildTitleAlbumProjections({
  libraryItems = [],
  memoryBundles = [],
  catalogDetails = [],
  includeBrowse = false,
} = {}) {
  const albums = new Map();
  // Bridge previously saved catalog-only rows when an optional binding is added later.
  const byAnimeId = new Map();
  for (const detail of catalogDetails) {
    const identity = detailIdentity(detail);
    if (identity) byAnimeId.set(identity.titleRef.animeId, identity);
  }
  for (const bundle of memoryBundles) {
    const identity = memoryIdentity(bundle);
    if (identity?.titleRef.kind === "ANIME" && identity.anilistId && !byAnimeId.has(identity.titleRef.animeId)) {
      byAnimeId.set(identity.titleRef.animeId, identity);
    }
  }
  const bridge = (identity) => identity?.titleRef.kind === "ANIME"
    ? { ...identity, key: byAnimeId.get(identity.titleRef.animeId)?.key || identity.key }
    : identity;

  for (const item of Array.isArray(libraryItems) ? libraryItems : []) {
    const anilistId = anilistIdOf(item?.anilistId);
    const animeId = text(item?.catalogAnimeId).toLowerCase();
    if (anilistId == null && !ANIME_ID.test(animeId)) continue;
    const identity = {
      key: anilistId == null ? animeId : `ANILIST:${anilistId}`,
      titleRef: ANIME_ID.test(animeId) ? { kind: "ANIME", animeId } : { kind: "LEGACY_ANILIST", anilistId },
      anilistId,
      displayTitle: text(item?.koTitle) || `#${anilistId}`,
      isPrivateTitle: false,
    };
    const album = ensureAlbum(albums, bridge(identity));
    album.libraryItem = structuredClone(item);
    album.tracking = {
      isSaved: true,
      watchStatus: text(item?.status) || null,
      rating: item?.score != null && String(item.score).trim() !== "" && Number.isFinite(Number(item.score)) ? Number(item.score) : null,
    };
  }

  for (const bundle of Array.isArray(memoryBundles) ? memoryBundles : []) {
    const identity = memoryIdentity(bundle);
    if (!identity) continue;
    const album = ensureAlbum(albums, bridge(identity));
    if (album.displayTitle.startsWith("#") || album.isPrivateTitle) {
      album.displayTitle = identity.displayTitle;
    }
    if (identity.titleRef.kind === "ANIME") album.titleRef = identity.titleRef;
    album.memories.push({
      ...structuredClone(bundle),
      sourceKind: memorySourceKind(bundle.asset),
    });
  }

  for (const detail of Array.isArray(catalogDetails) ? catalogDetails : []) {
    const identity = detailIdentity(detail);
    if (!identity || (!includeBrowse && !albums.has(identity.key))) continue;
    applyDetail(ensureAlbum(albums, identity), detail, identity);
  }

  return [...albums.values()].map(finalize).sort((left, right) => (
    String(right.latestMemoryAt || "").localeCompare(String(left.latestMemoryAt || ""))
    || Number(right.libraryItem?.addedAt || 0) - Number(left.libraryItem?.addedAt || 0)
    || left.displayTitle.localeCompare(right.displayTitle)
  ));
}
