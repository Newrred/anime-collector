const ANIME_ID = /^anime:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const COVER_ID = /^cover:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const REVISION_ID = /^asset:[0-9a-f]{40}$/iu;
const COVER_PATH = /^covers\/anime-[a-f0-9-]+\/[a-f0-9]{64}\.(jpg|png|webp)$/iu;

const httpsUrl = (value) => {
  try {
    const url = new URL(String(value || ""));
    return url.protocol === "https:" && url.href.length <= 2048 ? url.href : null;
  } catch {
    return null;
  }
};

export const CATALOG_COVER_COLUMNS = [
  "catalog_cover_revision_id", "catalog_cover_id", "catalog_anime_id", "availability",
  "rights_basis", "permission_verified_at", "bucket_id", "object_path", "width", "height",
].join(",");

export function toCatalogCoverDisplay(row, client, expected = {}) {
  const animeId = String(row?.catalog_anime_id || "").toLowerCase();
  const coverId = String(row?.catalog_cover_id || "").toLowerCase();
  const revisionId = String(row?.catalog_cover_revision_id || "").toLowerCase();
  const permissionVerifiedAt = String(row?.permission_verified_at || "");
  if (!ANIME_ID.test(animeId) || !COVER_ID.test(coverId) || !REVISION_ID.test(revisionId)
    || animeId.slice(6) !== coverId.slice(6)
    || (expected.animeId && animeId !== String(expected.animeId).toLowerCase())
    || (expected.revisionId && revisionId !== String(expected.revisionId).toLowerCase())
    || row?.availability !== "READY" || row?.rights_basis !== "EXPLICIT_PERMISSION"
    || row?.bucket_id !== "catalog-covers-preview" || !COVER_PATH.test(String(row?.object_path || ""))
    || !Number.isSafeInteger(row?.width) || row.width < 1
    || !Number.isSafeInteger(row?.height) || row.height < 1
    || !Number.isFinite(Date.parse(permissionVerifiedAt))
    || typeof client?.storage?.from !== "function") return null;
  const publicUrl = httpsUrl(
    client.storage.from(row.bucket_id).getPublicUrl(row.object_path)?.data?.publicUrl,
  );
  if (!publicUrl) return null;
  return Object.freeze({
    publicUrl,
    width: row.width,
    height: row.height,
    catalogCoverRef: Object.freeze({
      sourceKind: "CATALOG_COVER",
      catalogAnimeId: animeId,
      catalogCoverId: coverId,
      catalogCoverRevisionId: revisionId,
      rightsBasis: "EXPLICIT_PERMISSION",
      permissionVerifiedAt,
    }),
  });
}

export function catalogCoverReferenceMatches(left, right) {
  return left?.sourceKind === "CATALOG_COVER"
    && right?.sourceKind === "CATALOG_COVER"
    && left.catalogAnimeId === String(right.catalogAnimeId || "").toLowerCase()
    && left.catalogCoverId === String(right.catalogCoverId || "").toLowerCase()
    && left.catalogCoverRevisionId === String(right.catalogCoverRevisionId || "").toLowerCase()
    && left.rightsBasis === "EXPLICIT_PERMISSION"
    && right.rightsBasis === "EXPLICIT_PERMISSION"
    && Number.isFinite(Date.parse(String(right.permissionVerifiedAt || "")))
    && Date.parse(left.permissionVerifiedAt) === Date.parse(right.permissionVerifiedAt);
}
