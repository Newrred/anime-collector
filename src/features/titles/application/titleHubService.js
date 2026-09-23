import { readTitleLibrary, writeTitleLibrary } from "../../../repositories/titleLibraryRepo.js";
import { listWatchLogsByAnimeId } from "../../../repositories/watchLogRepo.js";
import { createSupabaseCatalogRepository } from "../../catalog/catalogRepository.js";
import { catalogSupabase, isCatalogSupabaseConfigured } from "../../catalog/catalogSupabaseClient.js";
import { getPlatformMemoryRuntime } from "../../memory/runtime/platformMemoryRuntime.js";
import { getPlatformTitleResolver } from "../../memory/runtime/platformTitleResolver.js";
import { buildTitleAlbumProjections } from "./titleAlbumProjection.js";

const requestKey = (request, detail) => {
  if (request.kind === "PRIVATE_TITLE") return `PRIVATE:${request.privateTitleId}`;
  const id = Number(detail?.sourceBinding?.externalId || request.anilistId);
  return Number.isSafeInteger(id) && id > 0 ? `ANILIST:${id}` : (detail?.animeId || request.animeId || null);
};

const memoryMatchesAnimeId = (bundle, animeId) => (
  String(bundle?.title?.catalogAnimeId || "").toLowerCase() === String(animeId || "").toLowerCase()
);

async function resolveDetail({ request, archive, catalogRepository, titleResolver }) {
  if (!catalogRepository) return null;
  if (request.kind === "ANIME") return catalogRepository.getDetail(request.animeId);
  if (request.kind !== "LEGACY_ANILIST") return null;
  if (typeof catalogRepository.getCollectionDetailsByAniListIds === "function") {
    const matches = await catalogRepository.getCollectionDetailsByAniListIds([request.anilistId]).catch(() => []);
    const exact = matches.find((row) => row.sourceBinding?.provider === "ANILIST" && Number(row.sourceBinding.externalId) === request.anilistId);
    if (exact?.animeId) {
      const detail = await catalogRepository.getDetail(exact.animeId).catch(() => null);
      if (detail) return detail;
    }
  }
  const bound = archive.find((bundle) => (
    bundle?.title?.sourceBinding?.provider === "ANILIST"
    && Number(bundle.title.sourceBinding.externalId) === request.anilistId
    && bundle.title.catalogAnimeId
  ));
  if (bound?.title?.catalogAnimeId) {
    const detail = await catalogRepository.getDetail(bound.title.catalogAnimeId).catch(() => null);
    if (detail) return detail;
  }
  if (!request.title || typeof titleResolver?.search !== "function") return null;
  const response = await titleResolver.search(request.title).catch(() => null);
  const candidates = Array.isArray(response?.results) ? response.results : Array.isArray(response) ? response : [];
  const exact = candidates.find((candidate) => (
    candidate?.sourceBinding?.provider === "ANILIST"
    && Number(candidate.sourceBinding.externalId) === request.anilistId
    && candidate.animeId
  ));
  return exact ? catalogRepository.getDetail(exact.animeId).catch(() => null) : null;
}

async function resolveMemoryVisual(memory, runtime) {
  const { asset, title } = memory;
  if (memory.sourceKind === "SYSTEM_DESIGN") {
    return { kind: "SYSTEM_DESIGN", designSpec: asset.designSpec };
  }
  if (memory.sourceKind === "USER_IMAGE" && asset.localRef) {
    const src = await runtime.getPreview(asset.localRef).catch(() => null);
    if (src) return { kind: "IMAGE", src, alt: `${title.displayTitle} 메모리 카드` };
  }
  if (memory.sourceKind === "CATALOG_COVER" && asset.catalogCoverRef) {
    const cover = await runtime.resolveCatalogCover(asset.catalogCoverRef).catch(() => null);
    if (cover?.publicUrl) return { kind: "IMAGE", src: cover.publicUrl, alt: `${title.displayTitle} 메모리 카드` };
  }
  return { kind: "MISSING" };
}

export function createTitleHubService({
  memoryRuntime = null,
  readLibrary = readTitleLibrary,
  writeLibrary = writeTitleLibrary,
  readWatchLogs = listWatchLogsByAnimeId,
  catalogRepository = isCatalogSupabaseConfigured
    ? createSupabaseCatalogRepository({ client: catalogSupabase })
    : null,
  titleResolver = getPlatformTitleResolver(),
  now = () => Date.now(),
  dispatchLibraryUpdated = () => globalThis.dispatchEvent?.(new Event("moemoa:library-updated")),
} = {}) {
  let runtimePromise = memoryRuntime ? Promise.resolve(memoryRuntime) : getPlatformMemoryRuntime();
  return Object.freeze({
    async load(request) {
      if (!request) return null;
      const runtime = await runtimePromise;
      await runtime.initialize();
      const [libraryItems, archive] = await Promise.all([
        readLibrary([]).catch(() => []),
        runtime.listArchive(),
      ]);
      let detail = null;
      let catalogError = null;
      try { detail = await resolveDetail({ request, archive, catalogRepository, titleResolver }); }
      catch (error) { catalogError = error; }
      const albums = buildTitleAlbumProjections({
        libraryItems,
        memoryBundles: archive,
        catalogDetails: detail ? [detail] : [],
        includeBrowse: true,
      });
      let key = requestKey(request, detail);
      if (request.kind === "ANIME" && !key) {
        const matching = archive.find((bundle) => memoryMatchesAnimeId(bundle, request.animeId));
        const id = Number(matching?.title?.sourceBinding?.externalId);
        if (Number.isSafeInteger(id) && id > 0) key = `ANILIST:${id}`;
      }
      const album = albums.find((candidate) => request.kind === "ANIME"
        ? candidate.titleRef?.kind === "ANIME" && candidate.titleRef.animeId === request.animeId
        : candidate.key === key);
      if (!album) {
        if (catalogError) throw catalogError;
        return null;
      }
      const memories = await Promise.all(album.memories.map(async (memory) => ({
        ...memory,
        visual: await resolveMemoryVisual(memory, runtime),
      })));
      const watchLogs = album.anilistId
        ? await readWatchLogs(album.anilistId).catch(() => [])
        : [];
      return { ...album, memories, watchLogs };
    },

    async updateTracking(album, { watchStatus, rating }) {
      if (album.titleRef?.kind !== "ANIME" || !album.tracking.isSaved) throw new Error("TITLE_NOT_SAVEABLE");
      if (!["미분류", "보는중", "완료", "보류", "하차", "볼예정"].includes(watchStatus)) throw new Error("INVALID_STATUS");
      const score = rating == null || String(rating).trim() === "" ? null : Number(rating);
      if (score != null && (!Number.isFinite(score) || score < 0 || score > 5)) throw new Error("INVALID_SCORE");
      const current = await readLibrary([]);
      let found = false;
      const next = current.map((item) => {
        if (item.catalogAnimeId !== album.titleRef.animeId && !(album.anilistId && Number(item.anilistId) === album.anilistId)) return item;
        found = true;
        return { ...item, status: watchStatus, score };
      });
      if (!found) throw new Error("TITLE_NOT_SAVEABLE");
      await writeLibrary(next);
      dispatchLibraryUpdated();
      return { ...album.tracking, watchStatus, rating: score };
    },

    async setSaved(album, shouldSave) {
      const anilistId = Number(album?.anilistId) || null;
      const catalogAnimeId = album?.titleRef?.kind === "ANIME" ? album.titleRef.animeId : null;
      if (!catalogAnimeId && (!Number.isSafeInteger(anilistId) || anilistId < 1)) throw new Error("TITLE_NOT_SAVEABLE");
      const current = await readLibrary([]);
      const matches = (item) => (catalogAnimeId && item.catalogAnimeId === catalogAnimeId) || (anilistId && Number(item?.anilistId) === anilistId);
      const existing = current.find(matches);
      if (shouldSave && existing) return true;
      const without = current.filter((item) => !matches(item));
      const next = shouldSave ? [...without, {
        anilistId,
        ...(catalogAnimeId ? { catalogAnimeId } : {}),
        koTitle: album.displayTitle,
        status: "미분류",
        score: null,
        memo: "",
        rewatchCount: 0,
        lastRewatchAt: null,
        addedAt: now(),
      }] : without;
      await writeLibrary(next);
      dispatchLibraryUpdated();
      return shouldSave;
    },
  });
}
