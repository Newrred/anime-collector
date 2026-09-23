import { catalogSupabase } from "./catalogSupabaseClient.js";
import { isPromotionalCatalogTitle, selectCatalogDisplayTitle } from "./catalogTitleQuality.js";
import { CATALOG_COVER_COLUMNS, toCatalogCoverDisplay } from "./catalogCoverReference.js";

const ANIME_ID = /^anime:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

const text = (value, maximum = 240) => {
  if (typeof value !== "string") return null;
  const normalized = value.normalize("NFKC").trim().replace(/\s+/gu, " ");
  return normalized && [...normalized].length <= maximum ? normalized : null;
};

const textList = (rows, maximumItems, maximumLength = 240) => {
  if (!Array.isArray(rows) || rows.length > maximumItems) return null;
  const values = rows.map((row) => text(row, maximumLength));
  return values.some((row) => row === null) ? null : values;
};

function safeTitles(rows) {
  if (!Array.isArray(rows) || rows.length < 1 || rows.length > 128) return null;
  const result = rows.map((row) => ({ locale: text(row?.locale, 20), value: text(row?.value) }));
  return result.some((row) => !row.locale || !row.value) ? null : result;
}

function safeSourceBinding(rows) {
  if (!Array.isArray(rows) || rows.length < 1 || rows.length > 32) return null;
  const anilist = rows.find((row) => String(row?.provider || "").toLowerCase() === "anilist");
  const externalId = String(anilist?.externalId ?? "");
  return /^[1-9]\d{0,11}$/u.test(externalId)
    ? { provider: "ANILIST", externalId }
    : null;
}

function safeDetail(payload, animeId, cover) {
  if (!payload || payload.schemaVersion !== 2 || payload.animeId !== animeId) return null;
  const titles = safeTitles(payload.titles);
  const sourceBinding = safeSourceBinding(payload.externalIds);
  const studios = Array.isArray(payload.studios) && payload.studios.length <= 32
    ? payload.studios.flatMap((row) => {
      const name = text(row?.name);
      return name ? [{ name, role: text(row?.role, 80) || "OTHER" }] : [];
    }) : null;
  const coreGenres = textList(payload.genres?.core, 16, 80);
  const sourceGenres = textList(payload.genres?.source, 32, 80);
  const officialLinks = Array.isArray(payload.officialLinks) && payload.officialLinks.length <= 16
    ? payload.officialLinks.flatMap((row) => {
      const url = text(row?.url, 2048);
      if (!url) return [];
      try { if (new URL(url).protocol !== "https:") return []; } catch { return []; }
      return [{ url, role: text(row?.role, 80) || "SECONDARY_OFFICIAL" }];
    }) : null;
  if (!titles || !studios || !coreGenres || !sourceGenres || !officialLinks) return null;
  const safeDisplayTitles = titles.filter((row) => !isPromotionalCatalogTitle(row.value));
  const displayTitle = selectCatalogDisplayTitle(payload.preferredTitle?.value, safeDisplayTitles.map((row) => row.value));
  if (!displayTitle) return null;
  const displayTitleRow = safeDisplayTitles.find((row) => row.value === displayTitle);
  return {
    animeId,
    sourceBinding,
    preferredTitle: {
      locale: displayTitleRow?.locale || "und",
      value: displayTitle,
    },
    titles: safeDisplayTitles,
    release: {
      format: text(payload.release?.format, 40), status: text(payload.release?.status, 40),
      season: text(payload.release?.season, 20), startDate: text(payload.release?.startDate, 40),
      endDate: text(payload.release?.endDate, 40),
      episodeCount: Number.isSafeInteger(payload.release?.episodeCount) ? payload.release.episodeCount : null,
      sourceMaterialType: text(payload.release?.sourceMaterialType, 60),
    },
    studios,
    genres: { core: coreGenres, source: sourceGenres },
    officialLinks,
    relations: Array.isArray(payload.relations) ? payload.relations.slice(0, 128).flatMap((row) => {
      const title = text(row?.title);
      const type = text(row?.type, 80);
      return title && type ? [{ title, type, format: text(row?.format, 40) }] : [];
    }) : [],
    people: {
      characterCount: Number(payload.people?.characterCount) || 0,
      castingCount: Number(payload.people?.castingCount) || 0,
      pageCount: Number(payload.people?.pageCount) || 0,
      pageSize: Number(payload.people?.pageSize) || 30,
    },
    readiness: text(payload.readiness?.status, 40) || "BLOCKED",
    cover,
  };
}

function safePeople(payload, animeId, requestedPage) {
  if (!payload || payload.schemaVersion !== 2 || payload.animeId !== animeId
    || payload.page !== requestedPage || !Array.isArray(payload.entries) || payload.entries.length > 50) return null;
  const entries = payload.entries.flatMap((row) => {
    const name = text(row?.canonicalName);
    if (!name || !Array.isArray(row.castings) || row.castings.length > 32) return [];
    return [{
      characterId: text(row.characterId, 160),
      name,
      role: text(row.role, 40) || "UNKNOWN",
      castings: row.castings.flatMap((casting) => {
        const creditedName = text(casting?.creditedName);
        return creditedName ? [{
          creditedName,
          language: text(casting?.language, 40) || "UNKNOWN",
          roleType: text(casting?.roleType, 40) || "VOICE",
        }] : [];
      }),
    }];
  });
  return { page: requestedPage, totalCount: Number(payload.totalCount) || 0, entries };
}

function safeCollectionDetail(row, cover) {
  const animeId = text(row?.anime_id, 80);
  const externalId = String(row?.anilist_id ?? "");
  const preferredTitle = text(row?.preferred_title);
  const aliases = Array.isArray(row?.search_aliases)
    ? row.search_aliases.slice(0, 64).flatMap((entry) => {
      const value = text(entry?.value);
      return value && !isPromotionalCatalogTitle(value)
        ? [{ locale: text(entry?.locale, 20) || "und", value }]
        : [];
    })
    : [];
  const studios = Array.isArray(row?.studios)
    ? row.studios.slice(0, 32).flatMap((entry) => {
      const name = text(typeof entry === "string" ? entry : entry?.name);
      return name ? [{ name, role: text(entry?.role, 80) || "ANIMATION_PRODUCTION" }] : [];
    })
    : [];
  const genres = textList(row?.genres, 32, 80);
  if (!animeId || !ANIME_ID.test(animeId)
    || !preferredTitle || !genres) return null;
  const titles = [{ locale: text(row?.preferred_locale, 20) || "und", value: preferredTitle }];
  for (const alias of aliases) {
    if (!titles.some((title) => title.value === alias.value)) titles.push(alias);
  }
  return {
    animeId,
    sourceBinding: /^[1-9]\d{0,11}$/u.test(externalId) ? { provider: "ANILIST", externalId } : null,
    preferredTitle: { locale: titles[0].locale, value: selectCatalogDisplayTitle(preferredTitle, titles.map((title) => title.value)) || preferredTitle },
    titles,
    release: {
      format: text(row?.format, 40),
      status: text(row?.status, 40),
      season: text(row?.season, 20),
      startDate: Number.isSafeInteger(row?.release_year) ? String(row.release_year) : null,
      endDate: null,
      episodeCount: Number.isSafeInteger(row?.episode_count) ? row.episode_count : null,
      sourceMaterialType: text(row?.source_material_type, 60),
    },
    studios,
    genres: { core: genres.slice(0, 16), source: genres },
    officialLinks: [], relations: [],
    people: { characterCount: 0, castingCount: 0, pageCount: 0, pageSize: 30 },
    readiness: text(row?.readiness, 40) || "BLOCKED",
    cover: cover || null,
  };
}

const chunksOf = (rows, size = 100) => {
  const chunks = [];
  for (let index = 0; index < rows.length; index += size) chunks.push(rows.slice(index, index + size));
  return chunks;
};

export function createSupabaseCatalogRepository({ client = catalogSupabase } = {}) {
  if (typeof client?.from !== "function") throw new TypeError("Supabase catalog client is required");
  return Object.freeze({
    async getCollectionDetailsByAnimeIds(values) {
      return this.getCollectionDetailsByAniListIds(values, "anime_id");
    },
    async getCollectionDetailsByAniListIds(values, column = "anilist_id") {
      const ids = [...new Set((Array.isArray(values) ? values : []).flatMap((value) => {
        if (column === "anime_id") return ANIME_ID.test(String(value)) ? [String(value).toLowerCase()] : [];
        const id = Number(value);
        return Number.isSafeInteger(id) && id > 0 ? [id] : [];
      }))].slice(0, 2000);
      if (!ids.length) return [];
      const searchRows = [];
      const searchResponses = await Promise.all(chunksOf(ids).map((chunk) => (
        client.from("catalog_anime_search")
          .select("anime_id,anilist_id,preferred_title,preferred_locale,search_aliases,format,status,episode_count,source_material_type,release_year,season,studios,genres,readiness,cover_asset_id")
          .in(column, chunk).then((response) => ({ ...response, expectedMaximum: chunk.length }))
      )));
      for (const { data, error, expectedMaximum } of searchResponses) {
        if (error) throw error;
        if (!Array.isArray(data) || data.length > expectedMaximum) throw new Error("CATALOG_COLLECTION_RESPONSE_INVALID");
        searchRows.push(...data);
      }
      const revisionIds = [...new Set(searchRows.flatMap((row) => {
        const revisionId = text(row?.cover_asset_id, 96);
        return revisionId ? [revisionId] : [];
      }))];
      const coverRows = [];
      const coverResponses = await Promise.all(chunksOf(revisionIds).map((chunk) => (
        client.from("catalog_cover_revisions").select(CATALOG_COVER_COLUMNS)
          .in("catalog_cover_revision_id", chunk).then((response) => ({ ...response, expectedMaximum: chunk.length }))
      )));
      for (const { data, error, expectedMaximum } of coverResponses) {
        if (error) throw error;
        if (!Array.isArray(data) || data.length > expectedMaximum) throw new Error("CATALOG_COLLECTION_RESPONSE_INVALID");
        coverRows.push(...data);
      }
      const coverByRevision = new Map(coverRows.map((row) => [row?.catalog_cover_revision_id, row]));
      return searchRows.flatMap((row) => {
        const revisionId = text(row?.cover_asset_id, 96);
        const cover = revisionId ? toCatalogCoverDisplay(coverByRevision.get(revisionId), client, {
          animeId: row?.anime_id,
          revisionId,
        }) : null;
        const detail = safeCollectionDetail(row, cover);
        return detail ? [detail] : [];
      });
    },
    async getDetail(animeId) {
      if (!ANIME_ID.test(String(animeId || ""))) throw new Error("CATALOG_ANIME_ID_INVALID");
      const { data, error } = await client.from("catalog_anime_details")
        .select("anime_id,payload").eq("anime_id", animeId).maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const coverAssetId = text(data.payload?.coverAssetId, 96);
      if (!coverAssetId) throw new Error("CATALOG_DETAIL_RESPONSE_INVALID");
      const { data: coverRow, error: coverError } = await client.from("catalog_cover_revisions")
        .select(CATALOG_COVER_COLUMNS)
        .eq("catalog_cover_revision_id", coverAssetId).maybeSingle();
      if (coverError) throw coverError;
      const cover = toCatalogCoverDisplay(coverRow, client, { animeId, revisionId: coverAssetId });
      const result = cover ? safeDetail(data.payload, animeId, cover) : null;
      if (!result) throw new Error("CATALOG_DETAIL_RESPONSE_INVALID");
      return result;
    },
    async getPeople(animeId, page = 1) {
      if (!ANIME_ID.test(String(animeId || "")) || !Number.isSafeInteger(page) || page < 1) {
        throw new Error("CATALOG_PEOPLE_REQUEST_INVALID");
      }
      const { data, error } = await client.from("catalog_anime_people")
        .select("anime_id,page,payload").eq("anime_id", animeId).eq("page", page).maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const result = safePeople(data.payload, animeId, page);
      if (!result) throw new Error("CATALOG_PEOPLE_RESPONSE_INVALID");
      return result;
    },
  });
}
