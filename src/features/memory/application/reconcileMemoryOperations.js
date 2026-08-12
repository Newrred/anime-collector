import { assertCompletePrivateCard } from "../domain/memoryDomain.js";
import { normalizeLocalMediaResult } from "./createMemoryCard.js";
import { buildDeleteCompletion } from "./deleteMemoryCard.js";

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
          const now = String(clock.now());
          await repository.beginOperationAttempt(operation, now);
          const retriedOperation = {
            ...bundle.operation,
            state: "PLANNED",
            attemptCount: Number(bundle.operation.attemptCount || 0) + 1,
            lastErrorCode: null,
            updatedAt: now,
          };

          if (operation.kind === "IMPORT") {
            const media = normalizeLocalMediaResult(await localMedia.promoteTicket({
              ticketId: bundle.operation.intakeTicketId,
              assetId: bundle.operation.assetId,
              operationId: bundle.operation.id,
            }));
            const asset = { ...bundle.asset, ...media, state: "READY", updatedAt: now };
            const card = { ...bundle.card, status: "COMPLETE_PRIVATE", updatedAt: now };
            const result = {
              operationId: bundle.operation.id,
              cardId: card.id,
              visualAssetId: asset.id,
              privateTitleId: card.privateTitleId || null,
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
