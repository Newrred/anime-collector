import { MemoryApplicationError } from "./createMemoryCard.js";
import { toRemoteBoardCard, toRemoteMemoryCard, toRemoteVisualAsset } from "../sync/memorySyncContract.js";
import { prepareAccountSyncOperations } from "./prepareAccountSyncOperations.js";

const safeDeleteError = (error) => {
  const code = /^[A-Z][A-Z0-9_]{2,63}$/.test(String(error?.code || ""))
    ? String(error.code)
    : "MEDIA_DELETE_FAILED";
  return new MemoryApplicationError(code, "The private image could not be deleted");
};

export function buildDeleteCompletion({ card, asset, operation, now }) {
  const scrubbedCard = {
    ...card,
    note: null,
    watchedAt: null,
    episode: null,
    sceneCue: null,
    emotionTags: [],
    rewatchIntent: null,
    updatedAt: now,
  };
  const scrubbedAsset = {
    ...asset,
    state: "DELETED",
    localRef: null,
    checksumSha256: null,
    creatorName: null,
    sourceUrl: null,
    licenseType: null,
    permissionEvidenceRef: null,
    mimeType: null,
    byteSize: null,
    width: null,
    height: null,
    updatedAt: now,
  };
  const result = { operationId: operation.id, cardId: card.id, deleted: true };
  return {
    card: scrubbedCard,
    asset: scrubbedAsset,
    operation: { ...operation, state: "COMPLETED", result, updatedAt: now },
    result,
  };
}

export function createDeleteMemoryCardCommand({ repository, localMedia, telemetry, clock, ids }) {
  return Object.freeze({
    async execute({ ownerId, cardId, operationId }) {
      const existing = await repository.getOperation(ownerId, operationId);
      if (existing?.state === "COMPLETED" && existing.result) {
        return structuredClone(existing.result);
      }
      if (existing) {
        throw new MemoryApplicationError("OPERATION_IN_PROGRESS", "Delete operation already exists");
      }

      const bundle = await repository.getCardBundle(ownerId, cardId);
      if (
        !bundle ||
        bundle.card.ownerId !== ownerId ||
        bundle.asset.ownerId !== ownerId ||
        bundle.card.status !== "COMPLETE_PRIVATE" ||
        bundle.asset.state !== "READY"
      ) {
        throw new MemoryApplicationError("CARD_NOT_FOUND", "Private Card was not found");
      }

      const now = String(clock.now());
      const card = { ...bundle.card, status: "DELETED", deletedAt: now, updatedAt: now };
      const asset = { ...bundle.asset, state: "DELETE_PENDING", deletedAt: now, updatedAt: now };
      const operation = {
        id: operationId,
        ownerId,
        assetId: asset.id,
        cardId: card.id,
        kind: "DELETE",
        state: "PLANNED",
        attemptCount: 1,
        lastErrorCode: null,
        result: null,
        createdAt: now,
        updatedAt: now,
      };
      const memberships = typeof repository.listCardBoardMemberships === "function"
        ? await repository.listCardBoardMemberships(ownerId, cardId)
        : [];
      const syncOperations = await prepareAccountSyncOperations({
        repository,
        ownerId,
        ids,
        createdAt: now,
        specs: () => [
          {
            entityType: "MEMORY_CARD", entityId: card.id, operationType: "DELETE",
            baseVersion: card.sync?.remoteVersion,
            payload: toRemoteMemoryCard({ card, title: bundle.title }),
          },
          {
            entityType: "VISUAL_ASSET", entityId: asset.id, operationType: "DELETE",
            baseVersion: asset.sync?.remoteVersion,
            payload: toRemoteVisualAsset({
              card,
              asset: { ...asset, state: "DELETED", isCurrent: false },
            }),
          },
          ...memberships.map((membership) => ({
            entityType: "MEMORY_BOARD_CARD", entityId: membership.id, operationType: "DELETE",
            baseVersion: membership.sync?.remoteVersion,
            payload: toRemoteBoardCard({ ...membership, deletedAt: now, updatedAt: now }),
          })),
        ],
      });
      await repository.planDelete({ card, asset, operation, syncOperations });

      try {
        if (bundle.asset.localRef) {
          await localMedia.deleteAsset({ localRef: bundle.asset.localRef });
        }
      } catch (error) {
        const typed = safeDeleteError(error);
        await repository.failOperation({
          ownerId,
          operationId,
          errorCode: typed.code,
          now: String(clock.now()),
        });
        throw typed;
      }

      const completedAt = String(clock.now());
      const completion = buildDeleteCompletion({ card, asset, operation, now: completedAt });
      await repository.completeDelete(completion);
      telemetry.track("memory_card_deleted", { storageScope: "LOCAL_ONLY" });
      return structuredClone(completion.result);
    },
  });
}
