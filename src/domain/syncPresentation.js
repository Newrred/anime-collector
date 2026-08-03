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
