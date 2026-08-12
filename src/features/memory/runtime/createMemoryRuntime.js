import { createMemoryCardCommand } from "../application/createMemoryCard.js";
import { createUpdateMemoryCardCommand } from "../application/updateMemoryCard.js";
import { createDeleteMemoryCardCommand } from "../application/deleteMemoryCard.js";
import { createMemoryOperationReconciler } from "../application/reconcileMemoryOperations.js";

export function createMemoryRuntime({
  repository,
  imageIntake,
  createCommand,
  uuid,
  clock,
  telemetry = { track: () => {} },
  reconciler,
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
  const operationReconciler = reconciler || (
    typeof repository.listRecoverableOperations === "function"
      ? createMemoryOperationReconciler({ repository, localMedia: imageIntake, clock })
      : { execute: async () => ({ recovered: 0, failed: 0 }) }
  );
  let ownerPromise = null;

  const initialize = () => {
    if (!ownerPromise) {
      ownerPromise = repository.ensureGuestOwner({ uuid: uuid(), now: clock.now() })
        .then(async (owner) => {
          await operationReconciler.execute(owner.id);
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

    getPreview(localRef) {
      return imageIntake.getPreview(localRef);
    },
  });
}
