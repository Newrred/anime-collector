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
  const activeUserId = useRef({ userId: session?.user?.id || null });
  const previewRequest = useRef(0);

  useEffect(() => {
    activeUserId.current = { userId: session?.user?.id || null };
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
      syncResultCode: null,
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
        if (!alive) return null;
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
    const request = ++previewRequest.current;
    const userId = activeUserId.current;
    setState((current) => ({ ...current, promotionBusy: true, promotionErrorCode: null }));
    try {
      const runtime = await getPlatformMemoryAccountRuntime();
      if (activeUserId.current !== userId || request !== previewRequest.current) return null;
      const preview = await runtime.buildPromotionPreview();
      if (activeUserId.current !== userId || request !== previewRequest.current) return null;
      setState((current) => ({ ...current, promotionPreview: preview, promotionBusy: false }));
      return preview;
    } catch (error) {
      if (activeUserId.current === userId && request === previewRequest.current) {
        setState((current) => ({ ...current, promotionBusy: false, promotionErrorCode: error?.code || "PROMOTION_FAILED" }));
      }
      return null;
    }
  }, []);
  const cancelPromotionPreview = useCallback(() => {
    previewRequest.current++;
    getPlatformMemoryAccountRuntime().then(runtime => runtime.cancelPromotionPreview?.()).catch(() => {});
    setState((current) => ({ ...current, promotionPreview: null, promotionErrorCode: null }));
  }, []);
  const promote = useCallback(async (titleChoices) => {
    const userId = activeUserId.current;
    setState((current) => ({ ...current, promotionBusy: true, promotionErrorCode: null }));
    try {
      const runtime = await getPlatformMemoryAccountRuntime();
      if (activeUserId.current !== userId) return null;
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
    setState((current) => ({ ...current, syncBusy: true, syncResultCode: null, syncErrorCode: null }));
    try {
      const runtime = await getPlatformMemoryAccountRuntime();
      if (activeUserId.current !== userId) return null;
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
      if (activeUserId.current !== userId) return null;
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
    const userId = activeUserId.current;
    const runtime = await getPlatformMemoryAccountRuntime();
    if (activeUserId.current !== userId) return null;
    const backup = await runtime.exportConflictBackup(conflictId);
    return activeUserId.current === userId ? backup : null;
  }, []);

  const visibleState = state.userId && (authLoading || state.userId !== session?.user?.id)
    ? { ...INITIAL_STATE, enabled: state.enabled } : state;
  return Object.freeze({
    ...visibleState,
    loading: visibleState.status === "LOADING" || visibleState.status === "INITIALIZING",
    retry,
    buildPromotionPreview,
    cancelPromotionPreview,
    promote,
    syncNow,
    pauseSync: async () => (await getPlatformMemoryAccountRuntime()).pauseSync?.(),
    resolveConflict,
    exportConflictBackup,
  });
}
