import { readTitleLibrary, writeTitleLibrary } from "../../../repositories/titleLibraryRepo.js";
import { listWatchLogsByAnimeId, readAllWatchLogsPreferred, replaceWatchLogs, updateWatchLog, appendWatchLog, createWatchLog, buildWatchedRange } from "../../../repositories/watchLogRepo.js";
import { watchLogMatchesTitle } from "../../../domain/watchLogIdentity.js";
import { normalizeWatchStatus, titleWatchIdentity, validateHistoricalWatchLogEdit } from "../domain/titleWatchRecord.js";
import { createTitleWatchRecordWriter } from "./titleWatchRecordWriter.js";
import { createSupabaseCatalogRepository } from "../../catalog/catalogRepository.js";
import { catalogSupabase, isCatalogSupabaseConfigured } from "../../catalog/catalogSupabaseClient.js";
import { getPlatformMemoryRuntime } from "../../memory/runtime/platformMemoryRuntime.js";
import { getPlatformTitleResolver } from "../../memory/runtime/platformTitleResolver.js";
import { buildTitleAlbumProjections } from "./titleAlbumProjection.js";
import { withTitleStateMutation } from "./titleStateMutationLock.js";

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
  appendLog = appendWatchLog,
  createLog = createWatchLog,
  catalogRepository = isCatalogSupabaseConfigured
    ? createSupabaseCatalogRepository({ client: catalogSupabase })
    : null,
  titleResolver = getPlatformTitleResolver(),
  now = () => Date.now(),
  dispatchLibraryUpdated = () => globalThis.dispatchEvent?.(new Event("moemoa:library-updated")),
} = {}) {
  let runtimePromise = memoryRuntime ? Promise.resolve(memoryRuntime) : getPlatformMemoryRuntime();
  const saveWatchRecord = createTitleWatchRecordWriter({ readLibrary, writeLibrary, readWatchLogs, appendLog, createLog, dispatchLibraryUpdated });
  return Object.freeze({
    saveWatchRecord,
    editWatchLog(album, original, input) { return withTitleStateMutation(async () => {
      const identity = titleWatchIdentity(album);
      const rows = await readAllWatchLogsPreferred();
      const current = rows.find(row => row.id === original?.id);
      if (!current || !watchLogMatchesTitle(current, identity)) throw new Error("WATCH_LOG_NOT_FOUND");
      if (JSON.stringify(current) !== JSON.stringify(original)) throw new Error("WATCH_LOG_CHANGED");
      const patch = validateHistoricalWatchLogEdit(input, current);
      if (!Object.keys(patch).length) return current;
      if (Object.hasOwn(patch, "watchedAtPrecision")) {
        const range = buildWatchedRange(patch.watchedAtValue, patch.watchedAtPrecision, current.createdAt);
        Object.assign(patch, range);
      }
      const updated = await updateWatchLog(current.id, patch);
      if (!updated) throw new Error("WATCH_LOG_NOT_FOUND");
      dispatchLibraryUpdated();
      return updated;
    }); },
    deleteWatchLog(album, original) { return withTitleStateMutation(async () => {
      const identity = titleWatchIdentity(album);
      const rows = await readAllWatchLogsPreferred();
      const current = rows.find(row => row.id === original?.id);
      if (!current || !watchLogMatchesTitle(current, identity)) throw new Error("WATCH_LOG_NOT_FOUND");
      if (JSON.stringify(current) !== JSON.stringify(original)) throw new Error("WATCH_LOG_CHANGED");
      await replaceWatchLogs(rows.filter(row => row.id !== current.id));
      dispatchLibraryUpdated();
      return current.id;
    }); },
    updateTitleDetails(album, input) { return withTitleStateMutation(async () => {
      const identity = titleWatchIdentity(album);
      if (!album.tracking.isSaved || !album.libraryItem) throw new Error("TITLE_NOT_SAVEABLE");
      const status = String(input.status || "");
      const score = input.score == null || input.score === "" ? null : Number(input.score);
      const rewatchCount = Number(input.rewatchCount);
      const lastRewatchAt = String(input.lastRewatchAt || "").trim() || null;
      const memo = String(input.memo || "");
      if (!["미분류", "보는중", "완료", "보류", "하차", "볼예정"].includes(status)) throw new Error("INVALID_STATUS");
      if (score != null && (!Number.isFinite(score) || score < 0 || score > 5 || score * 2 % 1)) throw new Error("INVALID_SCORE");
      if (!Number.isInteger(rewatchCount) || rewatchCount < 0 || rewatchCount > 999) throw new Error("INVALID_REWATCH_COUNT");
      if (lastRewatchAt && (Number.isNaN(Date.parse(`${lastRewatchAt}T00:00:00Z`))
        || new Date(`${lastRewatchAt}T00:00:00Z`).toISOString().slice(0, 10) !== lastRewatchAt)) throw new Error("INVALID_WATCH_DATE");
      if (memo.length > 10000) throw new Error("NOTE_TOO_LONG");
      const desired = { status, score, rewatchCount, lastRewatchAt, memo };
      const baseline = album.libraryItem;
      const current = await readLibrary([]);
      let found = false;
      const next = current.map(item => {
        if (!watchLogMatchesTitle(item, identity)) return item;
        found = true;
        const update = { ...item };
        for (const [key, value] of Object.entries(desired)) {
          const initial = key === "status" ? normalizeWatchStatus(baseline[key])
            : key === "score" || key === "lastRewatchAt" ? baseline[key] ?? null
            : key === "memo" ? baseline[key] || "" : key === "rewatchCount" ? Number(baseline[key]) || 0 : baseline[key] || "미분류";
          const latest = key === "status" ? normalizeWatchStatus(item[key])
            : key === "score" || key === "lastRewatchAt" ? item[key] ?? null
            : key === "memo" ? item[key] || "" : key === "rewatchCount" ? Number(item[key]) || 0 : item[key] || "미분류";
          if (value === initial) continue;
          if (latest !== initial) throw new Error("TITLE_TRACKING_CONFLICT");
          update[key] = value;
        }
        return update;
      });
      if (!found) throw new Error("TITLE_NOT_SAVEABLE");
      await writeLibrary(next);
      dispatchLibraryUpdated();
      return next.find(item => watchLogMatchesTitle(item, identity));
    }); },
    saveRelatedTitle({ anilistId, title, format }) { return withTitleStateMutation(async () => {
      const id = Number(anilistId);
      const allowedFormats = new Set(["TV", "TV_SHORT", "MOVIE", "SPECIAL", "OVA", "ONA", "MUSIC"]);
      if (!Number.isSafeInteger(id) || id < 1 || !allowedFormats.has(String(format || "").toUpperCase())) {
        throw new Error("RELATED_TITLE_UNAVAILABLE");
      }
      const current = await readLibrary([]);
      if (current.some(item => Number(item?.anilistId) === id)) return false;
      await writeLibrary([...current, { anilistId: id, koTitle: String(title || "").trim().slice(0, 120),
        status: "미분류", score: null, memo: "", rewatchCount: 0, lastRewatchAt: null, addedAt: now() }]);
      dispatchLibraryUpdated();
      return true;
    }); },
    async load(request) {
      if (!request) return null;
      const runtime = await runtimePromise;
      await runtime.initialize();
      const [libraryItems, archive] = await Promise.all([
        readLibrary([]),
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
      let album = albums.find((candidate) => request.kind === "ANIME"
        ? candidate.titleRef?.kind === "ANIME" && candidate.titleRef.animeId === request.animeId
        : candidate.key === key);
      if (!album && request.kind === "LEGACY_ANILIST" && request.title) {
        // A provider candidate is a personal title entry, never verified catalog data.
        const [candidate] = buildTitleAlbumProjections({ libraryItems: [{ anilistId: request.anilistId, koTitle: request.title }] });
        album = { ...candidate, libraryItem: null, tracking: { ...candidate.tracking, isSaved: false }, presence: "NOT_SAVED_NO_MEMORY" };
      }
      if (!album) {
        if (catalogError) throw catalogError;
        return null;
      }
      const memories = await Promise.all(album.memories.map(async (memory) => ({
        ...memory,
        visual: await resolveMemoryVisual(memory, runtime),
      })));
      const watchLogs = !album.isPrivateTitle
        ? await readWatchLogs(album.anilistId, { catalogAnimeId: album.titleRef.kind === "ANIME" ? album.titleRef.animeId : null })
        : [];
      return { ...album, memories, watchLogs };
    },

    updateTracking(album, { watchStatus, rating }) { return withTitleStateMutation(async () => {
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
    }); },

    setSaved(album, shouldSave) { return withTitleStateMutation(async () => {
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
    }); },
  });
}
