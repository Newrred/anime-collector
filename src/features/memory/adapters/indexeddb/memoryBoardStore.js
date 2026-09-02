import { createDefaultSyncEnvelope, requireOwnerId } from "../../domain/memoryDomain.js";
import { createBoardCard, createMemoryBoard } from "../../domain/memoryBoard.js";

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

const touchSync = (entity, now) => ({
  ...(entity.sync || createDefaultSyncEnvelope(now)),
  syncState: "LOCAL_ONLY",
  clientUpdatedAt: String(now),
});

export async function createBoard(database, board) {
  const normalized = createMemoryBoard({
    id: board.id,
    ownerId: board.ownerId,
    title: board.title,
    description: board.description,
    now: board.createdAt,
  });
  const ownerId = normalized.ownerId;
  const transaction = database.transaction(["owners", "memory_boards"], "readwrite");
  const owners = transaction.objectStore("owners");
  const boards = transaction.objectStore("memory_boards");
  const [owner, existing] = await Promise.all([
    requestResult(owners.get(ownerId)),
    requestResult(boards.get(normalized.id)),
  ]);
  if (!owner) fail("OWNER_NOT_FOUND", "Board owner does not exist", transaction);
  if (existing) fail("BOARD_EXISTS", "Board already exists", transaction);
  boards.add(normalized);
  await transactionDone(transaction);
  return clone(normalized);
}

export async function updateBoard(database, { ownerId, boardId, changes, now }) {
  const validOwnerId = requireOwnerId(ownerId);
  const transaction = database.transaction("memory_boards", "readwrite");
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
    sync: touchSync(current, now),
  };
  boards.put(updated);
  await transactionDone(transaction);
  return clone(updated);
}

export async function deleteBoard(database, { ownerId, boardId, now }) {
  const validOwnerId = requireOwnerId(ownerId);
  const transaction = database.transaction(["memory_boards", "memory_board_cards"], "readwrite");
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
  boards.put({ ...board, deletedAt: timestamp, updatedAt: timestamp, sync: touchSync(board, timestamp) });
  for (const row of rows.filter((item) => (
    item.ownerId === validOwnerId && item.boardId === boardId && !item.deletedAt
  ))) {
    memberships.put({ ...row, deletedAt: timestamp, updatedAt: timestamp, sync: touchSync(row, timestamp) });
  }
  await transactionDone(transaction);
}

export async function addCardToBoard(database, membership) {
  const ownerId = requireOwnerId(membership.ownerId);
  const transaction = database.transaction(
    ["memory_boards", "memory_cards", "memory_board_cards"],
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
  memberships.put(stored);
  await transactionDone(transaction);
  return clone(stored);
}

export async function removeCardFromBoard(database, { ownerId, boardId, cardId, now }) {
  const validOwnerId = requireOwnerId(ownerId);
  const transaction = database.transaction("memory_board_cards", "readwrite");
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
    sync: touchSync(membership, timestamp),
  };
  memberships.put(removed);
  await transactionDone(transaction);
  return clone(removed);
}

export async function reorderBoardCard(database, { ownerId, boardId, cardId, positionKey, now }) {
  const validOwnerId = requireOwnerId(ownerId);
  const transaction = database.transaction("memory_board_cards", "readwrite");
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
    sync: touchSync(membership, now),
  };
  memberships.put(updated);
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
