import { stableStringify } from "../../../domain/syncHash.js";
import { requireOwnerId } from "../domain/memoryDomain.js";
import {
  toRemoteBoard,
  toRemoteBoardCard,
  toRemoteMemoryCard,
  toRemotePrivateTitle,
  toRemoteVisualAsset,
} from "../sync/memorySyncContract.js";

const LIMITS = Object.freeze({
  privateTitles: 250,
  cards: 500,
  visualAssets: 500,
  boards: 100,
  boardCards: 2000,
});
const MAX_BYTES = 2 * 1024 * 1024;
const CATALOG_ID = /^anime:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const UNRESOLVED_CATALOG_PLACEHOLDER = "anime:00000000-0000-4000-8000-000000000000";

const fail = (code, message) => {
  throw Object.assign(new Error(message), { code });
};
const clone = (value) => value == null ? value : structuredClone(value);
const byId = (left, right) => String(left?.id || "").localeCompare(String(right?.id || ""));

const sha256 = async (value) => {
  if (!globalThis.crypto?.subtle?.digest) fail("SHA256_UNAVAILABLE", "SHA-256 is required for Guest promotion");
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(stableStringify(value)),
  );
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
};

const referencedCardForAsset = (asset, cards, mediaOperations) => {
  const direct = cards.find((card) => card.visualAssetId === asset.id);
  if (direct) return direct;
  const operation = mediaOperations.find((row) => (
    row.assetId === asset.id || row.previousAssetId === asset.id
  ));
  return operation ? cards.find((card) => card.id === operation.cardId) || null : null;
};

export async function buildGuestPromotionManifest({ repository, guestOwnerId } = {}) {
  const ownerId = requireOwnerId(guestOwnerId);
  if (!ownerId.startsWith("guest:") || typeof repository?.readOwnerPromotionBundle !== "function") {
    fail("PROMOTION_INPUT_INVALID", "A Guest owner and promotion repository are required");
  }
  const source = await repository.readOwnerPromotionBundle(ownerId);
  if (!source || source.owner?.id !== ownerId || source.owner?.kind !== "GUEST") {
    fail("PROMOTION_GUEST_NOT_FOUND", "Guest Memory data was not found");
  }

  const privateTitles = [...(source.privateTitles || [])].sort(byId);
  const animeRefs = [...(source.animeRefs || [])].sort(byId);
  const cards = [...(source.cards || [])].sort(byId);
  const visualAssets = [...(source.visualAssets || [])].sort(byId);
  const boards = [...(source.boards || [])].sort(byId);
  const boardCards = [...(source.boardCards || [])].sort(byId);
  const mediaOperations = [...(source.mediaOperations || [])].sort(byId);
  const privateTitleById = new Map(privateTitles.map((title) => [title.id, title]));
  const animeRefById = new Map(animeRefs.map((animeRef) => [animeRef.id, animeRef]));

  const unresolvedIds = new Set(cards.flatMap((card) => {
    if (!card.animeRefId) return [];
    const animeRef = animeRefById.get(card.animeRefId);
    if (!animeRef) fail("PROMOTION_BUNDLE_INVALID", "A Card AnimeRef is missing");
    return animeRef.catalogAnimeId ? [] : [animeRef.id];
  }));
  const unresolvedAnimeRefs = animeRefs
    .filter((animeRef) => unresolvedIds.has(animeRef.id))
    .map((animeRef) => Object.freeze({
      id: String(animeRef.id),
      displayTitle: String(animeRef.displayTitle || ""),
      sourceBinding: clone(animeRef.sourceBinding),
    }));

  const remoteBundle = {
    privateTitles: privateTitles.map(toRemotePrivateTitle),
    cards: cards.map((card) => {
      const title = card.privateTitleId
        ? privateTitleById.get(card.privateTitleId)
        : animeRefById.get(card.animeRefId);
      if (!title) fail("PROMOTION_BUNDLE_INVALID", "A Card title is missing");
      if (!card.privateTitleId && !title.catalogAnimeId) {
        return Object.freeze({
          ...toRemoteMemoryCard({
            card,
            title: { ...title, catalogAnimeId: UNRESOLVED_CATALOG_PLACEHOLDER },
          }),
          catalogAnimeId: null,
        });
      }
      return toRemoteMemoryCard({ card, title });
    }),
    visualAssets: visualAssets.map((asset) => {
      const card = referencedCardForAsset(asset, cards, mediaOperations);
      if (!card) fail("PROMOTION_BUNDLE_INVALID", "A VisualAsset Card is missing");
      return toRemoteVisualAsset({ card, asset });
    }),
    boards: boards.map(toRemoteBoard),
    boardCards: boardCards.map(toRemoteBoardCard),
  };
  const counts = Object.fromEntries(Object.keys(LIMITS).map((key) => [key, remoteBundle[key].length]));
  if (Object.entries(LIMITS).some(([key, limit]) => counts[key] > limit)) {
    fail("PROMOTION_BUNDLE_TOO_LARGE", "Guest promotion exceeds an entity limit");
  }
  const encodedByteSize = new TextEncoder().encode(JSON.stringify(remoteBundle)).byteLength;
  if (encodedByteSize > MAX_BYTES) {
    fail("PROMOTION_BUNDLE_TOO_LARGE", "Guest promotion exceeds 2 MiB");
  }
  return Object.freeze({
    guestOwnerId: ownerId,
    counts: Object.freeze(counts),
    sourceHash: await sha256(remoteBundle),
    encodedByteSize,
    unresolvedAnimeRefs: Object.freeze(unresolvedAnimeRefs),
    remoteBundle: Object.freeze(remoteBundle),
  });
}

export async function resolvePromotionTitleChoice({
  repository,
  guestOwnerId,
  animeRefId,
  choice,
  now,
} = {}) {
  const ownerId = requireOwnerId(guestOwnerId);
  const referenceId = String(animeRefId || "").toLowerCase();
  const kind = String(choice?.kind || "");
  const catalogAnimeId = choice?.catalogAnimeId == null
    ? null
    : String(choice.catalogAnimeId).toLowerCase();
  if (!ownerId.startsWith("guest:") || !/^[0-9a-f-]{36}$/u.test(referenceId)
    || !["CATALOG", "KEEP_PRIVATE"].includes(kind)
    || (kind === "CATALOG" && !CATALOG_ID.test(catalogAnimeId || ""))
    || (kind === "KEEP_PRIVATE" && catalogAnimeId != null)
    || typeof repository?.resolvePromotionTitleChoice !== "function") {
    fail("PROMOTION_TITLE_CHOICE_INVALID", "Choose an exact catalog title or keep a personal title");
  }
  return repository.resolvePromotionTitleChoice({
    guestOwnerId: ownerId,
    animeRefId: referenceId,
    choice: kind === "CATALOG" ? { kind, catalogAnimeId } : { kind },
    now: String(now),
  });
}
