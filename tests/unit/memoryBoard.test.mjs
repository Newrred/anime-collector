import assert from "node:assert/strict";
import test from "node:test";

import {
  createBoardCard,
  createMemoryBoard,
  positionBetween,
} from "../../src/features/memory/domain/memoryBoard.js";

const OWNER_ID = "guest:11111111-1111-4111-8111-111111111111";
const OTHER_OWNER_ID = "guest:22222222-2222-4222-8222-222222222222";
const BOARD_ID = "33333333-3333-4333-8333-333333333333";
const CARD_ID = "44444444-4444-4444-8444-444444444444";
const NOW = "2026-09-02T00:00:00.000Z";

test("private board normalizes bounded editable fields", () => {
  const board = createMemoryBoard({
    id: BOARD_ID,
    ownerId: OWNER_ID,
    title: "  Scenes I remember  ",
    description: "  A private collection.  ",
    now: NOW,
  });
  assert.equal(board.visibility, "PRIVATE");
  assert.equal(board.title, "Scenes I remember");
  assert.equal(board.description, "A private collection.");
  assert.equal(board.deletedAt, null);
  assert.equal(board.sync.syncState, "LOCAL_ONLY");
});

test("board rejects empty or overlong text", () => {
  assert.throws(() => createMemoryBoard({
    id: BOARD_ID,
    ownerId: OWNER_ID,
    title: " ",
    description: "",
    now: NOW,
  }), { code: "BOARD_TITLE_REQUIRED" });
  assert.throws(() => createMemoryBoard({
    id: BOARD_ID,
    ownerId: OWNER_ID,
    title: "x".repeat(81),
    description: "",
    now: NOW,
  }), { code: "BOARD_TITLE_TOO_LONG" });
  assert.throws(() => createMemoryBoard({
    id: BOARD_ID,
    ownerId: OWNER_ID,
    title: "Valid",
    description: "x".repeat(501),
    now: NOW,
  }), { code: "BOARD_DESCRIPTION_TOO_LONG" });
});

test("position keys remain lexicographically ordered and bounded", () => {
  const first = positionBetween(null, null);
  const before = positionBetween(null, first);
  const after = positionBetween(first, null);
  const middle = positionBetween(first, after);
  assert.ok(before < first);
  assert.ok(first < middle && middle < after);
  assert.ok([before, first, middle, after].every((value) => value.length <= 128));
});

test("board membership is private, owner-scoped, and independently tombstoned", () => {
  const membership = createBoardCard({
    id: "55555555-5555-4555-8555-555555555555",
    ownerId: OWNER_ID,
    boardId: BOARD_ID,
    cardId: CARD_ID,
    positionKey: positionBetween(null, null),
    now: NOW,
  });
  assert.equal(membership.ownerId, OWNER_ID);
  assert.equal(membership.boardId, BOARD_ID);
  assert.equal(membership.cardId, CARD_ID);
  assert.equal(membership.deletedAt, null);
  assert.throws(() => createBoardCard({
    ...membership,
    ownerId: OTHER_OWNER_ID,
    boardOwnerId: OWNER_ID,
    now: NOW,
  }), { code: "CROSS_OWNER_REFERENCE" });
});
