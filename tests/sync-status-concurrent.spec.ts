import { expect, test } from "@playwright/test";

const harnessUrl = "/tests/fixtures/useSyncCoordinatorConcurrentHarness.jsx";

async function prewarmHarnessModule(request) {
  for (const suffix of ["", "?prewarm=ready"]) {
    const response = await request.get(`${harnessUrl}${suffix}`);
    expect(response.ok()).toBe(true);
    expect(await response.text()).toContain("runUseSyncCoordinatorConcurrentScenarios");
  }
}

async function prewarmHarnessDependencies(page) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await page.goto("/");
    try {
      const loaded = await page.evaluate(async ({ url, attemptIndex }) => {
        const harness = await import(`${url}?browser-prewarm=${attemptIndex}`);
        return typeof harness.runUseSyncCoordinatorConcurrentScenarios === "function";
      }, { url: harnessUrl, attemptIndex: attempt });
      expect(loaded).toBe(true);
      return;
    } catch (error) {
      if (attempt === 2) throw error;
    }
  }
}

test("sync coordinator changes accounts only after a committed React render", async ({ page, request }) => {
  await prewarmHarnessModule(request);
  await prewarmHarnessDependencies(page);
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
