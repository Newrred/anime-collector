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

test("draft normalizes editable fields", () => {
  const draft = createNewQuickLogDraft({
    anilistId: "1",
    eventType: "시작",
    watchedAtPrecision: "month",
    watchedAtValue: "2026-08",
    cue: "x".repeat(130),
    note: "Saved for later",
  });
  assert.equal(draft.anilistId, 1);
  assert.equal(draft.watchedAtPrecision, "month");
  assert.equal(draft.watchedAtValue, "2026-08");
  assert.equal(draft.cue.length, 120);
  assert.equal(draft.note, "Saved for later");
});

test("malformed edit id is not mistaken for a new draft", () => {
  const draft = createEditQuickLogDraft({ anilistId: 1 });
  assert.equal(draft.mode, "edit");
  assert.equal(draft.logId, "");
  assert.equal(isNewQuickLogDraft(draft), false);
});
