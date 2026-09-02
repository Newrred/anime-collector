import { createDefaultSyncEnvelope, requireOwnerId } from "../../domain/memoryDomain.js";
import { createBoardCard, createMemoryBoard } from "../../domain/memoryBoard.js";
import { appendSyncOperationsToTransaction } from "./memorySyncStore.js";

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
const fail = (code, message, transaction = null) => {
  if (transaction) transaction.abort();
  throw Object.assign(new Error(message), { code });
};

const touchSync = (entity, now, syncOperations = []) => ({
  ...(entity.sync || createDefaultSyncEnvelope(now)),
  syncState: syncOperations.some((operation) => operation.entityId === entity.id) ? "PENDING" : "LOCAL_ONLY",
  clientUpdatedAt: String(now),
  ...(syncOperations.some((operation) => operation.entityId === entity.id)
    ? { lastOperationId: syncOperations.filter((operation) => operation.entityId === entity.id).at(-1).id }
    : {}),
});

export async function createBoard(database, board, syncOperations = []) {
  const normalized = createMemoryBoard({
    id: board.id,
    ownerId: board.ownerId,
    title: board.title,
    description: board.description,
    now: board.createdAt,
  });
  const ownerId = normalized.ownerId;
  const transaction = database.transaction(["owners", "memory_boards", ...(syncOperations.length ? ["sync_outbox"] : [])], "readwrite");
  const owners = transaction.objectStore("owners");
  const boards = transaction.objectStore("memory_boards");
  const [owner, existing] = await Promise.all([
    requestResult(owners.get(ownerId)),
    requestResult(boards.get(normalized.id)),
  ]);
  if (!owner) fail("OWNER_NOT_FOUND", "Board owner does not exist", transaction);
  if (existing) fail("BOARD_EXISTS", "Board already exists", transaction);
  const stored = { ...normalized, sync: touchSync(normalized, normalized.updatedAt, syncOperations) };
  boards.add(stored);
  appendSyncOperationsToTransaction(transaction, syncOperations);
  await transactionDone(transaction);
  return clone(stored);
}

export async function updateBoard(database, { ownerId, boardId, changes, now, syncOperations = [] }) {
  const validOwnerId = requireOwnerId(ownerId);
  const transaction = database.transaction(["memory_boards", ...(syncOperations.length ? ["sync_outbox"] : [])], "readwrite");
  const boards = transaction.objectStore("memory_boards");
  const current = await requestResult(boards.get(boardId));
  if (!current || current.ownerId !== validOwnerId || current.deletedAt) {
    fail("BOARD_NOT_FOUND", "Private Board was not found", transaction);
  }
  const validated = createMemoryBoard({
    id: current.id,
    ownerId: current.ownerId,
    title: Object.hasOwn(changes || {}, "title") ? changes.title : current.title,
    description: Object.hasOwn(changes || {}, "description") ? changes.description : current.description,
    now: current.createdAt,
  });
  const updated = {
    ...current,
    title: validated.title,
    description: validated.description,
    visibility: "PRIVATE",
    updatedAt: String(now),
    sync: touchSync(current, now, syncOperations),
  };
  boards.put(updated);
  appendSyncOperationsToTransaction(transaction, syncOperations);
  await transactionDone(transaction);
  return clone(updated);
}

export async function deleteBoard(database, { ownerId, boardId, now, syncOperations = [] }) {
  const validOwnerId = requireOwnerId(ownerId);
  const transaction = database.transaction(["memory_boards", "memory_board_cards", ...(syncOperations.length ? ["sync_outbox"] : [])], "readwrite");
  const boards = transaction.objectStore("memory_boards");
  const memberships = transaction.objectStore("memory_board_cards");
  const [board, rows] = await Promise.all([
    requestResult(boards.get(boardId)),
    requestResult(memberships.getAll()),
  ]);
  if (!board || board.ownerId !== validOwnerId || board.deletedAt) {
    fail("BOARD_NOT_FOUND", "Private Board was not found", transaction);
  }
  const timestamp = String(now);
  boards.put({ ...board, deletedAt: timestamp, updatedAt: timestamp, sync: touchSync(board, timestamp, syncOperations) });
  for (const row of rows.filter((item) => (
    item.ownerId === validOwnerId && item.boardId === boardId && !item.deletedAt
  ))) {
    memberships.put({ ...row, deletedAt: timestamp, updatedAt: timestamp, sync: touchSync(row, timestamp, syncOperations) });
  }
  appendSyncOperationsToTransaction(transaction, syncOperations);
  await transactionDone(transaction);
}

export async function addCardToBoard(database, membership, syncOperations = []) {
  const ownerId = requireOwnerId(membership.ownerId);
  const transaction = database.transaction(
    ["memory_boards", "memory_cards", "memory_board_cards", ...(syncOperations.length ? ["sync_outbox"] : [])],
    "readwrite",
  );
  const boards = transaction.objectStore("memory_boards");
  const cards = transaction.objectStore("memory_cards");
  const memberships = transaction.objectStore("memory_board_cards");
  const [board, card, rows] = await Promise.all([
    requestResult(boards.get(membership.boardId)),
    requestResult(cards.get(membership.cardId)),
    requestResult(memberships.getAll()),
  ]);
  if (!board || board.ownerId !== ownerId || board.deletedAt) {
    fail("BOARD_NOT_FOUND", "Private Board was not found", transaction);
  }
  if (!card || card.ownerId !== ownerId || card.status !== "COMPLETE_PRIVATE" || card.deletedAt) {
    fail(card && card.ownerId !== ownerId ? "CROSS_OWNER_REFERENCE" : "CARD_NOT_FOUND", "Card cannot be added", transaction);
  }
  const normalized = createBoardCard({
    ...membership,
    boardOwnerId: board.ownerId,
    cardOwnerId: card.ownerId,
    now: membership.createdAt,
  });
  const duplicate = rows.find((row) => row.boardId === board.id && row.cardId === card.id && !row.deletedAt);
  if (duplicate) fail("BOARD_CARD_EXISTS", "Card is already in this Board", transaction);
  const tombstone = rows.find((row) => row.boardId === board.id && row.cardId === card.id && row.deletedAt);
  const stored = tombstone
    ? { ...normalized, id: tombstone.id, createdAt: tombstone.createdAt }
    : normalized;
  const pending = { ...stored, sync: touchSync(stored, stored.updatedAt, syncOperations) };
  memberships.put(pending);
  appendSyncOperationsToTransaction(transaction, syncOperations);
  await transactionDone(transaction);
  return clone(pending);
}

export async function removeCardFromBoard(database, { ownerId, boardId, cardId, now, syncOperations = [] }) {
  const validOwnerId = requireOwnerId(ownerId);
  const transaction = database.transaction(["memory_board_cards", ...(syncOperations.length ? ["sync_outbox"] : [])], "readwrite");
  const memberships = transaction.objectStore("memory_board_cards");
  const rows = await requestResult(memberships.getAll());
  const membership = rows.find((row) => (
    row.ownerId === validOwnerId && row.boardId === boardId && row.cardId === cardId && !row.deletedAt
  ));
  if (!membership) fail("BOARD_CARD_NOT_FOUND", "Board membership was not found", transaction);
  const timestamp = String(now);
  const removed = {
    ...membership,
    deletedAt: timestamp,
    updatedAt: timestamp,
    sync: touchSync(membership, timestamp, syncOperations),
  };
  memberships.put(removed);
  appendSyncOperationsToTransaction(transaction, syncOperations);
  await transactionDone(transaction);
  return clone(removed);
}

export async function reorderBoardCard(database, { ownerId, boardId, cardId, positionKey, now, syncOperations = [] }) {
  const validOwnerId = requireOwnerId(ownerId);
  const transaction = database.transaction(["memory_board_cards", ...(syncOperations.length ? ["sync_outbox"] : [])], "readwrite");
  const memberships = transaction.objectStore("memory_board_cards");
  const rows = await requestResult(memberships.getAll());
  const membership = rows.find((row) => (
    row.ownerId === validOwnerId && row.boardId === boardId && row.cardId === cardId && !row.deletedAt
  ));
  if (!membership) fail("BOARD_CARD_NOT_FOUND", "Board membership was not found", transaction);
  const validated = createBoardCard({
    ...membership,
    positionKey,
    now: membership.createdAt,
  });
  const updated = {
    ...membership,
    positionKey: validated.positionKey,
    updatedAt: String(now),
    sync: touchSync(membership, now, syncOperations),
  };
  memberships.put(updated);
  appendSyncOperationsToTransaction(transaction, syncOperations);
  await transactionDone(transaction);
  return clone(updated);
}

export async function listBoards(database, ownerId) {
  const validOwnerId = requireOwnerId(ownerId);
  const transaction = database.transaction(["memory_boards", "memory_board_cards"], "readonly");
  const [boards, memberships] = await Promise.all([
    requestResult(transaction.objectStore("memory_boards").getAll()),
    requestResult(transaction.objectStore("memory_board_cards").getAll()),
  ]);
  await transactionDone(transaction);
  return clone(boards
    .filter((board) => board.ownerId === validOwnerId && !board.deletedAt)
    .map((board) => ({
      ...board,
      cardCount: memberships.filter((row) => (
        row.ownerId === validOwnerId && row.boardId === board.id && !row.deletedAt
      )).length,
    }))
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)));
}

export async function getBoard(database, ownerId, boardId) {
  const validOwnerId = requireOwnerId(ownerId);
  const transaction = database.transaction(["memory_boards", "memory_board_cards"], "readonly");
  const [board, memberships] = await Promise.all([
    requestResult(transaction.objectStore("memory_boards").get(boardId)),
    requestResult(transaction.objectStore("memory_board_cards").getAll()),
  ]);
  await transactionDone(transaction);
  if (!board || board.ownerId !== validOwnerId || board.deletedAt) return null;
  return clone({
    board,
    memberships: memberships
      .filter((row) => row.ownerId === validOwnerId && row.boardId === board.id && !row.deletedAt)
      .sort((left, right) => left.positionKey.localeCompare(right.positionKey)),
  });
}
