import assert from "node:assert/strict";
import test from "node:test";

import { addAnimeFromQuickAction } from "../../src/domain/search/quickActionActions.js";

test("quick add resolves only after the durable Library write finishes", async () => {
  let releaseWrite;
  let writtenList = null;
  let settled = false;
  const writeGate = new Promise((resolve) => {
    releaseWrite = resolve;
  });

  const pending = addAnimeFromQuickAction(
    {
      id: 1,
      title: { english: "Cowboy Bebop", romaji: "Cowboy Bebop", native: "カウボーイビバップ" },
      synonyms: [],
    },
    "미분류",
    {
      readLibraryListPreferred: async () => [],
      writeLibraryListDurable: async (list) => {
        writtenList = list;
        await writeGate;
        return list;
      },
    },
  ).then((result) => {
    settled = true;
    return result;
  });

  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(settled, false);
  assert.equal(writtenList?.length, 1);
  assert.equal(writtenList?.[0]?.anilistId, 1);

  releaseWrite();
  const result = await pending;
  assert.equal(settled, true);
  assert.equal(result.item.anilistId, 1);
});
