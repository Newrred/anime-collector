import { expect, test } from "@playwright/test";

test("sync coordinator changes accounts only after a committed React render", async ({ page }) => {
  await page.goto("/");

  const result = await page.evaluate(async () => {
    const harness = await import("/tests/fixtures/useSyncCoordinatorConcurrentHarness.jsx");
    return harness.runUseSyncCoordinatorConcurrentScenarios();
  });

  expect(result).toEqual({
    suspendedBRendered: true,
    suspendedBWasNotCommitted: true,
    aStayedCurrentDuringSuspendedB: true,
    aFinishedAfterAbortedB: true,
    committedBInvalidatedA: true,
    staleADestructiveFollowups: 0,
    staleACompletions: 0,
    bOperationExecuted: true,
    bOperationValue: "saved-b",
    bMutations: 1,
    syncingAfterStaleA: false,
  });
});
