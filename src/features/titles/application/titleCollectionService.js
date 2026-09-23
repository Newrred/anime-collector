import { readTitleLibrary } from "../../../repositories/titleLibraryRepo.js";
import { createSupabaseCatalogRepository } from "../../catalog/catalogRepository.js";
import { catalogSupabase, isCatalogSupabaseConfigured } from "../../catalog/catalogSupabaseClient.js";
import { getPlatformMemoryRuntime } from "../../memory/runtime/platformMemoryRuntime.js";
import { buildTitleAlbumProjections } from "./titleAlbumProjection.js";

const aniListIdsFrom = (libraryItems, memoryBundles) => [...new Set([
  ...(Array.isArray(libraryItems) ? libraryItems : []).map((item) => Number(item?.anilistId)),
  ...(Array.isArray(memoryBundles) ? memoryBundles : []).map((bundle) => bundle?.title?.sourceBinding?.provider === "ANILIST" ? Number(bundle.title.sourceBinding.externalId) : null),
].filter((id) => Number.isSafeInteger(id) && id > 0))];

async function resolvePreviewVisual(memory, runtime) {
  if (memory.sourceKind === "SYSTEM_DESIGN") return { kind: "SYSTEM_DESIGN", designSpec: memory.asset.designSpec };
  if (memory.sourceKind === "USER_IMAGE" && memory.asset.localRef) {
    const src = await runtime.getPreview(memory.asset.localRef).catch(() => null);
    if (src) return { kind: "IMAGE", src, alt: `${memory.title.displayTitle} 메모리 카드 이미지` };
  }
  if (memory.sourceKind === "CATALOG_COVER" && memory.asset.catalogCoverRef) {
    const cover = await runtime.resolveCatalogCover(memory.asset.catalogCoverRef).catch(() => null);
    if (cover?.publicUrl) return { kind: "IMAGE", src: cover.publicUrl, alt: `${memory.title.displayTitle} 공식 표지 기반 메모리 카드` };
  }
  return { kind: "MISSING" };
}

export function createTitleCollectionService({
  memoryRuntime = null,
  readLibrary = readTitleLibrary,
  catalogRepository = isCatalogSupabaseConfigured
    ? createSupabaseCatalogRepository({ client: catalogSupabase })
    : null,
} = {}) {
  const runtimePromise = memoryRuntime ? Promise.resolve(memoryRuntime) : getPlatformMemoryRuntime();
  return Object.freeze({
    async load() {
      const runtime = await runtimePromise;
      await runtime.initialize();
      const [libraryItems, memoryBundles] = await Promise.all([
        readLibrary([]).catch(() => []),
        runtime.listArchive(),
      ]);
      const ids = aniListIdsFrom(libraryItems, memoryBundles);
      const catalogDetails = catalogRepository?.getCollectionDetailsByAniListIds
        ? await catalogRepository.getCollectionDetailsByAniListIds(ids).catch(() => [])
        : [];
      const animeIds = [...new Set([...libraryItems.map((item) => item.catalogAnimeId), ...memoryBundles.map((bundle) => bundle.title?.catalogAnimeId)].filter(Boolean))];
      if (catalogRepository?.getCollectionDetailsByAnimeIds && animeIds.length) {
        const ownDetails = await catalogRepository.getCollectionDetailsByAnimeIds(animeIds).catch(() => []);
        for (const detail of ownDetails) if (!catalogDetails.some((row) => row.animeId === detail.animeId)) catalogDetails.push(detail);
      }
      const albums = buildTitleAlbumProjections({ libraryItems, memoryBundles, catalogDetails });
      return Promise.all(albums.map(async (album) => ({
        ...album,
        previewMemories: await Promise.all(album.previewMemories.map(async (memory) => ({
          ...memory,
          visual: await resolvePreviewVisual(memory, runtime),
        }))),
      })));
    },
  });
}
