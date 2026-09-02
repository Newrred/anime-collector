import { createMemoryCardCommand } from "../application/createMemoryCard.js";
import { createUpdateMemoryCardCommand } from "../application/updateMemoryCard.js";
import { createDeleteMemoryCardCommand } from "../application/deleteMemoryCard.js";
import { createMemoryOperationReconciler } from "../application/reconcileMemoryOperations.js";
import { createReplaceMemoryCardImageCommand } from "../application/replaceMemoryCardImage.js";
import { createDeferredTicketCleanup } from "./deferredTicketCleanup.js";
import {
  createBoardCard,
  createMemoryBoard,
  positionBetween,
} from "../domain/memoryBoard.js";

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

  const initializeOwner = async () => {
    const now = clock.now();
    const generatedUuid = uuid();
    if (
      typeof repository.ensureInstallationIdentity === "function"
      && typeof repository.getActiveOwner === "function"
    ) {
      const identity = await repository.ensureInstallationIdentity({
        uuid: generatedUuid,
        now,
      });
      const activeOwner = await repository.getActiveOwner();
      if (activeOwner) return activeOwner;
      if (typeof repository.activateOwner === "function") {
        return repository.activateOwner({ ownerId: identity.guestOwner.id, now });
      }
      return identity.guestOwner;
    }
    return repository.ensureGuestOwner({ uuid: generatedUuid, now });
  };

  const initialize = () => {
    if (!ownerPromise) {
      ownerPromise = initializeOwner()
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

    async createBoard(input) {
      const owner = await initialize();
      const board = createMemoryBoard({
        id: input.id || uuid(),
        ownerId: owner.id,
        title: input.title,
        description: input.description,
        now: clock.now(),
      });
      return repository.createBoard(board);
    },

    async updateBoard(boardId, changes) {
      const owner = await initialize();
      return repository.updateBoard({
        ownerId: owner.id,
        boardId,
        changes,
        now: clock.now(),
      });
    },

    async deleteBoard(boardId) {
      const owner = await initialize();
      return repository.deleteBoard({ ownerId: owner.id, boardId, now: clock.now() });
    },

    async listBoards() {
      const owner = await initialize();
      return repository.listBoards(owner.id);
    },

    async getBoard(boardId) {
      const owner = await initialize();
      return repository.getBoard(owner.id, boardId);
    },

    async addCardToBoard(boardId, cardId) {
      const owner = await initialize();
      const detail = await repository.getBoard(owner.id, boardId);
      if (!detail) throw Object.assign(new Error("Private Board was not found"), { code: "BOARD_NOT_FOUND" });
      const lastPosition = detail.items.at(-1)?.membership.positionKey || null;
      const membership = createBoardCard({
        id: uuid(),
        ownerId: owner.id,
        boardOwnerId: detail.board.ownerId,
        cardOwnerId: owner.id,
        boardId,
        cardId,
        positionKey: positionBetween(lastPosition, null),
        now: clock.now(),
      });
      return repository.addCardToBoard(membership);
    },

    async removeCardFromBoard(boardId, cardId) {
      const owner = await initialize();
      return repository.removeCardFromBoard({
        ownerId: owner.id,
        boardId,
        cardId,
        now: clock.now(),
      });
    },

    async reorderBoardCard(boardId, cardId, { leftPosition = null, rightPosition = null } = {}) {
      const owner = await initialize();
      return repository.reorderBoardCard({
        ownerId: owner.id,
        boardId,
        cardId,
        positionKey: positionBetween(leftPosition, rightPosition),
        now: clock.now(),
      });
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
