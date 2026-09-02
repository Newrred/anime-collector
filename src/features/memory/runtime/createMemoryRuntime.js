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
import { toRemoteBoard, toRemoteBoardCard } from "../sync/memorySyncContract.js";
import { prepareAccountSyncOperations } from "../application/prepareAccountSyncOperations.js";

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
  const syncIds = { next: () => uuid() };
  const updateCommand = createUpdateMemoryCardCommand({ repository, telemetry, clock, ids: syncIds });
  const deleteCommand = createDeleteMemoryCardCommand({
    repository,
    localMedia: imageIntake,
    telemetry,
    clock,
    ids: syncIds,
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
      ? createMemoryOperationReconciler({ repository, localMedia: imageIntake, clock, ids: syncIds })
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

  const initialize = async () => {
    if (ownerPromise && typeof repository.getActiveOwner === "function") {
      const [cachedOwner, activeOwner] = await Promise.all([ownerPromise, repository.getActiveOwner()]);
      if (activeOwner?.id && activeOwner.id !== cachedOwner?.id) ownerPromise = null;
    }
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

  const prepare = (ownerId, specs, createdAt) => prepareAccountSyncOperations({
    repository, ownerId, specs: () => specs(), ids: syncIds, createdAt,
  });

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
      const now = String(clock.now());
      const board = createMemoryBoard({
        id: input.id || uuid(),
        ownerId: owner.id,
        title: input.title,
        description: input.description,
        now,
      });
      const syncOperations = await prepare(owner.id, () => [{
        entityType: "MEMORY_BOARD", entityId: board.id, operationType: "UPSERT",
        baseVersion: board.sync?.remoteVersion, payload: toRemoteBoard(board),
      }], now);
      return repository.createBoard(board, { syncOperations });
    },

    async updateBoard(boardId, changes) {
      const owner = await initialize();
      const detail = await repository.getBoard(owner.id, boardId);
      if (!detail) throw Object.assign(new Error("Private Board was not found"), { code: "BOARD_NOT_FOUND" });
      const now = String(clock.now());
      const candidate = createMemoryBoard({
        id: detail.board.id,
        ownerId: owner.id,
        title: Object.hasOwn(changes || {}, "title") ? changes.title : detail.board.title,
        description: Object.hasOwn(changes || {}, "description") ? changes.description : detail.board.description,
        now: detail.board.createdAt,
      });
      const updated = { ...detail.board, title: candidate.title, description: candidate.description, updatedAt: now };
      const syncOperations = await prepare(owner.id, () => [{
        entityType: "MEMORY_BOARD", entityId: updated.id, operationType: "UPSERT",
        baseVersion: updated.sync?.remoteVersion, payload: toRemoteBoard(updated),
      }], now);
      return repository.updateBoard({
        ownerId: owner.id,
        boardId,
        changes,
        now,
        syncOperations,
      });
    },

    async deleteBoard(boardId) {
      const owner = await initialize();
      const detail = await repository.getBoard(owner.id, boardId);
      if (!detail) throw Object.assign(new Error("Private Board was not found"), { code: "BOARD_NOT_FOUND" });
      const now = String(clock.now());
      const deletedBoard = { ...detail.board, deletedAt: now, updatedAt: now };
      const memberships = detail.items.map((item) => ({ ...item.membership, deletedAt: now, updatedAt: now }));
      const syncOperations = await prepare(owner.id, () => [
        { entityType: "MEMORY_BOARD", entityId: deletedBoard.id, operationType: "DELETE", baseVersion: deletedBoard.sync?.remoteVersion, payload: toRemoteBoard(deletedBoard) },
        ...memberships.map((membership) => ({ entityType: "MEMORY_BOARD_CARD", entityId: membership.id, operationType: "DELETE", baseVersion: membership.sync?.remoteVersion, payload: toRemoteBoardCard(membership) })),
      ], now);
      return repository.deleteBoard({ ownerId: owner.id, boardId, now, syncOperations });
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
        now: String(clock.now()),
      });
      const syncOperations = await prepare(owner.id, () => [{
        entityType: "MEMORY_BOARD_CARD", entityId: membership.id, operationType: "UPSERT",
        baseVersion: membership.sync?.remoteVersion, payload: toRemoteBoardCard(membership),
      }], membership.updatedAt);
      return repository.addCardToBoard(membership, { syncOperations });
    },

    async removeCardFromBoard(boardId, cardId) {
      const owner = await initialize();
      const detail = await repository.getBoard(owner.id, boardId);
      const membership = detail?.items.find((item) => item.membership.cardId === cardId)?.membership;
      if (!membership) throw Object.assign(new Error("Board membership was not found"), { code: "BOARD_CARD_NOT_FOUND" });
      const now = String(clock.now());
      const removed = { ...membership, deletedAt: now, updatedAt: now };
      const syncOperations = await prepare(owner.id, () => [{
        entityType: "MEMORY_BOARD_CARD", entityId: removed.id, operationType: "DELETE",
        baseVersion: removed.sync?.remoteVersion, payload: toRemoteBoardCard(removed),
      }], now);
      return repository.removeCardFromBoard({
        ownerId: owner.id,
        boardId,
        cardId,
        now,
        syncOperations,
      });
    },

    async reorderBoardCard(boardId, cardId, { leftPosition = null, rightPosition = null } = {}) {
      const owner = await initialize();
      const detail = await repository.getBoard(owner.id, boardId);
      const membership = detail?.items.find((item) => item.membership.cardId === cardId)?.membership;
      if (!membership) throw Object.assign(new Error("Board membership was not found"), { code: "BOARD_CARD_NOT_FOUND" });
      const now = String(clock.now());
      const positionKey = positionBetween(leftPosition, rightPosition);
      const updated = { ...membership, positionKey, updatedAt: now };
      const syncOperations = await prepare(owner.id, () => [{
        entityType: "MEMORY_BOARD_CARD", entityId: updated.id, operationType: "UPSERT",
        baseVersion: updated.sync?.remoteVersion, payload: toRemoteBoardCard(updated),
      }], now);
      return repository.reorderBoardCard({
        ownerId: owner.id,
        boardId,
        cardId,
        positionKey,
        now,
        syncOperations,
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
