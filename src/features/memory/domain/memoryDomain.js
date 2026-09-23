const OWNER_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CATALOG_ANIME_ID = /^anime:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CATALOG_COVER_ID = /^cover:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CATALOG_COVER_REVISION_ID = /^asset:[0-9a-f]{40}$/i;
const ANIME_VERIFICATION_STATES = new Set(["LEGACY_UNVERIFIED", "PROVIDER_CANDIDATE", "SOURCE_REVIEWED"]);

export class MemoryDomainError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "MemoryDomainError";
    this.code = code;
  }
}

const fail = (code, message) => {
  throw new MemoryDomainError(code, message);
};

export const requireOwnerId = (ownerId) => {
  const value = String(ownerId || "");
  if (value.startsWith("guest:") && OWNER_UUID.test(value.slice(6))) return value;
  if (value.startsWith("account:") && OWNER_UUID.test(value.slice(8))) return value;
  return fail("INVALID_OWNER_ID", "A valid Memory owner id is required");
};

const requireId = (value, field) => {
  const id = String(value || "").trim();
  if (!id) fail("INVALID_ID", `${field} is required`);
  return id;
};

export const normalizeDisplayTitle = (value) => {
  const title = String(value || "").normalize("NFKC").trim().replace(/\s+/gu, " ");
  if (!title) fail("TITLE_REQUIRED", "A title is required");
  if (title.length > 120) fail("TITLE_TOO_LONG", "Title must be 120 characters or fewer");
  return title;
};

const normalizeUniqueText = (values, { maxItems, maxLength }) => {
  const seen = new Set();
  return Object.freeze((Array.isArray(values) ? values : []).flatMap((value) => {
    const normalized = String(value || "").normalize("NFKC").trim().replace(/\s+/gu, " ");
    const key = normalized.toLocaleLowerCase("en-US");
    if (!normalized || normalized.length > maxLength || seen.has(key) || seen.size >= maxItems) return [];
    seen.add(key);
    return [normalized];
  }));
};

export function createGuestOwner({ uuid, now }) {
  if (!OWNER_UUID.test(String(uuid || ""))) {
    fail("INVALID_OWNER_ID", "A version 4 UUID is required for a guest owner");
  }
  return Object.freeze({
    id: requireOwnerId(`guest:${String(uuid).toLowerCase()}`),
    kind: "GUEST",
    createdAt: String(now),
  });
}

export function createAccountOwner({ userId, now }) {
  const id = requireOwnerId(`account:${String(userId || "").toLowerCase()}`);
  return Object.freeze({
    id,
    kind: "ACCOUNT",
    userId: id.slice(8),
    createdAt: String(now),
  });
}

export const createDefaultSyncEnvelope = (now) => Object.freeze({
  remoteVersion: 0,
  syncState: "LOCAL_ONLY",
  clientUpdatedAt: String(now),
  serverUpdatedAt: null,
  lastOperationId: null,
});

export function normalizeCatalogCoverRef(value) {
  const ref = value && typeof value === "object" ? value : {};
  const catalogAnimeId = String(ref.catalogAnimeId || "").toLowerCase();
  const catalogCoverId = String(ref.catalogCoverId || "").toLowerCase();
  const catalogCoverRevisionId = String(ref.catalogCoverRevisionId || "").toLowerCase();
  const permissionVerifiedAt = String(ref.permissionVerifiedAt || "");
  if (!CATALOG_ANIME_ID.test(catalogAnimeId)
    || !CATALOG_COVER_ID.test(catalogCoverId)
    || catalogCoverId.slice(6) !== catalogAnimeId.slice(6)
    || !CATALOG_COVER_REVISION_ID.test(catalogCoverRevisionId)
    || ref.sourceKind !== "CATALOG_COVER"
    || ref.rightsBasis !== "EXPLICIT_PERMISSION"
    || !Number.isFinite(Date.parse(permissionVerifiedAt))) {
    fail("INVALID_CATALOG_COVER_REFERENCE", "A durable approved catalog cover reference is required");
  }
  return Object.freeze({
    sourceKind: "CATALOG_COVER",
    catalogAnimeId,
    catalogCoverId,
    catalogCoverRevisionId,
    rightsBasis: "EXPLICIT_PERMISSION",
    permissionVerifiedAt,
  });
}

export function createPrivateTitle({ id, ownerId, displayTitle, optionalGenres = [], now }) {
  const title = normalizeDisplayTitle(displayTitle);
  return Object.freeze({
    id: requireId(id, "PrivateTitle id"),
    ownerId: requireOwnerId(ownerId),
    displayTitle: title,
    normalizedTitle: title.toLocaleLowerCase("en-US"),
    optionalGenres: Object.freeze(optionalGenres.flatMap((genre) => {
      const normalizedGenre = String(genre).trim();
      return normalizedGenre ? [normalizedGenre] : [];
    })),
    createdAt: String(now),
    updatedAt: String(now),
    deletedAt: null,
    sync: createDefaultSyncEnvelope(now),
  });
}

export function createAnimeRef({
  id,
  catalogAnimeId = null,
  displayTitle,
  aliases = [],
  genres = [],
  sourceBinding,
  verificationState,
  now,
}) {
  const provider = String(sourceBinding?.provider || "").trim().toUpperCase();
  const externalId = String(sourceBinding?.externalId ?? "").trim();
  const normalizedCatalogAnimeId = catalogAnimeId == null || catalogAnimeId === ""
    ? null
    : String(catalogAnimeId).toLowerCase();
  if (normalizedCatalogAnimeId && !CATALOG_ANIME_ID.test(normalizedCatalogAnimeId)) {
    fail("INVALID_CATALOG_ANIME_ID", "A valid catalog Anime id is required");
  }
  if (!ANIME_VERIFICATION_STATES.has(verificationState)) {
    fail("INVALID_VERIFICATION_STATE", "Anime reference provenance must remain explicit");
  }
  const validBinding = /^[1-9]\d{0,11}$/.test(externalId)
    && ((provider === "ANILIST" && ["LEGACY_UNVERIFIED", "PROVIDER_CANDIDATE"].includes(verificationState))
      || (provider === "ANILIFE" && verificationState === "SOURCE_REVIEWED" && normalizedCatalogAnimeId));
  const catalogOnly = normalizedCatalogAnimeId && sourceBinding == null && verificationState === "PROVIDER_CANDIDATE";
  if (!validBinding && !catalogOnly) {
    fail("INVALID_ANIME_SOURCE", "A supported numeric anime source binding is required");
  }

  const title = normalizeDisplayTitle(displayTitle);
  return Object.freeze({
    id: requireId(id, "AnimeRef id"),
    catalogAnimeId: normalizedCatalogAnimeId,
    displayTitle: title,
    normalizedTitle: title.toLocaleLowerCase("en-US"),
    aliases: normalizeUniqueText(aliases, { maxItems: 24, maxLength: 120 }),
    genres: normalizeUniqueText(genres, { maxItems: 16, maxLength: 48 }),
    sourceKey: catalogOnly ? normalizedCatalogAnimeId : `${provider}:${externalId}`,
    sourceBinding: catalogOnly ? null : Object.freeze({ provider, externalId }),
    verificationState,
    createdAt: String(now),
    updatedAt: String(now),
  });
}

export function assertCatalogCoverPersonalSignal(card, asset) {
  if (asset?.imageType !== "CATALOG_COVER") return;
  const textSignal = [card.note, card.watchedAt, card.episode, card.sceneCue, card.rewatchIntent]
    .some((value) => value != null && String(value).trim() !== "");
  if (!textSignal && !(Array.isArray(card.emotionTags) && card.emotionTags.some((tag) => String(tag || "").trim()))) {
    fail("CATALOG_COVER_PERSONAL_SIGNAL_REQUIRED", "A cover-based Memory needs a personal memory signal");
  }
}

export function assertCompletePrivateCard({ card, title, animeRef, asset }) {
  if (!card || card.status !== "COMPLETE_PRIVATE") {
    fail("CARD_NOT_COMPLETE_PRIVATE", "Card must be COMPLETE_PRIVATE");
  }

  const ownerId = requireOwnerId(card.ownerId);
  const hasPrivateTitle = Boolean(card.privateTitleId);
  const hasAnimeRef = Boolean(card.animeRefId);
  if (!hasPrivateTitle && !hasAnimeRef) {
    fail("TITLE_REFERENCE_REQUIRED", "Complete Card requires a title reference");
  }
  if (hasPrivateTitle && hasAnimeRef) {
    fail("TITLE_REFERENCE_CONFLICT", "Complete Card must reference exactly one title");
  }

  const referencedTitle = hasPrivateTitle ? title : animeRef;
  const expectedTitleId = hasPrivateTitle ? card.privateTitleId : card.animeRefId;
  if (!referencedTitle || referencedTitle.id !== expectedTitleId) {
    fail("TITLE_REFERENCE_MISSING", "Referenced title does not exist");
  }
  if (hasPrivateTitle && referencedTitle.ownerId !== ownerId) {
    fail("CROSS_OWNER_REFERENCE", "Private title belongs to another owner");
  }

  if (!card.visualAssetId || !asset || asset.id !== card.visualAssetId) {
    fail("VISUAL_ASSET_REQUIRED", "Complete Card requires a VisualAsset");
  }
  if (asset.ownerId !== ownerId) {
    fail("CROSS_OWNER_REFERENCE", "VisualAsset belongs to another owner");
  }
  if (asset.state !== "READY") {
    fail("VISUAL_ASSET_NOT_READY", "VisualAsset must be READY");
  }
  if (asset.visibility !== "PRIVATE") fail("PRIVATE_STORAGE_REQUIRED", "Card metadata must remain private");

  if (asset.imageType === "CATALOG_COVER") {
    const coverRef = normalizeCatalogCoverRef(asset.catalogCoverRef);
    if (asset.intakeSource !== "CATALOG_COVER" || asset.storageScope !== "CATALOG_MANAGED"
      || asset.rightsBasis !== "EXPLICIT_PERMISSION" || asset.localRef != null
      || asset.designSpec != null || coverRef.catalogAnimeId !== animeRef?.catalogAnimeId) {
      fail("INVALID_CATALOG_COVER_ASSET", "Catalog cover assets must remain catalog-managed references");
    }
    assertCatalogCoverPersonalSignal(card, asset);
  } else if (asset.imageType === "SYSTEM_DESIGN") {
    if (asset.storageScope !== "LOCAL_ONLY" || asset.rightsBasis !== "SYSTEM_GENERATED"
      || !asset.designSpec || asset.localRef != null) {
      fail("INVALID_SYSTEM_DESIGN_ASSET", "System designs must remain reproducible local assets");
    }
  } else if (asset.storageScope !== "LOCAL_ONLY") {
    fail("PRIVATE_STORAGE_REQUIRED", "User images must remain local and private");
  }

  return true;
}
