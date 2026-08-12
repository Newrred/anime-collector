import test from "node:test";
import assert from "node:assert/strict";

import {
  TICKET_CLEANUP_STORAGE_KEY,
  createDeferredTicketCleanup,
} from "../../src/features/memory/runtime/deferredTicketCleanup.js";

const memoryStorage = () => {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
};

test("failed ticket cleanup remains durable until a later confirmed discard", async () => {
  const storage = memoryStorage();
  const cleanup = createDeferredTicketCleanup({ storage });

  assert.equal(cleanup.defer("ticket-late"), true);
  assert.equal(cleanup.defer("file:///private/path"), false);
  assert.equal(storage.getItem(TICKET_CLEANUP_STORAGE_KEY), '["ticket-late"]');

  assert.deepEqual(await cleanup.flush(async () => false), { removed: 0, pending: 1 });
  assert.equal(storage.getItem(TICKET_CLEANUP_STORAGE_KEY), '["ticket-late"]');

  assert.deepEqual(await cleanup.flush(async () => true), { removed: 1, pending: 0 });
  assert.equal(storage.getItem(TICKET_CLEANUP_STORAGE_KEY), null);
});
