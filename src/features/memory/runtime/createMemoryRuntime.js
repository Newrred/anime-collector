import { createMemoryCardCommand } from "../application/createMemoryCard.js";
import { createUpdateMemoryCardCommand } from "../application/updateMemoryCard.js";
import { createDeleteMemoryCardCommand } from "../application/deleteMemoryCard.js";
import { createMemoryOperationReconciler } from "../application/reconcileMemoryOperations.js";
import { createReplaceMemoryCardImageCommand } from "../application/replaceMemoryCardImage.js";
import { createDeferredTicketCleanup } from "./deferredTicketCleanup.js";

export function createMemoryRuntime({
  repository,
  imageIntake,
  createCommand,
  replaceCommand,
  uuid,
  clock,
  telemetry = { track: () => {} },
  reconciler,
  titleResolver = { search: async () => ({ results: [], remoteStatus: "UNAVAILABLE" }) },
  ticketCleanup,
}) {
  if (!repository || !imageIntake || !uuid || !clock) {
    throw new TypeError("Memory runtime dependencies are required");
  }

  const command = createCommand || createMemoryCardCommand({
    repository,
    localMedia: imageIntake,
    telemetry,
    clock,
    ids: { next: () => uuid() },
  });
  const updateCommand = createUpdateMemoryCardCommand({ repository, telemetry, clock });
  const deleteCommand = createDeleteMemoryCardCommand({
    repository,
    localMedia: imageIntake,
    telemetry,
    clock,
  });
  const imageReplacementCommand = replaceCommand || createReplaceMemoryCardImageCommand({
    repository,
    localMedia: imageIntake,
    telemetry,
    clock,
    ids: { next: () => uuid() },
  });
  const operationReconciler = reconciler || (
    typeof repository.listRecoverableOperations === "function"
      ? createMemoryOperationReconciler({ repository, localMedia: imageIntake, clock })
      : { execute: async () => ({ recovered: 0, failed: 0 }) }
  );
  const deferredTicketCleanup = ticketCleanup || createDeferredTicketCleanup();
  let ownerPromise = null;

  const initialize = () => {
    if (!ownerPromise) {
      ownerPromise = repository.ensureGuestOwner({ uuid: uuid(), now: clock.now() })
        .then(async (owner) => {
          await operationReconciler.execute(owner.id);
          await deferredTicketCleanup.flush((ticketId) => imageIntake.discard(ticketId));
          return owner;
        })
        .catch((error) => {
          ownerPromise = null;
          throw error;
        });
    }
    return ownerPromise;
  };

  return Object.freeze({
    imageIntake,
    initialize,

    searchTitles(query) {
      return titleResolver.search(query);
    },

    async createCard(input) {
      const owner = await initialize();
      return command.execute({
        ...input,
        operationId: input.operationId || uuid(),
        ownerId: owner.id,
      });
    },

    async listArchive() {
      const owner = await initialize();
      return repository.listArchive(owner.id);
    },

    async getCard(cardId) {
      const owner = await initialize();
      return repository.getCardBundle(owner.id, cardId);
    },

    async updateCard(cardId, updates) {
      const owner = await initialize();
      return updateCommand.execute({ ownerId: owner.id, cardId, ...updates });
    },

    async deleteCard(cardId) {
      const owner = await initialize();
      return deleteCommand.execute({ ownerId: owner.id, cardId, operationId: uuid() });
    },

    async replaceCardImage(cardId, input) {
      const owner = await initialize();
      return imageReplacementCommand.execute({
        ...input,
        ownerId: owner.id,
        cardId,
        operationId: input.operationId || uuid(),
      }).then(async (result) => {
        try {
          const bundle = await repository.getCardBundle(owner.id, cardId);
          const previewDataUrl = bundle?.asset.localRef
            ? await imageIntake.getPreview(bundle.asset.localRef).catch(() => null)
            : null;
          return { ...result, bundle, previewDataUrl, refreshPending: false };
        } catch {
          return {
            ...result,
            bundle: null,
            previewDataUrl: null,
            refreshPending: true,
          };
        }
      });
    },

    async releaseImageTicket(ticketId) {
      try {
        if (await imageIntake.discard(ticketId) === true) {
          deferredTicketCleanup.forget(ticketId);
          return true;
        }
      } catch {
        // The opaque ticket id is retained below for a later startup retry.
      }
      deferredTicketCleanup.defer(ticketId);
      return false;
    },

    getPreview(localRef) {
      return imageIntake.getPreview(localRef);
    },
  });
}
