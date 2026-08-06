import React, { Suspense, startTransition, useEffect, useLayoutEffect, useState } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { useCommittedSyncOperationCoordinator } from "../../src/hooks/useSyncOperationCoordinator.js";

function deferred() {
  let resolve;
  const promise = new Promise((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

async function waitFor(predicate, message) {
  const deadline = performance.now() + 2_000;
  while (!predicate()) {
    if (performance.now() > deadline) throw new Error(message);
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

function createMountedScenario({ suspendB = false } = {}) {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const gate = deferred();
  const syncing = { value: false };
  const state = {
    coordinator: null,
    committedUserId: null,
    passiveUserId: null,
    bRenderAttempts: 0,
    setUserId: null,
  };

  function Probe({ userId }) {
    const coordinator = useCommittedSyncOperationCoordinator(userId);

    useLayoutEffect(() => {
      state.coordinator = coordinator;
      state.committedUserId = userId;
    }, [coordinator, userId]);

    useEffect(() => {
      state.passiveUserId = userId;
      syncing.value = false;
    }, [userId]);

    if (suspendB && userId === "account-b") {
      state.bRenderAttempts += 1;
      throw gate.promise;
    }

    return React.createElement("span", { "data-user-id": userId }, userId);
  }

  function App() {
    const [userId, setUserId] = useState("account-a");
    state.setUserId = setUserId;
    return React.createElement(
      Suspense,
      { fallback: React.createElement("span", null, "suspended") },
      React.createElement(Probe, { userId }),
    );
  }

  flushSync(() => root.render(React.createElement(App)));

  return {
    gate,
    host,
    root,
    state,
    syncing,
    async ready() {
      await waitFor(
        () => state.committedUserId === "account-a" && state.passiveUserId === "account-a",
        "initial account A did not commit",
      );
    },
  };
}

export async function runUseSyncCoordinatorConcurrentScenarios() {
  const suspended = createMountedScenario({ suspendB: true });
  await suspended.ready();
  const suspendedAToken = suspended.state.coordinator.begin("account-a", "syncNow");
  suspended.syncing.value = true;

  startTransition(() => suspended.state.setUserId("account-b"));
  await waitFor(() => suspended.state.bRenderAttempts > 0, "account B never rendered");

  const aStayedCurrentDuringSuspendedB = suspended.state.coordinator.isCurrent(suspendedAToken);
  let aFinishedAfterAbortedB = false;
  if (suspended.state.coordinator.isCurrent(suspendedAToken)) {
    aFinishedAfterAbortedB = true;
    suspended.syncing.value = false;
  }
  const suspendedBWasNotCommitted = suspended.state.committedUserId === "account-a";
  flushSync(() => suspended.state.setUserId("account-a"));
  suspended.root.unmount();
  suspended.host.remove();

  const committed = createMountedScenario();
  await committed.ready();
  const committedAToken = committed.state.coordinator.begin("account-a", "syncNow");
  committed.syncing.value = true;
  const releaseA = deferred();
  let staleADestructiveFollowups = 0;
  let staleACompletions = 0;
  const deferredAOperation = (async () => {
    await releaseA.promise;
    if (!committed.state.coordinator.isCurrent(committedAToken)) return;
    staleADestructiveFollowups += 1;
    staleACompletions += 1;
  })().finally(() => {
    if (committed.state.coordinator.isCurrent(committedAToken)) {
      committed.syncing.value = false;
    }
  });

  flushSync(() => committed.state.setUserId("account-b"));
  const committedBInvalidatedA = !committed.state.coordinator.isCurrent(committedAToken);
  const bToken = committed.state.coordinator.begin("account-b", "syncNow");
  let bMutations = 0;
  const bResult = await committed.state.coordinator.runMutation(bToken, () => {
    bMutations += 1;
    return "saved-b";
  });

  releaseA.resolve();
  await deferredAOperation;
  await waitFor(() => committed.state.passiveUserId === "account-b", "account B passive reset did not run");

  const result = {
    suspendedBRendered: suspended.state.bRenderAttempts > 0,
    suspendedBWasNotCommitted,
    aStayedCurrentDuringSuspendedB,
    aFinishedAfterAbortedB,
    committedBInvalidatedA,
    staleADestructiveFollowups,
    staleACompletions,
    bOperationExecuted: bResult.executed,
    bOperationValue: bResult.value,
    bMutations,
    syncingAfterStaleA: committed.syncing.value,
  };

  committed.root.unmount();
  committed.host.remove();
  return result;
}
