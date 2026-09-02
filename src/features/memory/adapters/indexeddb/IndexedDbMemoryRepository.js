import {
  createDefaultSyncEnvelope,
  requireOwnerId,
} from "../../domain/memoryDomain.js";
import { openMemoryDatabase } from "./memoryDb.js";
import {
  activateOwner,
  beginPromotionJournal,
  commitPromotionToAccount,
  ensureAccountOwner,
  ensureInstallationIdentity,
  getActiveOwner,
  listRecoverablePromotions,
  markPromotionRemoteCompleted,
  readOwnerPromotionBundle,
  resolvePromotionTitleChoice,
  rotateGuestOwnerAfterPromotion,
} from "./memoryOwnerStore.js";
import {
  addCardToBoard,
  createBoard,
  deleteBoard,
  getBoard,
  listBoards,
  removeCardFromBoard,
  reorderBoardCard,
  updateBoard,
} from "./memoryBoardStore.js";
import {
  appendSyncOperation,
  commitConflictResolution,
  commitFullResync,
  commitPulledChange,
  commitSyncMutation,
  countPendingSyncOperations,
  getSyncConflict,
  hasPendingEntityOperation,
  listOpenSyncConflicts,
  listPendingSyncOperations,
  readDeviceSyncState,
  rebaseSyncOperation,
} from "./memorySyncStore.js";

const requestResult = (request) => new Promise((resolve, reject) => {
  request.onsuccess = () => resolve(request.result ?? null);
  request.onerror = () => reject(request.error || new Error("IndexedDB request failed"));
});

const transactionDone = (transaction) => new Promise((resolve, reject) => {
  transaction.oncomplete = () => resolve();
  transaction.onabort = () => reject(transaction.error || new Error("IndexedDB transaction aborted"));
  transaction.onerror = () => reject(transaction.error || new Error("IndexedDB transaction failed"));
});

const clone = (value) => value == null ? value : structuredClone(value);

const normalizePrivateTitle = (title) => ({
  ...title,
  deletedAt: title.deletedAt ?? null,
  sync: title.sync || createDefaultSyncEnvelope(title.updatedAt || title.createdAt),
});

const normalizeAnimeRef = (animeRef) => ({
  ...animeRef,
  catalogAnimeId: animeRef.catalogAnimeId ?? null,
});

const normalizeCard = (card) => ({
  ...card,
  watchedAtPrecision: card.watchedAtPrecision || "UNKNOWN",
  deletedAt: card.deletedAt ?? null,
  sync: card.sync || createDefaultSyncEnvelope(card.updatedAt || card.createdAt),
});

const normalizeAsset = (asset) => ({
  ...asset,
  isCurrent: asset.isCurrent ?? (asset.state === "READY" && asset.deletedAt == null),
  deletedAt: asset.deletedAt ?? null,
  sync: asset.sync || createDefaultSyncEnvelope(asset.updatedAt || asset.createdAt),
});

const requireOwner = async (database, ownerId) => {
  const validOwnerId = requireOwnerId(ownerId);
  const transaction = database.transaction("owners", "readonly");
  const owner = await requestResult(transaction.objectStore("owners").get(validOwnerId));
  await transactionDone(transaction);
  if (!owner) throw Object.assign(new Error("Owner does not exist"), { code: "OWNER_NOT_FOUND" });
  return owner;
};

export class IndexedDbMemoryRepository {
  constructor(database) {
    this.database = database;
  }

  static async open({ indexedDb } = {}) {
    return new IndexedDbMemoryRepository(await openMemoryDatabase(indexedDb));
  }

  close() {
    this.database.close();
  }

  async ensureGuestOwner({ uuid, now }) {
    return (await ensureInstallationIdentity(this.database, { uuid, now })).guestOwner;
  }

  ensureInstallationIdentity(input) {
    return ensureInstallationIdentity(this.database, input);
  }

  getActiveOwner() {
    return getActiveOwner(this.database);
  }

  ensureAccountOwner(input) {
    return ensureAccountOwner(this.database, input);
  }

  activateOwner(input) {
    return activateOwner(this.database, input);
  }

  rotateGuestOwnerAfterPromotion(input) {
    return rotateGuestOwnerAfterPromotion(this.database, input);
  }

  readOwnerPromotionBundle(ownerId) {
    return readOwnerPromotionBundle(this.database, ownerId);
  }

  resolvePromotionTitleChoice(input) {
    return resolvePromotionTitleChoice(this.database, input);
  }

  beginPromotionJournal(input) {
    return beginPromotionJournal(this.database, input);
  }

  markPromotionRemoteCompleted(input) {
    return markPromotionRemoteCompleted(this.database, input);
  }

  listRecoverablePromotions(accountOwnerId) {
    return listRecoverablePromotions(this.database, accountOwnerId);
  }

  commitPromotionToAccount(input) {
    return commitPromotionToAccount(this.database, input);
  }

  createBoard(board) {
    return createBoard(this.database, board);
  }

  updateBoard(input) {
    return updateBoard(this.database, input);
  }

  deleteBoard(input) {
    return deleteBoard(this.database, input);
  }

  addCardToBoard(membership) {
    return addCardToBoard(this.database, membership);
  }

  removeCardFromBoard(input) {
    return removeCardFromBoard(this.database, input);
  }

  reorderBoardCard(input) {
    return reorderBoardCard(this.database, input);
  }

  enqueueMutation(operation) {
    return appendSyncOperation(this.database, operation);
  }

  listPendingSyncOperations(ownerId, limit) {
    return listPendingSyncOperations(this.database, ownerId, limit);
  }

  countPendingSyncOperations(ownerId) {
    return countPendingSyncOperations(this.database, ownerId);
  }

  rebaseSyncOperation(input) {
    return rebaseSyncOperation(this.database, input);
  }

  commitSyncMutation(input) {
    return commitSyncMutation(this.database, input);
  }

  readDeviceSyncState(ownerId) {
    return readDeviceSyncState(this.database, ownerId);
  }

  hasPendingEntityOperation(ownerId, entityType, entityId) {
    return hasPendingEntityOperation(this.database, ownerId, entityType, entityId);
  }

  commitPulledChange(input) {
    return commitPulledChange(this.database, input);
  }

  commitFullResync(input) {
    return commitFullResync(this.database, input);
  }

  listOpenSyncConflicts(ownerId) {
    return listOpenSyncConflicts(this.database, ownerId);
  }

  getSyncConflict(ownerId, conflictId) {
    return getSyncConflict(this.database, ownerId, conflictId);
  }

  commitConflictResolution(input) {
    return commitConflictResolution(this.database, input);
  }

  listBoards(ownerId) {
    return listBoards(this.database, ownerId);
  }

  async getBoard(ownerId, boardId) {
    const result = await getBoard(this.database, ownerId, boardId);
    if (!result) return null;
    const memberships = await Promise.all(result.memberships.map(async (membership) => ({
      membership,
      bundle: await this.getCardBundle(ownerId, membership.cardId),
    })));
    return {
      board: result.board,
      items: memberships.filter((item) => item.bundle),
    };
  }

  async getOperation(ownerId, operationId) {
    const transaction = this.database.transaction("media_operations", "readonly");
    const operation = await requestResult(transaction.objectStore("media_operations").get(operationId));
    await transactionDone(transaction);
    return operation?.ownerId === ownerId ? clone(operation) : null;
  }

  async countCompleteCards(ownerId) {
    const transaction = this.database.transaction("memory_cards", "readonly");
    const index = transaction.objectStore("memory_cards").index("owner_status_updated");
    const range = IDBKeyRange.bound(
      [ownerId, "COMPLETE_PRIVATE", ""],
      [ownerId, "COMPLETE_PRIVATE", "\uffff"],
    );
    const count = await requestResult(index.count(range));
    await transactionDone(transaction);
    return Number(count || 0);
  }

  async findAnimeRefBySourceKey(sourceKey) {
    const transaction = this.database.transaction("anime_refs", "readonly");
    const animeRef = await requestResult(
      transaction.objectStore("anime_refs").index("source_key").get(String(sourceKey || "")),
    );
    await transactionDone(transaction);
    return clone(animeRef);
  }

  async reserveCreate({ title = null, animeRef = null, card, asset, operation }) {
    await requireOwner(this.database, operation.ownerId);
    const existing = await this.getOperation(operation.ownerId, operation.id);
    if (existing) {
      throw Object.assign(new Error("Operation already exists"), { code: "OPERATION_EXISTS" });
    }

    if (Boolean(title) === Boolean(animeRef)) {
      throw Object.assign(new Error("Create requires exactly one title record"), {
        code: "TITLE_REFERENCE_CONFLICT",
      });
    }
    if ([title?.ownerId, card.ownerId, asset.ownerId]
      .filter(Boolean)
      .some((ownerId) => ownerId !== operation.ownerId)) {
      throw Object.assign(new Error("Cross-owner reservation rejected"), {
        code: "CROSS_OWNER_REFERENCE",
      });
    }

    const titleStore = title ? "private_titles" : "anime_refs";
    const transaction = this.database.transaction(
      [titleStore, "memory_cards", "visual_assets", "media_operations"],
      "readwrite",
    );
    if (title) transaction.objectStore(titleStore).add(normalizePrivateTitle(title));
    else transaction.objectStore(titleStore).put(normalizeAnimeRef(animeRef));
    transaction.objectStore("memory_cards").add(normalizeCard(card));
    transaction.objectStore("visual_assets").add(normalizeAsset(asset));
    transaction.objectStore("media_operations").add(operation);
    await transactionDone(transaction);
  }

  async completeCreate({ title = null, animeRef = null, card, asset, operation }) {
    const existing = await this.getOperation(operation.ownerId, operation.id);
    if (!existing || existing.cardId !== card.id || existing.assetId !== asset.id) {
      throw Object.assign(new Error("Create reservation does not match completion"), {
        code: "OPERATION_RESERVATION_MISMATCH",
      });
    }
    if (Boolean(title) === Boolean(animeRef)) {
      throw Object.assign(new Error("Completion requires exactly one title record"), {
        code: "TITLE_REFERENCE_CONFLICT",
      });
    }
    if ([title?.ownerId, card.ownerId, asset.ownerId]
      .filter(Boolean)
      .some((ownerId) => ownerId !== operation.ownerId)) {
      throw Object.assign(new Error("Cross-owner completion rejected"), { code: "CROSS_OWNER_REFERENCE" });
    }

    const titleStore = title ? "private_titles" : "anime_refs";
    const transaction = this.database.transaction(
      [titleStore, "memory_cards", "visual_assets", "media_operations"],
      "readwrite",
    );
    transaction.objectStore(titleStore).put(
      title ? normalizePrivateTitle(title) : normalizeAnimeRef(animeRef),
    );
    transaction.objectStore("memory_cards").put(normalizeCard(card));
    transaction.objectStore("visual_assets").put(normalizeAsset({ ...asset, isCurrent: true }));
    transaction.objectStore("media_operations").put(operation);
    await transactionDone(transaction);
  }

  async failOperation({ ownerId, operationId, errorCode, now }) {
    const operation = await this.getOperation(ownerId, operationId);
    if (!operation) return;
    const transaction = this.database.transaction("media_operations", "readwrite");
    transaction.objectStore("media_operations").put({
      ...operation,
      state: "FAILED",
      attemptCount: Math.max(1, Number(operation.attemptCount || 0)),
      lastErrorCode: String(errorCode),
      updatedAt: String(now),
    });
    await transactionDone(transaction);
  }

  async listArchive(ownerId) {
    const transaction = this.database.transaction("memory_cards", "readonly");
    const index = transaction.objectStore("memory_cards").index("owner_status_updated");
    const range = IDBKeyRange.bound(
      [ownerId, "COMPLETE_PRIVATE", ""],
      [ownerId, "COMPLETE_PRIVATE", "\uffff"],
    );
    const cards = await requestResult(index.getAll(range));
    await transactionDone(transaction);

    const sorted = cards.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
    return Promise.all(sorted.map((card) => this.getCardBundle(ownerId, card.id)));
  }

  async getCardBundle(ownerId, cardId) {
    const transaction = this.database.transaction(
      ["memory_cards", "private_titles", "anime_refs", "visual_assets"],
      "readonly",
    );
    const stores = {
      cards: transaction.objectStore("memory_cards"),
      titles: transaction.objectStore("private_titles"),
      anime: transaction.objectStore("anime_refs"),
      assets: transaction.objectStore("visual_assets"),
    };
    const card = await requestResult(stores.cards.get(cardId));
    if (!card || card.ownerId !== ownerId || card.status === "DELETED") {
      await transactionDone(transaction);
      return null;
    }
    const title = card.privateTitleId
      ? await requestResult(stores.titles.get(card.privateTitleId))
      : await requestResult(stores.anime.get(card.animeRefId));
    const asset = await requestResult(stores.assets.get(card.visualAssetId));
    await transactionDone(transaction);
    if (!title || !asset || asset.ownerId !== ownerId || (title.ownerId && title.ownerId !== ownerId)) {
      return null;
    }
    return clone({ card, title, asset });
  }

  async updateCardMetadata({ ownerId, cardId, changes, now }) {
    const transaction = this.database.transaction("memory_cards", "readwrite");
    const cards = transaction.objectStore("memory_cards");
    const current = await requestResult(cards.get(cardId));
    if (!current || current.ownerId !== ownerId || current.status !== "COMPLETE_PRIVATE") {
      transaction.abort();
      throw Object.assign(new Error("Private Card was not found"), { code: "CARD_NOT_FOUND" });
    }
    const card = {
      ...current,
      ...(Object.hasOwn(changes || {}, "note") ? { note: changes.note } : {}),
      updatedAt: String(now),
    };
    cards.put(card);
    await transactionDone(transaction);
    return clone(card);
  }

  async reserveReplace({ card, previousAsset, replacementAsset, operation }) {
    await requireOwner(this.database, operation.ownerId);
    if (
      card.ownerId !== operation.ownerId ||
      previousAsset.ownerId !== operation.ownerId ||
      replacementAsset.ownerId !== operation.ownerId ||
      replacementAsset.id !== operation.assetId ||
      previousAsset.id !== operation.previousAssetId
    ) {
      throw Object.assign(new Error("Cross-owner replacement rejected"), {
        code: "CROSS_OWNER_REFERENCE",
      });
    }

    const transaction = this.database.transaction(
      ["memory_cards", "visual_assets", "media_operations"],
      "readwrite",
    );
    const cards = transaction.objectStore("memory_cards");
    const assets = transaction.objectStore("visual_assets");
    const operations = transaction.objectStore("media_operations");
    const [storedCard, storedPreviousAsset, storedOperation, existingOperations] = await Promise.all([
      requestResult(cards.get(card.id)),
      requestResult(assets.get(previousAsset.id)),
      requestResult(operations.get(operation.id)),
      requestResult(operations.getAll()),
    ]);
    const activeReplacement = existingOperations.some((candidate) => (
      candidate.ownerId === operation.ownerId &&
      candidate.cardId === card.id &&
      candidate.kind === "REPLACE" &&
      ["PLANNED", "FILE_READY", "FAILED"].includes(candidate.state)
    ));
    if (activeReplacement) {
      transaction.abort();
      throw Object.assign(new Error("Another image replacement is in progress"), {
        code: "OPERATION_IN_PROGRESS",
      });
    }
    if (
      storedOperation ||
      !storedCard ||
      storedCard.ownerId !== operation.ownerId ||
      storedCard.status !== "COMPLETE_PRIVATE" ||
      storedCard.visualAssetId !== previousAsset.id ||
      !storedPreviousAsset ||
      storedPreviousAsset.ownerId !== operation.ownerId ||
      storedPreviousAsset.state !== "READY" ||
      replacementAsset.state !== "IMPORTING"
    ) {
      transaction.abort();
      throw Object.assign(new Error("Replacement reservation is stale"), {
        code: "OPERATION_RESERVATION_MISMATCH",
      });
    }
    assets.add(replacementAsset);
    operations.add(operation);
    await transactionDone(transaction);
  }

  async commitReplace({ card, replacementAsset, previousAsset, operation }) {
    if (
      card.ownerId !== operation.ownerId ||
      replacementAsset.ownerId !== operation.ownerId ||
      previousAsset.ownerId !== operation.ownerId ||
      card.visualAssetId !== replacementAsset.id ||
      replacementAsset.id !== operation.assetId ||
      previousAsset.id !== operation.previousAssetId ||
      replacementAsset.state !== "READY" ||
      previousAsset.state !== "DELETE_PENDING"
    ) {
      throw Object.assign(new Error("Replacement commit is invalid"), {
        code: "OPERATION_RESERVATION_MISMATCH",
      });
    }

    const transaction = this.database.transaction(
      ["memory_cards", "visual_assets", "media_operations"],
      "readwrite",
    );
    const cards = transaction.objectStore("memory_cards");
    const assets = transaction.objectStore("visual_assets");
    const operations = transaction.objectStore("media_operations");
    const [storedCard, storedReplacementAsset, storedPreviousAsset, storedOperation] = await Promise.all([
      requestResult(cards.get(card.id)),
      requestResult(assets.get(replacementAsset.id)),
      requestResult(assets.get(previousAsset.id)),
      requestResult(operations.get(operation.id)),
    ]);
    if (
      !storedCard ||
      storedCard.ownerId !== operation.ownerId ||
      storedCard.visualAssetId !== previousAsset.id ||
      !storedReplacementAsset ||
      storedReplacementAsset.ownerId !== operation.ownerId ||
      storedReplacementAsset.state !== "IMPORTING" ||
      !storedPreviousAsset ||
      storedPreviousAsset.ownerId !== operation.ownerId ||
      storedPreviousAsset.state !== "READY" ||
      !storedOperation ||
      storedOperation.ownerId !== operation.ownerId ||
      storedOperation.kind !== "REPLACE" ||
      storedOperation.assetId !== replacementAsset.id ||
      storedOperation.previousAssetId !== previousAsset.id
    ) {
      transaction.abort();
      throw Object.assign(new Error("Replacement reservation does not match commit"), {
        code: "OPERATION_RESERVATION_MISMATCH",
      });
    }
    const committedCard = {
      ...storedCard,
      visualAssetId: replacementAsset.id,
      updatedAt: card.updatedAt,
    };
    cards.put(committedCard);
    assets.put(replacementAsset);
    assets.put(previousAsset);
    operations.put(operation);
    await transactionDone(transaction);
    return clone(committedCard);
  }

  async completeReplace({ replacementAsset, previousAsset, operation }) {
    if (
      replacementAsset.ownerId !== operation.ownerId ||
      previousAsset.ownerId !== operation.ownerId ||
      replacementAsset.id !== operation.assetId ||
      previousAsset.id !== operation.previousAssetId ||
      replacementAsset.state !== "READY" ||
      previousAsset.state !== "DELETED" ||
      operation.state !== "COMPLETED"
    ) {
      throw Object.assign(new Error("Replacement cleanup is invalid"), {
        code: "OPERATION_RESERVATION_MISMATCH",
      });
    }
    const transaction = this.database.transaction(
      ["visual_assets", "media_operations"],
      "readwrite",
    );
    const assets = transaction.objectStore("visual_assets");
    const operations = transaction.objectStore("media_operations");
    const [storedReplacementAsset, storedPreviousAsset, storedOperation] = await Promise.all([
      requestResult(assets.get(replacementAsset.id)),
      requestResult(assets.get(previousAsset.id)),
      requestResult(operations.get(operation.id)),
    ]);
    if (
      !storedReplacementAsset ||
      storedReplacementAsset.ownerId !== operation.ownerId ||
      storedReplacementAsset.state !== "READY" ||
      !storedPreviousAsset ||
      storedPreviousAsset.ownerId !== operation.ownerId ||
      storedPreviousAsset.state !== "DELETE_PENDING" ||
      !storedOperation ||
      storedOperation.ownerId !== operation.ownerId ||
      storedOperation.kind !== "REPLACE" ||
      storedOperation.assetId !== replacementAsset.id ||
      storedOperation.previousAssetId !== previousAsset.id ||
      !["FILE_READY", "FAILED"].includes(storedOperation.state)
    ) {
      transaction.abort();
      throw Object.assign(new Error("Replacement cleanup reservation was lost"), {
        code: "OPERATION_RESERVATION_MISMATCH",
      });
    }
    assets.put(previousAsset);
    operations.put(operation);
    await transactionDone(transaction);
  }

  async planDelete({ card, asset, operation }) {
    if ([card.ownerId, asset.ownerId].some((ownerId) => ownerId !== operation.ownerId)) {
      throw Object.assign(new Error("Cross-owner delete rejected"), { code: "CROSS_OWNER_REFERENCE" });
    }
    const transaction = this.database.transaction(
      ["memory_cards", "visual_assets", "media_operations", "memory_board_cards"],
      "readwrite",
    );
    const memberships = transaction.objectStore("memory_board_cards");
    const rows = await requestResult(memberships.getAll());
    for (const row of rows.filter((item) => (
      item.ownerId === operation.ownerId && item.cardId === card.id && !item.deletedAt
    ))) {
      memberships.put({
        ...row,
        deletedAt: card.deletedAt,
        updatedAt: card.updatedAt,
        sync: {
          ...(row.sync || createDefaultSyncEnvelope(card.updatedAt)),
          syncState: "LOCAL_ONLY",
          clientUpdatedAt: card.updatedAt,
        },
      });
    }
    transaction.objectStore("memory_cards").put(card);
    transaction.objectStore("visual_assets").put(asset);
    transaction.objectStore("media_operations").add(operation);
    await transactionDone(transaction);
  }

  async completeDelete({ card, asset, operation }) {
    if ([card.ownerId, asset.ownerId].some((ownerId) => ownerId !== operation.ownerId)) {
      throw Object.assign(new Error("Cross-owner delete completion rejected"), {
        code: "CROSS_OWNER_REFERENCE",
      });
    }
    const transaction = this.database.transaction(
      ["memory_cards", "visual_assets", "media_operations"],
      "readwrite",
    );
    transaction.objectStore("memory_cards").put(card);
    transaction.objectStore("visual_assets").put(asset);
    transaction.objectStore("media_operations").put(operation);
    await transactionDone(transaction);
  }

  async listRecoverableOperations(ownerId) {
    const transaction = this.database.transaction("media_operations", "readonly");
    const operations = await requestResult(transaction.objectStore("media_operations").getAll());
    await transactionDone(transaction);
    return clone(operations
      .filter((operation) => (
        operation.ownerId === ownerId &&
        ["PLANNED", "FILE_READY", "FAILED"].includes(operation.state) &&
        ["IMPORT", "REPLACE", "DELETE"].includes(operation.kind)
      ))
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt)));
  }

  async getOperationBundle(ownerId, operationId) {
    const transaction = this.database.transaction(
      ["media_operations", "memory_cards", "visual_assets", "private_titles", "anime_refs"],
      "readonly",
    );
    const operation = await requestResult(transaction.objectStore("media_operations").get(operationId));
    if (!operation || operation.ownerId !== ownerId) {
      await transactionDone(transaction);
      return null;
    }
    const [card, asset] = await Promise.all([
      requestResult(transaction.objectStore("memory_cards").get(operation.cardId)),
      requestResult(transaction.objectStore("visual_assets").get(operation.assetId)),
    ]);
    const title = card?.privateTitleId
      ? await requestResult(transaction.objectStore("private_titles").get(card.privateTitleId))
      : null;
    const animeRef = card?.animeRefId
      ? await requestResult(transaction.objectStore("anime_refs").get(card.animeRefId))
      : null;
    const previousAsset = operation.previousAssetId
      ? await requestResult(transaction.objectStore("visual_assets").get(operation.previousAssetId))
      : null;
    await transactionDone(transaction);
    if (!card || !asset || card.ownerId !== ownerId || asset.ownerId !== ownerId) return null;
    if (operation.kind === "REPLACE" && (
      !previousAsset || previousAsset.ownerId !== ownerId
    )) return null;
    return clone({ operation, card, asset, previousAsset, title, animeRef });
  }

  async beginOperationAttempt(operation, now) {
    const current = await this.getOperation(operation.ownerId, operation.id);
    if (!current || current.state === "COMPLETED") return;
    const transaction = this.database.transaction("media_operations", "readwrite");
    transaction.objectStore("media_operations").put({
      ...current,
      attemptCount: Number(current.attemptCount || 0) + 1,
      lastErrorCode: null,
      updatedAt: String(now),
    });
    await transactionDone(transaction);
  }
}
