export function deriveSyncPresentation(input = {}) {
  if (!input.configured) {
    return {
      tone: "disabled",
      accountState: "local-only",
      remoteState: "unavailable",
      showSyncActions: false,
    };
  }

  if (!input.connected) {
    return {
      tone: "idle",
      accountState: "signed-out",
      remoteState: "not-checked",
      showSyncActions: false,
    };
  }

  if (input.status === "error" && !input.remoteChecked) {
    return {
      tone: "error",
      accountState: "connected",
      remoteState: "not-checked",
      showSyncActions: false,
    };
  }

  if (input.loading || !input.remoteChecked) {
    return {
      tone: "idle",
      accountState: "connected",
      remoteState: "checking",
      showSyncActions: false,
    };
  }

  return {
    tone: input.status || "connected",
    accountState: "connected",
    remoteState: input.remoteMissing ? "empty" : "available",
    showSyncActions: true,
  };
}

export function hasSuccessfulRemoteCheck(input = {}) {
  return Boolean(
    input.configured &&
    input.connected &&
    input.currentUserId &&
    input.currentUserId === input.successfulUserId
  );
}

export function shouldShowAuthSheetSyncAction(input = {}) {
  return Boolean(input.configured && input.connected && input.showSyncActions);
}

export function shouldAcceptSyncStatusRequest(input = {}) {
  return Boolean(
    input.requestId === input.latestRequestId &&
    input.capturedUserId === input.currentUserId
  );
}
