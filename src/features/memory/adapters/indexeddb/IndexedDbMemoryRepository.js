import { createGuestOwner } from "../../domain/memoryDomain.js";
import { openMemoryDatabase } from "./memoryDb.js";

const GUEST_OWNER_META_KEY = "installationGuestOwnerId";

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

const requireOwner = async (database, ownerId) => {
  const transaction = database.transaction("owners", "readonly");
  const owner = await requestResult(transaction.objectStore("owners").get(ownerId));
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
    const read = this.database.transaction(["meta", "owners"], "readonly");
    const existingMeta = await requestResult(read.objectStore("meta").get(GUEST_OWNER_META_KEY));
    const existingOwner = existingMeta
      ? await requestResult(read.objectStore("owners").get(existingMeta.value))
      : null;
    await transactionDone(read);
    if (existingOwner) return clone(existingOwner);

    const owner = createGuestOwner({ uuid, now });
    const write = this.database.transaction(["meta", "owners"], "readwrite");
    write.objectStore("owners").put(owner);
    write.objectStore("meta").put({ key: GUEST_OWNER_META_KEY, value: owner.id, updatedAt: String(now) });
    await transactionDone(write);
    return clone(owner);
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
    if (title) transaction.objectStore(titleStore).add(title);
    else transaction.objectStore(titleStore).put(animeRef);
    transaction.objectStore("memory_cards").add(card);
    transaction.objectStore("visual_assets").add(asset);
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
    transaction.objectStore(titleStore).put(title || animeRef);
    transaction.objectStore("memory_cards").put(card);
    transaction.objectStore("visual_assets").put(asset);
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
      ["memory_cards", "visual_assets", "media_operations"],
      "readwrite",
    );
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
