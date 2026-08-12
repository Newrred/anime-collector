import { assertCompletePrivateCard } from "../domain/memoryDomain.js";
import { normalizeLocalMediaResult } from "./createMemoryCard.js";
import { buildDeleteCompletion } from "./deleteMemoryCard.js";
import {
  replacementResult,
  requireConfirmedDeletion,
  scrubReplacedAsset,
} from "./replaceMemoryCardImage.js";

const safeErrorCode = (error) => /^[A-Z][A-Z0-9_]{2,63}$/.test(String(error?.code || ""))
  ? String(error.code)
  : "OPERATION_RECOVERY_FAILED";

export function createMemoryOperationReconciler({ repository, localMedia, clock }) {
  return Object.freeze({
    async execute(ownerId) {
      const operations = await repository.listRecoverableOperations(ownerId);
      const report = { recovered: 0, failed: 0 };

      for (const operation of operations) {
        try {
          const bundle = await repository.getOperationBundle(ownerId, operation.id);
          if (!bundle || bundle.operation.ownerId !== ownerId) {
            throw Object.assign(new Error("Recovery journal is incomplete"), {
              code: "OPERATION_RESERVATION_MISMATCH",
            });
          }
          const journal = bundle.operation;
          const now = String(clock.now());
          await repository.beginOperationAttempt(operation, now);
          const retriedOperation = {
            ...journal,
            state: "PLANNED",
            attemptCount: Number(journal.attemptCount || 0) + 1,
            lastErrorCode: null,
            updatedAt: now,
          };

          if (operation.kind === "IMPORT") {
            const media = normalizeLocalMediaResult(await localMedia.promoteTicket({
              ticketId: journal.intakeTicketId,
              assetId: journal.assetId,
              operationId: journal.id,
            }));
            const asset = { ...bundle.asset, ...media, state: "READY", updatedAt: now };
            const card = { ...bundle.card, status: "COMPLETE_PRIVATE", updatedAt: now };
            const result = {
              operationId: journal.id,
              cardId: card.id,
              visualAssetId: asset.id,
              ...(card.privateTitleId
                ? { privateTitleId: card.privateTitleId }
                : { animeRefId: card.animeRefId }),
            };
            const completedOperation = {
              ...retriedOperation,
              state: "COMPLETED",
              intakeTicketId: null,
              result,
            };
            assertCompletePrivateCard({ card, title: bundle.title, animeRef: bundle.animeRef, asset });
            await repository.completeCreate({
              title: bundle.title,
              animeRef: bundle.animeRef,
              card,
              asset,
              operation: completedOperation,
            });
          } else if (operation.kind === "DELETE") {
            if (bundle.asset.localRef) {
              await localMedia.deleteAsset({ localRef: bundle.asset.localRef });
            }
            await repository.completeDelete(buildDeleteCompletion({
              card: bundle.card,
              asset: bundle.asset,
              operation: retriedOperation,
              now,
            }));
          } else if (operation.kind === "REPLACE") {
            let card = bundle.card;
            let replacementAsset = bundle.asset;
            let previousAsset = bundle.previousAsset;
            let replacementOperation = retriedOperation;
            const replacementCommitted = (
              bundle.card.visualAssetId === bundle.asset.id &&
              bundle.asset.state === "READY" &&
              bundle.previousAsset?.state === "DELETE_PENDING"
            );
            if (!replacementCommitted) {
              const media = normalizeLocalMediaResult(await localMedia.promoteTicket({
                ticketId: journal.intakeTicketId,
                assetId: journal.assetId,
                operationId: journal.id,
              }));
              replacementAsset = {
                ...bundle.asset,
                ...media,
                state: "READY",
                updatedAt: now,
              };
              card = { ...bundle.card, visualAssetId: replacementAsset.id, updatedAt: now };
              previousAsset = {
                ...bundle.previousAsset,
                state: "DELETE_PENDING",
                deletedAt: now,
                updatedAt: now,
              };
              const pendingResult = replacementResult({
                operation: retriedOperation,
                card,
                replacementAsset,
                previousAsset,
                cleanupPending: true,
              });
              replacementOperation = {
                ...retriedOperation,
                state: "FILE_READY",
                intakeTicketId: null,
                result: pendingResult,
              };
              assertCompletePrivateCard({
                card,
                title: bundle.title,
                animeRef: bundle.animeRef,
                asset: replacementAsset,
              });
              await repository.commitReplace({
                card,
                replacementAsset,
                previousAsset,
                operation: replacementOperation,
              });
            }
            await requireConfirmedDeletion(localMedia, previousAsset.localRef);
            previousAsset = scrubReplacedAsset(previousAsset, now);
            const result = replacementResult({
              operation: replacementOperation,
              card,
              replacementAsset,
              previousAsset,
              cleanupPending: false,
            });
            await repository.completeReplace({
              card,
              replacementAsset,
              previousAsset,
              operation: {
                ...replacementOperation,
                state: "COMPLETED",
                intakeTicketId: null,
                result,
              },
            });
          } else {
            throw Object.assign(new Error("Unsupported recovery operation"), {
              code: "UNSUPPORTED_RECOVERY_OPERATION",
            });
          }
          report.recovered += 1;
        } catch (error) {
          await repository.failOperation({
            ownerId,
            operationId: operation.id,
            errorCode: safeErrorCode(error),
            now: String(clock.now()),
          });
          report.failed += 1;
        }
      }
      return report;
    },
  });
}
