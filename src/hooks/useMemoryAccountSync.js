import { useCallback, useEffect, useRef, useState } from "react";

import { getPlatformMemoryAccountRuntime } from "../features/memory/runtime/platformMemoryAccountRuntime.js";

const INITIAL_STATE = Object.freeze({
  enabled: false,
  status: "LOADING",
  guestCardCount: 0,
  errorCode: null,
  promotionPreview: null,
  promotionBusy: false,
  promotionErrorCode: null,
  syncBusy: false,
  syncResultCode: null,
  syncErrorCode: null,
  conflicts: [],
  conflictBusy: false,
});

export function useMemoryAccountSync({ session, authLoading = false } = {}) {
  const [state, setState] = useState(INITIAL_STATE);
  const [retryToken, setRetryToken] = useState(0);
  const activeUserId = useRef(session?.user?.id || null);

  useEffect(() => {
    activeUserId.current = session?.user?.id || null;
  }, [session?.user?.id]);

  useEffect(() => {
    let alive = true;
    setState((current) => ({
      ...current,
      status: "LOADING",
      errorCode: null,
      promotionPreview: null,
      promotionBusy: false,
      promotionErrorCode: null,
      syncBusy: false,
      syncErrorCode: null,
      conflicts: [],
    }));
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
  }, [authLoading, session, retryToken]);

  const retry = useCallback(() => setRetryToken((value) => value + 1), []);
  const buildPromotionPreview = useCallback(async () => {
    const userId = activeUserId.current;
    setState((current) => ({ ...current, promotionBusy: true, promotionErrorCode: null }));
    try {
      const runtime = await getPlatformMemoryAccountRuntime();
      const preview = await runtime.buildPromotionPreview();
      if (activeUserId.current !== userId) return null;
      setState((current) => ({ ...current, promotionPreview: preview, promotionBusy: false }));
      return preview;
    } catch (error) {
      if (activeUserId.current === userId) {
        setState((current) => ({ ...current, promotionBusy: false, promotionErrorCode: error?.code || "PROMOTION_FAILED" }));
      }
      return null;
    }
  }, []);
  const cancelPromotionPreview = useCallback(() => {
    setState((current) => ({ ...current, promotionPreview: null, promotionErrorCode: null }));
  }, []);
  const promote = useCallback(async (titleChoices) => {
    const userId = activeUserId.current;
    setState((current) => ({ ...current, promotionBusy: true, promotionErrorCode: null }));
    try {
      const runtime = await getPlatformMemoryAccountRuntime();
      const next = await runtime.promote({ titleChoices });
      if (activeUserId.current !== userId) return null;
      setState((current) => ({ ...current, ...next, promotionPreview: null, promotionBusy: false }));
      return next;
    } catch (error) {
      if (activeUserId.current === userId) {
        setState((current) => ({ ...current, promotionBusy: false, promotionErrorCode: error?.code || "PROMOTION_FAILED" }));
      }
      return null;
    }
  }, []);
  const syncNow = useCallback(async () => {
    const userId = activeUserId.current;
    setState((current) => ({ ...current, syncBusy: true, syncErrorCode: null }));
    try {
      const runtime = await getPlatformMemoryAccountRuntime();
      const next = await runtime.syncNow();
      if (activeUserId.current !== userId) return null;
      setState((current) => ({ ...current, ...next, syncBusy: false }));
      return next;
    } catch (error) {
      if (activeUserId.current === userId) {
        setState((current) => ({ ...current, syncBusy: false, syncResultCode: "ERROR", syncErrorCode: error?.code || "MEMORY_GATEWAY_FAILED" }));
      }
      return null;
    }
  }, []);
  const resolveConflict = useCallback(async (conflictId, selection) => {
    const userId = activeUserId.current;
    setState((current) => ({ ...current, conflictBusy: true, syncErrorCode: null }));
    try {
      const runtime = await getPlatformMemoryAccountRuntime();
      const next = await runtime.resolveConflict({ conflictId, selection });
      if (activeUserId.current !== userId) return null;
      setState((current) => ({ ...current, ...next, conflictBusy: false }));
      return next;
    } catch (error) {
      if (activeUserId.current === userId) {
        setState((current) => ({ ...current, conflictBusy: false, syncErrorCode: error?.code || "CONFLICT_RESOLUTION_FAILED" }));
      }
      return null;
    }
  }, []);
  const exportConflictBackup = useCallback(async (conflictId) => {
    const runtime = await getPlatformMemoryAccountRuntime();
    return runtime.exportConflictBackup(conflictId);
  }, []);

  return Object.freeze({
    ...state,
    loading: state.status === "LOADING" || state.status === "INITIALIZING",
    retry,
    buildPromotionPreview,
    cancelPromotionPreview,
    promote,
    syncNow,
    resolveConflict,
    exportConflictBackup,
  });
}
