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

  async reserveCreate({ title, card, asset, operation }) {
    await requireOwner(this.database, operation.ownerId);
    const existing = await this.getOperation(operation.ownerId, operation.id);
    if (existing) {
      throw Object.assign(new Error("Operation already exists"), { code: "OPERATION_EXISTS" });
    }

    const transaction = this.database.transaction(
      ["private_titles", "memory_cards", "visual_assets", "media_operations"],
      "readwrite",
    );
    transaction.objectStore("private_titles").add(title);
    transaction.objectStore("memory_cards").add(card);
    transaction.objectStore("visual_assets").add(asset);
    transaction.objectStore("media_operations").add(operation);
    await transactionDone(transaction);
  }

  async completeCreate({ title, card, asset, operation }) {
    const existing = await this.getOperation(operation.ownerId, operation.id);
    if (!existing || existing.cardId !== card.id || existing.assetId !== asset.id) {
      throw Object.assign(new Error("Create reservation does not match completion"), {
        code: "OPERATION_RESERVATION_MISMATCH",
      });
    }
    if ([title.ownerId, card.ownerId, asset.ownerId].some((ownerId) => ownerId !== operation.ownerId)) {
      throw Object.assign(new Error("Cross-owner completion rejected"), { code: "CROSS_OWNER_REFERENCE" });
    }

    const transaction = this.database.transaction(
      ["private_titles", "memory_cards", "visual_assets", "media_operations"],
      "readwrite",
    );
    transaction.objectStore("private_titles").put(title);
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

  async updateCardMetadata({ ownerId, card }) {
    const existing = await this.getCardBundle(ownerId, card.id);
    if (!existing || card.ownerId !== ownerId || card.status !== "COMPLETE_PRIVATE") {
      throw Object.assign(new Error("Private Card was not found"), { code: "CARD_NOT_FOUND" });
    }
    const transaction = this.database.transaction("memory_cards", "readwrite");
    transaction.objectStore("memory_cards").put(card);
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
        ["IMPORT", "DELETE"].includes(operation.kind)
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
    await transactionDone(transaction);
    if (!card || !asset || card.ownerId !== ownerId || asset.ownerId !== ownerId) return null;
    return clone({ operation, card, asset, title, animeRef });
  }

  async beginOperationAttempt(operation, now) {
    const current = await this.getOperation(operation.ownerId, operation.id);
    if (!current || current.state === "COMPLETED") return;
    const transaction = this.database.transaction("media_operations", "readwrite");
    transaction.objectStore("media_operations").put({
      ...current,
      state: "PLANNED",
      attemptCount: Number(current.attemptCount || 0) + 1,
      lastErrorCode: null,
      updatedAt: String(now),
    });
    await transactionDone(transaction);
  }
}
