import { MemoryApplicationError, normalizeLocalMediaResult } from "./createMemoryCard.js";
import { toRemoteMemoryCard, toRemoteVisualAsset } from "../sync/memorySyncContract.js";
import { prepareAccountSyncOperations } from "./prepareAccountSyncOperations.js";

const safeCode = (error, fallback) => (
  /^[A-Z][A-Z0-9_]{2,63}$/.test(String(error?.code || "")) ? String(error.code) : fallback
);

const applicationError = (code, message) => {
  throw new MemoryApplicationError(code, message);
};

const ownedTicketError = (code, message) => {
  const error = new MemoryApplicationError(code, message);
  error.intakeTicketOwned = true;
  return error;
};

const requireConfirmedDeletion = async (localMedia, localRef) => {
  if (!localRef) return;
  const deleted = await localMedia.deleteAsset({ localRef });
  if (deleted !== true) {
    throw Object.assign(new Error("Private media deletion was not confirmed"), {
      code: "MEDIA_DELETE_FAILED",
    });
  }
};

const scrubReplacedAsset = (asset, now) => ({
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
  designSpec: null,
  updatedAt: now,
});

const replacementResult = ({ operation, card, replacementAsset, previousAsset, cleanupPending }) => ({
  operationId: operation.id,
  cardId: card.id,
  visualAssetId: replacementAsset.id,
  previousAssetId: previousAsset.id,
  cleanupPending,
});

export function createReplaceMemoryCardImageCommand({ repository, localMedia, telemetry, clock, ids }) {
  if (!repository || !localMedia || !telemetry || !clock || !ids) {
    throw new TypeError("Replacement command dependencies are required");
  }

  return Object.freeze({
    async execute({ ownerId, cardId, intakeTicketId, rightsConfirmed, operationId }) {
      const existing = await repository.getOperation(ownerId, operationId);
      if (existing?.state === "COMPLETED" && existing.result) {
        return structuredClone(existing.result);
      }
      if (existing) applicationError("OPERATION_IN_PROGRESS", "Image replacement already exists");
      if (rightsConfirmed !== true) {
        applicationError(
          "LOCAL_USE_CONFIRMATION_REQUIRED",
          "Local image use confirmation is required",
        );
      }
      const bundle = await repository.getCardBundle(ownerId, cardId);
      if (
        !bundle ||
        bundle.card.ownerId !== ownerId ||
        bundle.asset.ownerId !== ownerId ||
        bundle.card.status !== "COMPLETE_PRIVATE" ||
        bundle.asset.state !== "READY"
      ) {
        applicationError("CARD_NOT_FOUND", "Private Card was not found");
      }

      const assetId = String(ids.next("asset") || "").trim();
      const ticketId = String(intakeTicketId || "").trim();
      if (!assetId || !ticketId || !String(operationId || "").trim()) {
        applicationError("INVALID_REPLACEMENT_INPUT", "Replacement identifiers are required");
      }

      const now = String(clock.now());
      const replacementAsset = {
        id: assetId,
        ownerId,
        intakeSource: "NATIVE_IMAGE_INTAKE",
        imageType: "UNKNOWN",
        storageScope: "LOCAL_ONLY",
        visibility: "PRIVATE",
        rightsBasis: "UNKNOWN",
        creatorName: null,
        sourceUrl: null,
        licenseType: null,
        permissionEvidenceRef: null,
        contentRating: "UNSPECIFIED",
        spoilerLevel: "UNSPECIFIED",
        moderationStatus: "NOT_REQUESTED_PRIVATE",
        state: "IMPORTING",
        localRef: null,
        checksumSha256: null,
        mimeType: null,
        byteSize: null,
        width: null,
        height: null,
        designSpec: null,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      };
      const operation = {
        id: String(operationId),
        ownerId,
        assetId,
        previousAssetId: bundle.asset.id,
        cardId: bundle.card.id,
        kind: "REPLACE",
        state: "PLANNED",
        attemptCount: 1,
        lastErrorCode: null,
        intakeTicketId: ticketId,
        result: null,
        createdAt: now,
        updatedAt: now,
      };
      await repository.reserveReplace({
        card: bundle.card,
        previousAsset: bundle.asset,
        replacementAsset,
        operation,
      });

      let media;
      try {
        media = normalizeLocalMediaResult(await localMedia.promoteTicket({
          ticketId,
          assetId,
          operationId: operation.id,
        }));
      } catch (error) {
        const code = safeCode(error, "MEDIA_PROMOTION_FAILED");
        try {
          await repository.failOperation({
            ownerId,
            operationId: operation.id,
            errorCode: code,
            now: String(clock.now()),
          });
        } catch {
          // The reserved PLANNED journal remains the durable owner of this ticket.
        }
        throw ownedTicketError(code, "The replacement image could not be stored");
      }

      const switchedAt = String(clock.now());
      const readyAsset = { ...replacementAsset, ...media, state: "READY", updatedAt: switchedAt };
      const switchedCard = { ...bundle.card, visualAssetId: readyAsset.id, updatedAt: switchedAt };
      const pendingPreviousAsset = {
        ...bundle.asset,
        state: "DELETE_PENDING",
        deletedAt: switchedAt,
        updatedAt: switchedAt,
      };
      const pendingResult = replacementResult({
        operation,
        card: switchedCard,
        replacementAsset: readyAsset,
        previousAsset: pendingPreviousAsset,
        cleanupPending: true,
      });
      const switchedOperation = {
        ...operation,
        state: "FILE_READY",
        intakeTicketId: null,
        result: pendingResult,
        updatedAt: switchedAt,
      };
      const syncOperations = await prepareAccountSyncOperations({
        repository,
        ownerId,
        ids,
        createdAt: switchedAt,
        specs: () => [
          {
            entityType: "MEMORY_CARD", entityId: switchedCard.id, operationType: "UPSERT",
            baseVersion: switchedCard.sync?.remoteVersion,
            payload: toRemoteMemoryCard({ card: { ...switchedCard, status: "DRAFT" }, title: bundle.title }),
          },
          {
            entityType: "VISUAL_ASSET", entityId: pendingPreviousAsset.id, operationType: "DELETE",
            baseVersion: pendingPreviousAsset.sync?.remoteVersion,
            payload: toRemoteVisualAsset({
              card: switchedCard,
              asset: { ...pendingPreviousAsset, state: "DELETED", isCurrent: false },
            }),
          },
          {
            entityType: "VISUAL_ASSET", entityId: readyAsset.id, operationType: "UPSERT",
            baseVersion: readyAsset.sync?.remoteVersion,
            payload: toRemoteVisualAsset({ card: switchedCard, asset: { ...readyAsset, isCurrent: true } }),
          },
          {
            entityType: "MEMORY_CARD", entityId: switchedCard.id, operationType: "UPSERT",
            baseVersion: switchedCard.sync?.remoteVersion,
            payload: toRemoteMemoryCard({ card: switchedCard, title: bundle.title }),
          },
        ],
      });
      await repository.commitReplace({
        card: switchedCard,
        replacementAsset: readyAsset,
        previousAsset: pendingPreviousAsset,
        operation: switchedOperation,
        syncOperations,
      });

      try {
        await requireConfirmedDeletion(localMedia, pendingPreviousAsset.localRef);
        const completedAt = String(clock.now());
        const scrubbedPreviousAsset = scrubReplacedAsset(pendingPreviousAsset, completedAt);
        const result = replacementResult({
          operation,
          card: switchedCard,
          replacementAsset: readyAsset,
          previousAsset: scrubbedPreviousAsset,
          cleanupPending: false,
        });
        const completedOperation = {
          ...switchedOperation,
          state: "COMPLETED",
          result,
          updatedAt: completedAt,
        };
        await repository.completeReplace({
          card: switchedCard,
          replacementAsset: readyAsset,
          previousAsset: scrubbedPreviousAsset,
          operation: completedOperation,
        });
        telemetry.track("memory_card_image_replaced", {
          storageScope: "LOCAL_ONLY",
          cleanupPending: false,
        });
        return structuredClone(result);
      } catch (error) {
        try {
          await repository.failOperation({
            ownerId,
            operationId: operation.id,
            errorCode: safeCode(error, "MEDIA_DELETE_FAILED"),
            now: String(clock.now()),
          });
        } catch {
          // FILE_READY remains recoverable even if recording the cleanup failure also fails.
        }
        telemetry.track("memory_card_image_replaced", {
          storageScope: "LOCAL_ONLY",
          cleanupPending: true,
        });
        return structuredClone(pendingResult);
      }
    },
  });
}

export { replacementResult, requireConfirmedDeletion, scrubReplacedAsset };
