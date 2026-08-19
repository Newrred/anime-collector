import { supabase } from "../../lib/supabaseClient.js";

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

function safeDetail(payload, animeId, cover) {
  if (!payload || payload.schemaVersion !== 2 || payload.animeId !== animeId) return null;
  const titles = safeTitles(payload.titles);
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
  return {
    animeId,
    preferredTitle: {
      locale: text(payload.preferredTitle?.locale, 20) || "und",
      value: text(payload.preferredTitle?.value) || titles[0].value,
    },
    titles,
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

function safeCover(row, animeId, client) {
  if (!row || row.anime_id !== animeId || row.kind !== "COVER_IMAGE"
    || row.availability !== "PREVIEW_STORAGE" || row.rights_basis !== "USER_CONFIRMED_PREVIEW_PERMISSION"
    || row.bucket_id !== "catalog-covers-preview" || !/^covers\/anime-[a-f0-9-]+\/[a-f0-9]{64}\.(jpg|png|webp)$/iu.test(row.object_path || "")
    || !Number.isSafeInteger(row.width) || !Number.isSafeInteger(row.height)
    || typeof client?.storage?.from !== "function") return null;
  const result = client.storage.from(row.bucket_id).getPublicUrl(row.object_path);
  const publicUrl = text(result?.data?.publicUrl, 2048);
  try { if (!publicUrl || new URL(publicUrl).protocol !== "https:") return null; } catch { return null; }
  return { publicUrl, width: row.width, height: row.height };
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

export function createSupabaseCatalogRepository({ client = supabase } = {}) {
  if (typeof client?.from !== "function") throw new TypeError("Supabase catalog client is required");
  return Object.freeze({
    async getDetail(animeId) {
      if (!ANIME_ID.test(String(animeId || ""))) throw new Error("CATALOG_ANIME_ID_INVALID");
      const { data, error } = await client.from("catalog_anime_details")
        .select("anime_id,payload").eq("anime_id", animeId).maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const coverAssetId = text(data.payload?.coverAssetId, 96);
      if (!coverAssetId) throw new Error("CATALOG_DETAIL_RESPONSE_INVALID");
      const { data: coverRow, error: coverError } = await client.from("catalog_assets")
        .select("asset_id,anime_id,kind,availability,rights_basis,bucket_id,object_path,width,height")
        .eq("asset_id", coverAssetId).maybeSingle();
      if (coverError) throw coverError;
      const cover = safeCover(coverRow, animeId, client);
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
