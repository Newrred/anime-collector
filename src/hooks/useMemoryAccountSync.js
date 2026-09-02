import { useCallback, useEffect, useState } from "react";

import { getPlatformMemoryAccountRuntime } from "../features/memory/runtime/platformMemoryAccountRuntime.js";

const INITIAL_STATE = Object.freeze({
  enabled: false,
  status: "LOADING",
  guestCardCount: 0,
  errorCode: null,
});

export function useMemoryAccountSync({ session, authLoading = false } = {}) {
  const [state, setState] = useState(INITIAL_STATE);
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    let alive = true;
    setState((current) => ({ ...current, status: "LOADING", errorCode: null }));
    if (authLoading) {
      return () => {
        alive = false;
      };
    }
    getPlatformMemoryAccountRuntime()
      .then(async (runtime) => {
        if (!runtime.enabled) return runtime.getState();
        if (session?.user?.id) return runtime.initializeAccountSession(session);
        await runtime.handleSignedOut();
        return runtime.getState();
      })
      .then((next) => {
        if (!alive) return;
        setState(next || { enabled: false, status: "LOCAL_ONLY", guestCardCount: 0, errorCode: null });
      })
      .catch((error) => {
        if (!alive) return;
        setState((current) => ({
          ...current,
          enabled: true,
          status: "INITIALIZATION_FAILED",
          errorCode: error?.code === "ACCOUNT_INITIALIZATION_FAILED"
            ? "ACCOUNT_INITIALIZATION_FAILED"
            : "ACCOUNT_RUNTIME_FAILED",
        }));
      });
    return () => {
      alive = false;
    };
  }, [authLoading, session?.user?.id, retryToken]);

  const retry = useCallback(() => setRetryToken((value) => value + 1), []);

  return Object.freeze({
    ...state,
    loading: state.status === "LOADING" || state.status === "INITIALIZING",
    retry,
    buildPromotionPreview: async () => null,
    promote: async () => null,
    syncNow: async () => null,
  });
}
