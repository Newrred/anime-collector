import { createSupabaseCatalogTitleResolver } from "../memory/adapters/catalog/supabaseCatalogTitleResolver.js";
import { createSupabaseCatalogRepository } from "./catalogRepository.js";
import { catalogSupabase, isCatalogSupabaseConfigured } from "./catalogSupabaseClient.js";

const ANIME_ID = /^anime:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

const dateParts = (value) => {
  const match = /^(\d{4})(?:-(\d{2})-(\d{2}))?$/u.exec(String(value || ""));
  if (!match) return { year: null, month: null, day: null };
  return { year: Number(match[1]), month: match[2] ? Number(match[2]) : null, day: match[3] ? Number(match[3]) : null };
};

const titleFor = (detail, locales, fallback = null) => (
  detail.titles.find((row) => locales.includes(row.locale))?.value || fallback
);

export function detailToTitleChoice(detail) {
  if (!detail || !ANIME_ID.test(String(detail.animeId || ""))
    || detail.sourceBinding?.provider !== "ANILIST"
    || !/^[1-9]\d{0,11}$/u.test(String(detail.sourceBinding?.externalId || ""))) {
    throw new Error("CATALOG_DETAIL_TITLE_CHOICE_INVALID");
  }
  const displayTitle = String(detail.preferredTitle?.value || "").trim();
  if (!displayTitle) throw new Error("CATALOG_DETAIL_TITLE_CHOICE_INVALID");
  return {
    kind: "ANIME_REF",
    animeId: detail.animeId,
    displayTitle,
    aliases: [...new Set(detail.titles.map((row) => String(row?.value || "").trim())
      .filter((value) => value && value !== displayTitle))].slice(0, 24),
    genres: (detail.genres.core.length ? detail.genres.core : detail.genres.source).slice(0, 16),
    sourceBinding: { ...detail.sourceBinding },
    verificationState: "PROVIDER_CANDIDATE",
    catalogSource: "SUPABASE_SERVICE_PROJECTION_V2",
    readiness: detail.readiness,
  };
}

function libraryRow(candidate, detail) {
  if (!detail || detail.animeId !== candidate.animeId
    || detail.sourceBinding.externalId !== candidate.sourceBinding.externalId) return null;
  const startDate = dateParts(detail.release.startDate);
  const english = titleFor(detail, ["en"], candidate.aliases[0] || candidate.displayTitle);
  const native = titleFor(detail, ["ja", "native"], null);
  const romaji = titleFor(detail, ["romaji"], english);
  return {
    id: Number(candidate.sourceBinding.externalId),
    ko: titleFor(detail, ["ko"], null),
    src: "moemoa-catalog",
    sourceRank: -1,
    score: 1000,
    media: {
      id: Number(candidate.sourceBinding.externalId),
      title: { english, romaji, native },
      synonyms: candidate.aliases,
      coverImage: { large: detail.cover.publicUrl, extraLarge: detail.cover.publicUrl },
      format: detail.release.format,
      status: detail.release.status,
      episodes: detail.release.episodeCount,
      source: detail.release.sourceMaterialType,
      seasonYear: startDate.year,
      startDate,
      genres: detail.genres.core.length ? detail.genres.core : detail.genres.source,
      studios: { nodes: detail.studios.map((studio) => ({ name: studio.name, isAnimationStudio: true })) },
    },
  };
}

export function createCatalogLibrarySearch({ titleResolver, repository } = {}) {
  if (typeof titleResolver?.search !== "function" || typeof repository?.getDetail !== "function") {
    throw new TypeError("Catalog Library search dependencies are required");
  }
  return async (query) => {
    const candidates = await titleResolver.search(query);
    const catalogCandidates = candidates.filter((candidate) => (
      candidate?.catalogSource === "SUPABASE_SERVICE_PROJECTION_V2" && ANIME_ID.test(candidate.animeId)
    )).slice(0, 8);
    const details = await Promise.all(catalogCandidates.map((candidate) => (
      repository.getDetail(candidate.animeId).catch(() => null)
    )));
    return {
      status: "READY",
      results: catalogCandidates.flatMap((candidate, index) => {
        const row = libraryRow(candidate, details[index]);
        return row ? [row] : [];
      }),
    };
  };
}

const defaultSearch = isCatalogSupabaseConfigured
  ? createCatalogLibrarySearch({
      titleResolver: createSupabaseCatalogTitleResolver({ client: catalogSupabase, limit: 8 }),
      repository: createSupabaseCatalogRepository({ client: catalogSupabase }),
    })
  : null;

export async function searchLibraryCatalog(query) {
  if (!defaultSearch) return { status: "UNAVAILABLE", results: [] };
  return defaultSearch(query);
}

export async function loadCatalogTitleChoice(animeId) {
  if (!defaultSearch || !ANIME_ID.test(String(animeId || ""))) return null;
  const detail = await createSupabaseCatalogRepository({ client: catalogSupabase }).getDetail(animeId);
  return detail ? detailToTitleChoice(detail) : null;
}
