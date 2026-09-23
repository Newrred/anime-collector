import {
  isPromotionalCatalogTitle,
  selectCatalogDisplayTitle,
} from "../../../catalog/catalogTitleQuality.js";
import {
  CATALOG_COVER_COLUMNS,
  catalogCoverReferenceMatches,
  toCatalogCoverDisplay,
} from "../../../catalog/catalogCoverReference.js";

const ANIME_ID = /^anime:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const READINESS = new Set(["BLOCKED", "READY_WITH_REVIEW", "READY_WITH_GAPS", "READY"]);
const HAS_HANGUL = /[ㄱ-ㅎㅏ-ㅣ가-힣]/u;

const normalizeText = (value, maximum = 240) => {
  if (typeof value !== "string") return null;
  const normalized = value.normalize("NFKC").trim().replace(/\s+/gu, " ");
  return normalized && [...normalized].length <= maximum ? normalized : null;
};

const stringList = (value, maximumItems, maximumLength) => {
  if (!Array.isArray(value) || value.length > maximumItems) return null;
  const rows = value.map((item) => normalizeText(item, maximumLength));
  return rows.some((item) => item === null) ? null : [...new Set(rows)];
};

const searchKey = (value) => String(value || "")
  .normalize("NFKC").toLocaleLowerCase("en-US")
  .replace(/\s+/gu, "").replace(/[^\p{L}\p{N}]/gu, "");

function candidateRelevance(candidate, query) {
  const queryKey = searchKey(query);
  let score = 0;
  for (const value of [candidate.displayTitle, ...(candidate.aliases || [])]) {
    const valueKey = searchKey(value);
    if (valueKey === queryKey) score = Math.max(score, 4);
    else if (valueKey.startsWith(queryKey)) score = Math.max(score, 3);
    else if (valueKey.endsWith(queryKey)) score = Math.max(score, 2);
    else if (valueKey.includes(queryKey)) score = Math.max(score, 1);
  }
  return score;
}

function rankCandidates(candidates, query) {
  return candidates.map((candidate, index) => ({ candidate, index, score: candidateRelevance(candidate, query) }))
    .sort((left, right) => right.score - left.score
      || searchKey(left.candidate.displayTitle).length - searchKey(right.candidate.displayTitle).length
      || left.index - right.index)
    .map(({ candidate }) => candidate);
}

const aliasRows = (value) => {
  if (!Array.isArray(value) || value.length > 32) return null;
  const rows = value.map((title) => ({
    locale: normalizeText(title?.locale, 20) || "und",
    value: normalizeText(title?.value),
  }));
  return rows.some((title) => !title.value) ? null : rows;
};

function selectDisplayTitle(row, aliases, normalizedQuery) {
  const preferred = normalizeText(row?.preferred_title);
  if (preferred && !isPromotionalCatalogTitle(preferred)) return preferred;

  const safeAliases = aliases.filter((title) => !isPromotionalCatalogTitle(title.value));
  const scriptMatch = HAS_HANGUL.test(normalizedQuery)
    ? safeAliases.find((title) => HAS_HANGUL.test(title.value))
    : null;
  const localeMatch = safeAliases.find((title) => title.locale === normalizeText(row?.preferred_locale, 20));
  return scriptMatch?.value
    || localeMatch?.value
    || selectCatalogDisplayTitle(null, safeAliases.map((title) => title.value));
}

function mapRow(row, normalizedQuery) {
  const animeId = normalizeText(row?.anime_id, 80);
  const externalId = String(row?.anilist_id ?? "");
  const aliases = aliasRows(row?.search_aliases);
  const genres = stringList(row?.genres, 8, 80);
  const assetId = normalizeText(row?.cover_asset_id, 96);
  const displayTitle = aliases ? selectDisplayTitle(row, aliases, normalizedQuery) : null;
  const safeAliases = aliases?.flatMap((title) => (
    isPromotionalCatalogTitle(title.value) ? [] : [title.value]
  ));
  if (!animeId || !ANIME_ID.test(animeId)
    || !displayTitle || !safeAliases || !genres || !READINESS.has(row?.readiness) || !assetId) return null;
  return {
    kind: "ANIME_REF",
    animeId,
    displayTitle,
    aliases: [...new Set(safeAliases.filter((title) => title !== displayTitle))].slice(0, 24),
    genres,
    sourceBinding: /^[1-9]\d{0,11}$/u.test(externalId) ? { provider: "ANILIST", externalId } : null,
    verificationState: "PROVIDER_CANDIDATE",
    catalogSource: "SUPABASE_SERVICE_PROJECTION_V2",
    readiness: row.readiness,
    coverAssetId: assetId,
  };
}

async function attachCoverPreviews(client, candidates) {
  if (candidates.length === 0 || typeof client?.from !== "function") return candidates;
  try {
    const assetIds = candidates.map((candidate) => candidate.coverAssetId);
    const { data, error } = await client.from("catalog_cover_revisions")
      .select(CATALOG_COVER_COLUMNS)
      .in("catalog_cover_revision_id", assetIds);
    if (error || !Array.isArray(data) || data.length > candidates.length) return candidates;
    const rows = new Map(data.map((row) => [row?.catalog_cover_revision_id, row]));
    return candidates.map((candidate) => {
      const cover = toCatalogCoverDisplay(rows.get(candidate.coverAssetId), client, {
        animeId: candidate.animeId,
        revisionId: candidate.coverAssetId,
      });
      return cover ? {
        ...candidate,
        coverPreviewUrl: cover.publicUrl,
        catalogCoverRef: cover.catalogCoverRef,
      } : candidate;
    });
  } catch {
    return candidates;
  }
}

export function createSupabaseCatalogTitleResolver({ client, limit = 8 } = {}) {
  if (typeof client?.rpc !== "function" || !Number.isSafeInteger(limit) || limit < 1 || limit > 12) {
    throw new TypeError("Supabase catalog resolver configuration is invalid");
  }
  return Object.freeze({
    async search(query) {
      const normalized = normalizeText(query, 120);
      if (!normalized || [...normalized].length < 2) return [];
      const { data, error } = await client.rpc("search_catalog_anime", {
        search_query: normalized,
        result_limit: limit,
      });
      if (error) throw error;
      if (!Array.isArray(data) || data.length > limit) throw new Error("SUPABASE_CATALOG_RESPONSE_INVALID");
      const results = data.map((row) => mapRow(row, normalized));
      if (results.some((row) => row === null)) throw new Error("SUPABASE_CATALOG_RESPONSE_INVALID");
      return attachCoverPreviews(client, rankCandidates(results, normalized));
    },
    async resolveCover(ref) {
      const revisionId = String(ref?.catalogCoverRevisionId || "").toLowerCase();
      const animeId = String(ref?.catalogAnimeId || "").toLowerCase();
      if (!/^asset:[0-9a-f]{40}$/u.test(revisionId) || !ANIME_ID.test(animeId)) return null;
      const { data, error } = await client.from("catalog_cover_revisions")
        .select(CATALOG_COVER_COLUMNS)
        .eq("catalog_cover_revision_id", revisionId)
        .maybeSingle();
      if (error) throw error;
      const cover = toCatalogCoverDisplay(data, client, { animeId, revisionId });
      return cover && catalogCoverReferenceMatches(cover.catalogCoverRef, ref)
        ? cover
        : null;
    },
  });
}
