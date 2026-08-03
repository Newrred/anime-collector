import test from "node:test";
import assert from "node:assert/strict";
import { loadAuthoritativeWatchLogSnapshot } from "../../src/services/watchLogSource.js";

test("an IDB-only legacy snapshot promotes every watch log before scoped reads", async () => {
  const idbSnapshot = [
    { id: "log-a", anilistId: 1 },
    { id: "log-b", anilistId: 2 },
  ];
  const writes = [];

  const rows = await loadAuthoritativeWatchLogSnapshot({
    hasLocalSnapshot: () => false,
    readLocalSnapshot: () => [],
    readAllIdbSnapshot: async () => idbSnapshot,
    writeLocalSnapshot: (next) => writes.push(next),
  });

  assert.deepEqual(rows, idbSnapshot);
  assert.deepEqual(writes, [idbSnapshot]);
});

test("an existing local watch-log snapshot never falls back to a stale IDB mirror", async () => {
  const localSnapshot = [{ id: "local", anilistId: 1 }];
  let idbReads = 0;

  const rows = await loadAuthoritativeWatchLogSnapshot({
    hasLocalSnapshot: () => true,
    readLocalSnapshot: () => localSnapshot,
    readAllIdbSnapshot: async () => {
      idbReads += 1;
      return [{ id: "stale", anilistId: 1 }];
    },
    writeLocalSnapshot: () => assert.fail("the IDB mirror must not replace local data"),
  });

  assert.deepEqual(rows, localSnapshot);
  assert.equal(idbReads, 0);
});
