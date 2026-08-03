import test from "node:test";
import assert from "node:assert/strict";
import { createSyncOperationCoordinator } from "../../src/services/syncOperationCoordinator.js";

function deferred() {
  let resolve;
  const promise = new Promise((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

for (const operationName of ["refreshStatus", "syncNow", "keepLocalVersion", "useCloudVersion"]) {
  test(`a delayed ${operationName} for account A performs zero mutations after switching to B`, async () => {
    const coordinator = createSyncOperationCoordinator("account-a");
    const token = coordinator.begin("account-a", operationName);
    const prepared = deferred();
    const mutations = [];

    const operation = (async () => {
      const value = await prepared.promise;
      return coordinator.runMutation(token, () => {
        mutations.push(value);
        return value;
      });
    })();

    coordinator.updateUserId("account-b");
    prepared.resolve("remote-a");

    assert.deepEqual(await operation, { executed: false, stale: true, value: null });
    assert.deepEqual(mutations, []);
  });
}

test("the current account operation may execute its mutation once", async () => {
  const coordinator = createSyncOperationCoordinator("account-a");
  const token = coordinator.begin("account-a");
  let mutations = 0;

  const result = await coordinator.runMutation(token, () => {
    mutations += 1;
    return "saved";
  });

  assert.deepEqual(result, { executed: true, stale: false, value: "saved" });
  assert.equal(mutations, 1);
});
