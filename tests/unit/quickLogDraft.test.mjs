import test from "node:test";
import assert from "node:assert/strict";
import {
  createNewQuickLogDraft,
  createEditQuickLogDraft,
  isNewQuickLogDraft,
} from "../../src/domain/quickLogDraft.js";

test("new draft has no persisted log id", () => {
  const draft = createNewQuickLogDraft({ anilistId: 1, eventType: "시작", watchedAtValue: "2026-08-03" });
  assert.equal(draft.mode, "create");
  assert.equal(draft.logId, null);
  assert.equal(isNewQuickLogDraft(draft), true);
});

test("edit draft preserves the stored id", () => {
  const draft = createEditQuickLogDraft({ id: "log-1", anilistId: 1, eventType: "완료" });
  assert.equal(draft.mode, "edit");
  assert.equal(draft.logId, "log-1");
});
