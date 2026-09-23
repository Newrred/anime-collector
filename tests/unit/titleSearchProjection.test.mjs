import test from "node:test";
import assert from "node:assert/strict";
import { buildMemorySearchRows, withTitlePresence, searchMemoryOnlyRows } from "../../src/features/titles/application/titleSearchProjection.js";

test("search counts complete Memories independently of title saving and excludes drafts/deleted cards", () => {
  const bundle = (id, status = "COMPLETE_PRIVATE", deletedAt = null) => ({
    card: { id, status, deletedAt, updatedAt: "2026-09-07T00:00:00Z" },
    title: { displayTitle: "Frieren", sourceBinding: { provider: "ANILIST", externalId: "154587" } },
    asset: { imageType: "SYSTEM_DESIGN" },
  });
  const rows = buildMemorySearchRows([bundle("a"), bundle("b"), bundle("draft", "DRAFT"), bundle("deleted", "COMPLETE_PRIVATE", "2026-09-07")]);
  assert.equal(rows[0].memoryCount, 2);
  assert.equal(withTitlePresence([{ id: 154587 }], rows, new Set())[0].isSaved, false);
  assert.equal(withTitlePresence([{ id: 154587 }], rows, new Set([154587]))[0].memoryCount, 2);
  assert.equal(searchMemoryOnlyRows(rows, new Set(), "FRI EREN").length, 1);
  assert.equal(searchMemoryOnlyRows(rows, new Set([154587]), "Frieren").length, 0);
  assert.equal(withTitlePresence([{ id: 1 }], null, new Set())[0].memoryCount, null);
});
