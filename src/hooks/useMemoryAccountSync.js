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
const pausedAutoUsers = new Set();

function startAutoMemorySync(userId, syncNow) {
  let active = true;
  let timer = null;
  let running = false;
  let changedWhileRunning = false;
  const schedule = (delay = 900) => {
    if (!active || pausedAutoUsers.has(userId)) return;
    if (running) { changedWhileRunning = true; return; }
    if (timer) clearTimeout(timer);
    timer = setTimeout(async () => {
      timer = null;
      if (!active || pausedAutoUsers.has(userId) || navigator.onLine === false || document.visibilityState === "hidden") return;
      running = true;
      const result = await syncNow({ resumeAuto: false });
      running = false;
      if (!active || pausedAutoUsers.has(userId)) return;
      if (changedWhileRunning) {
        changedWhileRunning = false;
        schedule(250);
      } else if (result?.syncResultCode === "PARTIAL") schedule(5000);
    }, delay);
  };
  const onMutation = (event) => {
    if (event.detail?.ownerId === `account:${userId}`) schedule(350);
  };
  const onResume = () => schedule(350);
  schedule(350);
  const interval = setInterval(() => schedule(900), 45000);
  globalThis.addEventListener("moemoa:memory-updated", onMutation);
  globalThis.addEventListener("online", onResume);
  globalThis.addEventListener("focus", onResume);
  return () => {
    active = false;
    if (timer) clearTimeout(timer);
    clearInterval(interval);
    globalThis.removeEventListener("moemoa:memory-updated", onMutation);
    globalThis.removeEventListener("online", onResume);
    globalThis.removeEventListener("focus", onResume);
  };
}

export function useMemoryAccountSync({ session, authLoading = false, autoSync = false, initialSync = false } = {}) {
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
        if (session?.user?.id) {
          const ready = await runtime.initializeAccountSession(session);
          if (initialSync && navigator.onLine !== false && ["ACCOUNT_READY", "PROMOTION_AVAILABLE"].includes(ready?.status)) {
            await runtime.syncNow().catch(() => null);
          }
          return runtime.getState();
        }
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
  }, [authLoading, session, retryToken, initialSync]);

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
  const syncNow = useCallback(async ({ resumeAuto = true } = {}) => {
    const userId = activeUserId.current;
    if (resumeAuto && userId.userId) pausedAutoUsers.delete(userId.userId);
    setState((current) => ({ ...current, syncBusy: true, syncResultCode: null, syncErrorCode: null }));
    globalThis.dispatchEvent?.(new CustomEvent("moemoa:memory-sync-state", { detail: { userId: userId.userId, state: { syncBusy: true, syncResultCode: null, syncErrorCode: null } } }));
    try {
      const runtime = await getPlatformMemoryAccountRuntime();
      if (activeUserId.current !== userId) return null;
      const next = await runtime.syncNow();
      if (activeUserId.current !== userId) return null;
      let photoCompleted = 0;
      if (["SYNCED", "PARTIAL"].includes(next?.syncResultCode) && userId.userId) {
        try {
          const { drainPlatformPrivatePhotos } = await import("../features/memory/runtime/platformPrivateImages.js");
          photoCompleted = (await drainPlatformPrivatePhotos(userId.userId)).completed;
        } catch {
          // The durable photo intent is retried on the next online/focus sync.
        }
      }
      if (activeUserId.current !== userId) return null;
      setState((current) => ({ ...current, ...next, syncBusy: false }));
      globalThis.dispatchEvent?.(new CustomEvent("moemoa:memory-sync-state", { detail: { userId: userId.userId, state: next, photoCompleted } }));
      return next;
    } catch (error) {
      if (activeUserId.current === userId) {
        const failure = { syncBusy: false, syncResultCode: "ERROR", syncErrorCode: error?.code || "MEMORY_GATEWAY_FAILED" };
        setState((current) => ({ ...current, ...failure }));
        globalThis.dispatchEvent?.(new CustomEvent("moemoa:memory-sync-state", { detail: { userId: userId.userId, state: failure } }));
      }
      return null;
    }
  }, []);

  useEffect(() => {
    const userId = session?.user?.id;
    if (!autoSync || !userId || authLoading || !["ACCOUNT_READY", "PROMOTION_AVAILABLE"].includes(state.status)
      || state.userId !== userId) return undefined;
    return startAutoMemorySync(userId, syncNow);
  }, [autoSync, authLoading, session?.user?.id, state.status, state.userId, syncNow]);

  useEffect(() => {
    const onSyncState = (event) => {
      if (event.detail?.userId === session?.user?.id) setState((current) => ({ ...current, ...event.detail.state }));
    };
    globalThis.addEventListener("moemoa:memory-sync-state", onSyncState);
    return () => globalThis.removeEventListener("moemoa:memory-sync-state", onSyncState);
  }, [session?.user?.id]);
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
    pauseSync: async () => {
      if (activeUserId.current.userId) pausedAutoUsers.add(activeUserId.current.userId);
      return (await getPlatformMemoryAccountRuntime()).pauseSync?.();
    },
    resolveConflict,
    exportConflictBackup,
  });
}
