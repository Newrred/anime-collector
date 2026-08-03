import test from "node:test";
import assert from "node:assert/strict";
import { deriveOnboardingState } from "../../src/domain/onboardingState.js";

test("zero titles asks for the first title", () => {
  assert.deepEqual(deriveOnboardingState({ itemCount: 0, logCount: 0 }), {
    stage: "add-first-title",
    primaryAction: "add-title",
  });
});

test("one or two titles asks for the first memory", () => {
  assert.equal(deriveOnboardingState({ itemCount: 2, logCount: 0 }).stage, "write-first-log");
});

test("three titles and one log unlocks the normal home", () => {
  assert.equal(deriveOnboardingState({ itemCount: 3, logCount: 1 }).stage, "active");
});
