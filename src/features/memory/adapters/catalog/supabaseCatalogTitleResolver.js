const ANIME_ID = /^anime:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const READINESS = new Set(["BLOCKED", "READY_WITH_REVIEW", "READY_WITH_GAPS", "READY"]);

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

function mapRow(row) {
  const animeId = normalizeText(row?.anime_id, 80);
  const externalId = String(row?.anilist_id ?? "");
  const displayTitle = normalizeText(row?.preferred_title);
  const aliases = Array.isArray(row?.search_aliases) && row.search_aliases.length <= 32
    ? row.search_aliases.flatMap((title) => {
      const value = normalizeText(title?.value);
      return value ? [value] : [];
    }) : null;
  const genres = stringList(row?.genres, 8, 80);
  const assetId = normalizeText(row?.cover_asset_id, 96);
  if (!animeId || !ANIME_ID.test(animeId) || !/^[1-9]\d{0,11}$/u.test(externalId)
    || !displayTitle || !aliases || !genres || !READINESS.has(row?.readiness) || !assetId) return null;
  return {
    kind: "ANIME_REF",
    animeId,
    displayTitle,
    aliases: [...new Set(aliases.filter((title) => title !== displayTitle))].slice(0, 24),
    genres,
    sourceBinding: { provider: "ANILIST", externalId },
    verificationState: "PROVIDER_CANDIDATE",
    catalogSource: "SUPABASE_SERVICE_PROJECTION_V2",
    readiness: row.readiness,
    coverAssetId: assetId,
  };
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
      const results = data.map(mapRow);
      if (results.some((row) => row === null)) throw new Error("SUPABASE_CATALOG_RESPONSE_INVALID");
      return results;
    },
  });
}
