import { useEffect, useMemo, useRef, useState } from "react";
import { downloadSnapshotJson, isSnapshotEffectivelyEmpty } from "../domain/snapshotCodec.js";
import { hasSuccessfulRemoteCheck } from "../domain/syncPresentation.js";
import {
  applyRemoteSnapshot,
  buildLocalSyncState,
  clearSyncError,
  readRemoteSnapshot,
  readSyncMeta,
  setSyncError,
  subscribeSyncMeta,
  uploadSnapshotToCloud,
} from "../repositories/syncRepo.js";
import { isSupabaseConfigured } from "../lib/supabaseClient.js";
import { createSyncOperationCoordinator } from "../services/syncOperationCoordinator.js";

function isOnline() {
  return typeof navigator === "undefined" ? true : navigator.onLine !== false;
}

function hasLegacySources(remote) {
  const sources = remote?.legacySources;
  if (!sources || typeof sources !== "object") return false;
  return Object.values(sources).some((value) => value === true);
}

function deriveStatus(meta, session, conflict) {
  if (!isSupabaseConfigured) return "disabled";
  if (!session?.user) return "offline-local";
  if (conflict) return "conflict";
  if (meta.lastError) return "error";
  if (meta.pending) return "pending";
  if (meta.lastSyncedAt) return "synced";
  return "connected";
}

export function useSyncStatus({ session, autoSync = false } = {}) {
  const currentUserId = session?.user?.id || null;
  const [meta, setMeta] = useState(() => readSyncMeta(currentUserId));
  const [remote, setRemote] = useState(null);
  const [loading, setLoading] = useState(Boolean(session?.user));
  const [successfulRemoteUserId, setSuccessfulRemoteUserId] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [conflict, setConflict] = useState(null);
  const [remoteMissing, setRemoteMissing] = useState(false);
  const [needsInitialUpload, setNeedsInitialUpload] = useState(false);
  const [canDownloadRemote, setCanDownloadRemote] = useState(false);
  const debounceRef = useRef(null);
  const syncNowRef = useRef(null);
  const metaRef = useRef(meta);
  const syncingRef = useRef(syncing);
  const conflictRef = useRef(conflict);
  const sessionRef = useRef(session);
  const autoSyncRef = useRef(autoSync);
  const syncStatusRequestGenerationRef = useRef(0);
  const operationCoordinatorRef = useRef(null);

  if (!operationCoordinatorRef.current) {
    operationCoordinatorRef.current = createSyncOperationCoordinator(currentUserId);
  }
  operationCoordinatorRef.current.updateUserId(currentUserId);

  useEffect(() => {
    metaRef.current = meta;
  }, [meta]);

  useEffect(() => {
    syncingRef.current = syncing;
  }, [syncing]);

  useEffect(() => {
    conflictRef.current = conflict;
  }, [conflict]);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    autoSyncRef.current = autoSync;
  }, [autoSync]);

  async function refreshStatus() {
    const requestId = syncStatusRequestGenerationRef.current + 1;
    const capturedUserId = session?.user?.id || null;
    const operationToken = operationCoordinatorRef.current.begin(capturedUserId, "refreshStatus");
    syncStatusRequestGenerationRef.current = requestId;
    const isCurrentRequest = () =>
      requestId === syncStatusRequestGenerationRef.current &&
      operationCoordinatorRef.current.isCurrent(operationToken);
    const nextMeta = readSyncMeta(capturedUserId);

    if (!capturedUserId || !isSupabaseConfigured) {
      if (!isCurrentRequest()) return;
      setMeta(nextMeta);
      setConflict(null);
      setRemote(null);
      setSuccessfulRemoteUserId(null);
      setRemoteMissing(false);
      setNeedsInitialUpload(false);
      setCanDownloadRemote(false);
      setLoading(false);
      return;
    }

    if (!isCurrentRequest()) return;
    setMeta(nextMeta);
    setConflict(null);
    setLoading(true);
    setSuccessfulRemoteUserId(null);
    try {
      const [localState, remoteRow] = await Promise.all([
        buildLocalSyncState(capturedUserId),
        readRemoteSnapshot(capturedUserId),
      ]);

      if (!isCurrentRequest()) return;
      setRemote(remoteRow);
      setRemoteMissing(!remoteRow);
      setSuccessfulRemoteUserId(capturedUserId);

      if (!remoteRow) {
        setCanDownloadRemote(false);
        setNeedsInitialUpload(!isSnapshotEffectivelyEmpty(localState.snapshot));
        setLoading(false);
        return;
      }

      const localEmpty = isSnapshotEffectivelyEmpty(localState.snapshot);
      const lastSyncedHash = nextMeta.lastSyncedHash;
      const localChanged = nextMeta.pending || !lastSyncedHash || localState.hash !== lastSyncedHash;
      const remoteChanged = !lastSyncedHash || remoteRow.contentHash !== lastSyncedHash;

      setNeedsInitialUpload(false);
      setCanDownloadRemote(localEmpty && remoteRow.contentHash !== localState.hash);

      if (!lastSyncedHash) {
        if (localEmpty && autoSync) {
          const applied = await operationCoordinatorRef.current.runMutation(
            operationToken,
            () => applyRemoteSnapshot(remoteRow, { userId: capturedUserId }),
          );
          if (!applied.executed) return;
          if (!isCurrentRequest()) return;
          setMeta(readSyncMeta(capturedUserId));
          setConflict(null);
          setCanDownloadRemote(false);
          setLoading(false);
          return;
        }
        if (!localEmpty && remoteRow.contentHash !== localState.hash) {
          setConflict({
            kind: "first-sync",
            localHash: localState.hash,
            remoteHash: remoteRow.contentHash,
            remoteUpdatedAt: remoteRow.updatedAt,
          });
        }
        setLoading(false);
        return;
      }

      if (!localChanged && remoteChanged && autoSync) {
        const applied = await operationCoordinatorRef.current.runMutation(
          operationToken,
          () => applyRemoteSnapshot(remoteRow, { userId: capturedUserId }),
        );
        if (!applied.executed) return;
        if (!isCurrentRequest()) return;
        setMeta(readSyncMeta(capturedUserId));
        setConflict(null);
        setCanDownloadRemote(false);
        setLoading(false);
        return;
      }

      if (localChanged && remoteChanged && remoteRow.contentHash !== localState.hash) {
        setConflict({
          kind: "diverged",
          localHash: localState.hash,
          remoteHash: remoteRow.contentHash,
          remoteUpdatedAt: remoteRow.updatedAt,
        });
      }
    } catch (error) {
      if (!isCurrentRequest()) return;
      setSyncError(error, capturedUserId);
      setMeta(readSyncMeta(capturedUserId));
    } finally {
      if (isCurrentRequest()) setLoading(false);
    }
  }

  useEffect(() => {
    const unsubscribe = subscribeSyncMeta((nextMeta) => setMeta(nextMeta), currentUserId);
    return unsubscribe;
  }, [currentUserId]);

  useEffect(() => {
    syncStatusRequestGenerationRef.current += 1;
    setMeta(readSyncMeta(currentUserId));
    setSuccessfulRemoteUserId(null);
    setRemote(null);
    setRemoteMissing(false);
    setNeedsInitialUpload(false);
    setCanDownloadRemote(false);
    setConflict(null);
    setSyncing(false);
    setLoading(Boolean(session?.user) && isSupabaseConfigured);
  }, [currentUserId]);

  useEffect(() => {
    refreshStatus().catch(() => {});
  }, [session?.user?.id]);

  useEffect(() => {
    function onOnline() {
      refreshStatus().catch(() => {});
    }
    if (typeof window === "undefined") return () => {};
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [session?.user?.id]);

  useEffect(() => {
    if (!autoSync || !session?.user || !meta.pending || syncing || conflict || !isOnline()) return undefined;
    if (debounceRef.current) {
      window.clearTimeout(debounceRef.current);
    }
    debounceRef.current = window.setTimeout(() => {
      debounceRef.current = null;
      syncNow().catch(() => {});
    }, 12000);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [autoSync, session?.user?.id, meta.pending, meta.lastLocalMutationAt, syncing, conflict]);

  async function syncNow() {
    const capturedUserId = session?.user?.id || null;
    if (!capturedUserId || !isSupabaseConfigured) return null;
    if (!isOnline()) return null;
    const operationToken = operationCoordinatorRef.current.begin(capturedUserId, "syncNow");
    const isCurrentOperation = () => operationCoordinatorRef.current.isCurrent(operationToken);
    if (!isCurrentOperation()) return null;

    setSyncing(true);
    setSuccessfulRemoteUserId(null);
    clearSyncError(capturedUserId);
    setMeta(readSyncMeta(capturedUserId));

    try {
      const [localState, remoteRow] = await Promise.all([
        buildLocalSyncState(capturedUserId),
        readRemoteSnapshot(capturedUserId),
      ]);
      if (!isCurrentOperation()) return null;
      setRemote(remoteRow);
      setRemoteMissing(!remoteRow);
      setSuccessfulRemoteUserId(capturedUserId);

      if (!remoteRow) {
        if (isSnapshotEffectivelyEmpty(localState.snapshot)) {
          setNeedsInitialUpload(false);
          return null;
        }
        setConflict(null);
        const result = await operationCoordinatorRef.current.runMutation(
          operationToken,
          () => uploadSnapshotToCloud(capturedUserId, localState.snapshot, {
            hash: localState.hash,
            remoteState: remoteRow,
            canMutate: isCurrentOperation,
          }),
        );
        if (!result.executed || !isCurrentOperation()) return null;
        setMeta(readSyncMeta(capturedUserId));
        setNeedsInitialUpload(false);
        setRemoteMissing(false);
        return result.value;
      }

      const lastSyncedHash = localState.meta.lastSyncedHash;
      const localEmpty = isSnapshotEffectivelyEmpty(localState.snapshot);

      if (!lastSyncedHash) {
        if (localEmpty) {
          const result = await operationCoordinatorRef.current.runMutation(
            operationToken,
            () => applyRemoteSnapshot(remoteRow, { userId: capturedUserId }),
          );
          if (!result.executed || !isCurrentOperation()) return null;
          setMeta(readSyncMeta(capturedUserId));
          setCanDownloadRemote(false);
          setConflict(null);
          return remoteRow;
        }
        if (remoteRow.contentHash === localState.hash) {
          if (hasLegacySources(remoteRow)) {
            const result = await operationCoordinatorRef.current.runMutation(
              operationToken,
              () => uploadSnapshotToCloud(capturedUserId, localState.snapshot, {
                hash: localState.hash,
                remoteState: remoteRow,
                canMutate: isCurrentOperation,
              }),
            );
            if (!result.executed || !isCurrentOperation()) return null;
            setMeta(readSyncMeta(capturedUserId));
            setConflict(null);
            return result.value;
          }
          const result = await operationCoordinatorRef.current.runMutation(
            operationToken,
            () => applyRemoteSnapshot(remoteRow, { userId: capturedUserId }),
          );
          if (!result.executed || !isCurrentOperation()) return null;
          setMeta(readSyncMeta(capturedUserId));
          setCanDownloadRemote(false);
          setConflict(null);
          return remoteRow;
        }
        setConflict({
          kind: "first-sync",
          localHash: localState.hash,
          remoteHash: remoteRow.contentHash,
          remoteUpdatedAt: remoteRow.updatedAt,
        });
        return null;
      }

      const localChanged = localState.meta.pending || localState.hash !== lastSyncedHash;
      const remoteChanged = remoteRow.contentHash !== lastSyncedHash;

      if (localChanged && remoteChanged && remoteRow.contentHash !== localState.hash) {
        setConflict({
          kind: "diverged",
          localHash: localState.hash,
          remoteHash: remoteRow.contentHash,
          remoteUpdatedAt: remoteRow.updatedAt,
        });
        return null;
      }

      if (localChanged) {
        const result = await operationCoordinatorRef.current.runMutation(
          operationToken,
          () => uploadSnapshotToCloud(capturedUserId, localState.snapshot, {
            hash: localState.hash,
            remoteState: remoteRow,
            canMutate: isCurrentOperation,
          }),
        );
        if (!result.executed || !isCurrentOperation()) return null;
        setMeta(readSyncMeta(capturedUserId));
        setConflict(null);
        return result.value;
      }

      if (remoteChanged) {
        const result = await operationCoordinatorRef.current.runMutation(
          operationToken,
          () => applyRemoteSnapshot(remoteRow, { userId: capturedUserId }),
        );
        if (!result.executed || !isCurrentOperation()) return null;
        setMeta(readSyncMeta(capturedUserId));
        setConflict(null);
        return remoteRow;
      }

      if (hasLegacySources(remoteRow)) {
        const result = await operationCoordinatorRef.current.runMutation(
          operationToken,
          () => uploadSnapshotToCloud(capturedUserId, localState.snapshot, {
            hash: localState.hash,
            remoteState: remoteRow,
            canMutate: isCurrentOperation,
          }),
        );
        if (!result.executed || !isCurrentOperation()) return null;
        setMeta(readSyncMeta(capturedUserId));
        setConflict(null);
        return result.value;
      }

      setConflict(null);
      setCanDownloadRemote(false);
      return remoteRow;
    } catch (error) {
      if (!isCurrentOperation()) return null;
      setSyncError(error, capturedUserId);
      setMeta(readSyncMeta(capturedUserId));
      throw error;
    } finally {
      if (isCurrentOperation()) setSyncing(false);
    }
  }

  useEffect(() => {
    syncNowRef.current = syncNow;
  }, [syncNow]);

  function canAutoFlush() {
    return (
      autoSyncRef.current &&
      Boolean(sessionRef.current?.user) &&
      metaRef.current?.pending === true &&
      !syncingRef.current &&
      !conflictRef.current &&
      isOnline()
    );
  }

  function flushPendingSync() {
    if (!canAutoFlush()) return;
    if (debounceRef.current) {
      window.clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    syncNowRef.current?.().catch(() => {});
  }

  useEffect(() => {
    if (typeof document === "undefined" || typeof window === "undefined") return () => {};

    function onVisibilityChange() {
      if (document.visibilityState === "hidden") {
        flushPendingSync();
      }
    }

    function onPageHide() {
      flushPendingSync();
    }

    function onBeforeUnload() {
      flushPendingSync();
    }

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, []);

  async function keepLocalVersion() {
    const capturedUserId = session?.user?.id || null;
    if (!capturedUserId) return null;
    const operationToken = operationCoordinatorRef.current.begin(capturedUserId, "keepLocalVersion");
    const isCurrentOperation = () => operationCoordinatorRef.current.isCurrent(operationToken);
    if (!isCurrentOperation()) return null;
    setSyncing(true);
    try {
      const [localState, remoteState] = await Promise.all([
        buildLocalSyncState(capturedUserId),
        readRemoteSnapshot(capturedUserId),
      ]);
      if (!isCurrentOperation()) return null;
      const result = await operationCoordinatorRef.current.runMutation(
        operationToken,
        () => uploadSnapshotToCloud(capturedUserId, localState.snapshot, {
          hash: localState.hash,
          remoteState,
          canMutate: isCurrentOperation,
        }),
      );
      if (!result.executed || !isCurrentOperation()) return null;
      setConflict(null);
      setMeta(readSyncMeta(capturedUserId));
      await refreshStatus();
      return result.value;
    } finally {
      if (isCurrentOperation()) setSyncing(false);
    }
  }

  async function useCloudVersion() {
    const capturedUserId = session?.user?.id || null;
    if (!capturedUserId || !remote || remote?.userId !== capturedUserId) return null;
    const operationToken = operationCoordinatorRef.current.begin(capturedUserId, "useCloudVersion");
    const isCurrentOperation = () => operationCoordinatorRef.current.isCurrent(operationToken);
    if (!isCurrentOperation()) return null;
    setSyncing(true);
    try {
      const result = await operationCoordinatorRef.current.runMutation(
        operationToken,
        () => applyRemoteSnapshot(remote, { userId: capturedUserId }),
      );
      if (!result.executed || !isCurrentOperation()) return null;
      setConflict(null);
      setMeta(readSyncMeta(capturedUserId));
      await refreshStatus();
      return result.value;
    } finally {
      if (isCurrentOperation()) setSyncing(false);
    }
  }

  async function exportConflictBackup() {
    const localState = await buildLocalSyncState(currentUserId);
    return downloadSnapshotJson(localState.snapshot);
  }

  const status = useMemo(
    () => deriveStatus(meta, session, conflict),
    [meta, session?.user?.id, conflict]
  );
  const remoteChecked = hasSuccessfulRemoteCheck({
    configured: isSupabaseConfigured,
    connected: Boolean(session?.user),
    currentUserId: session?.user?.id,
    successfulUserId: successfulRemoteUserId,
  });

  return {
    configured: isSupabaseConfigured,
    status,
    meta,
    remote,
    loading,
    remoteChecked,
    syncing,
    conflict,
    remoteMissing,
    needsInitialUpload,
    canDownloadRemote,
    syncNow,
    refreshStatus,
    keepLocalVersion,
    useCloudVersion,
    exportConflictBackup,
    dismissConflict: () => setConflict(null),
    clearError: () => {
      clearSyncError(currentUserId);
      setMeta(readSyncMeta(currentUserId));
    },
  };
}
