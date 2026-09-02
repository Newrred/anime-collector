import { createDefaultSyncEnvelope, requireOwnerId } from "./memoryDomain.js";

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const POSITION_ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";
const POSITION_WIDTH = 24;
const POSITION_BASE = 36n;
const POSITION_MAX = POSITION_BASE ** BigInt(POSITION_WIDTH) - 1n;

export class MemoryBoardError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "MemoryBoardError";
    this.code = code;
  }
}
const fail = (code, message) => {
  throw new MemoryBoardError(code, message);
};

const requireUuid = (value, field) => {
  const normalized = String(value || "").toLowerCase();
  if (!UUID_V4.test(normalized)) fail("BOARD_ID_INVALID", `${field} must be a version 4 UUID`);
  return normalized;
};

const decodePosition = (value) => {
  const text = String(value || "").toLowerCase();
  if (text.length !== POSITION_WIDTH || [...text].some((character) => !POSITION_ALPHABET.includes(character))) {
    fail("BOARD_POSITION_INVALID", "Board position key is invalid");
  }
  let result = 0n;
  for (const character of text) {
    result = result * POSITION_BASE + BigInt(POSITION_ALPHABET.indexOf(character));
  }
  return result;
};

const encodePosition = (value) => {
  let remaining = value;
  let output = "";
  for (let index = 0; index < POSITION_WIDTH; index += 1) {
    output = POSITION_ALPHABET[Number(remaining % POSITION_BASE)] + output;
    remaining /= POSITION_BASE;
  }
  return output;
};

export function positionBetween(left = null, right = null) {
  const lower = left == null ? 0n : decodePosition(left);
  const upper = right == null ? POSITION_MAX : decodePosition(right);
  if (lower >= upper) fail("BOARD_POSITION_INVALID", "Board positions must be ordered");
  const middle = (lower + upper) / 2n;
  if (middle <= lower || middle >= upper) {
    fail("BOARD_POSITION_EXHAUSTED", "No Board position remains between adjacent cards");
  }
  return encodePosition(middle);
}

export function createMemoryBoard({ id, ownerId, title, description = "", now }) {
  const normalizedTitle = String(title || "").trim();
  const normalizedDescription = String(description || "").trim();
  if (!normalizedTitle) fail("BOARD_TITLE_REQUIRED", "Board title is required");
  if (normalizedTitle.length > 80) fail("BOARD_TITLE_TOO_LONG", "Board title is too long");
  if (normalizedDescription.length > 500) {
    fail("BOARD_DESCRIPTION_TOO_LONG", "Board description is too long");
  }
  const timestamp = String(now);
  return Object.freeze({
    id: requireUuid(id, "Board id"),
    ownerId: requireOwnerId(ownerId),
    title: normalizedTitle,
    description: normalizedDescription,
    visibility: "PRIVATE",
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
    sync: createDefaultSyncEnvelope(timestamp),
  });
}

export function createBoardCard({
  id,
  ownerId,
  boardOwnerId = ownerId,
  cardOwnerId = ownerId,
  boardId,
  cardId,
  positionKey,
  now,
}) {
  const validOwnerId = requireOwnerId(ownerId);
  if (requireOwnerId(boardOwnerId) !== validOwnerId || requireOwnerId(cardOwnerId) !== validOwnerId) {
    fail("CROSS_OWNER_REFERENCE", "Board and Card must belong to the same owner");
  }
  const normalizedPosition = encodePosition(decodePosition(positionKey));
  const timestamp = String(now);
  return Object.freeze({
    id: requireUuid(id, "Board Card id"),
    ownerId: validOwnerId,
    boardId: requireUuid(boardId, "Board id"),
    cardId: requireUuid(cardId, "Card id"),
    positionKey: normalizedPosition,
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
    sync: createDefaultSyncEnvelope(timestamp),
  });
}
