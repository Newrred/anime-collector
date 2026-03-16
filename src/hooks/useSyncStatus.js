import { useEffect, useMemo, useRef, useState } from "react";
import { downloadSnapshotJson, isSnapshotEffectivelyEmpty } from "../domain/snapshotCodec.js";
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
  const [meta, setMeta] = useState(readSyncMeta());
  const [remote, setRemote] = useState(null);
  const [loading, setLoading] = useState(Boolean(session?.user));
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
    const nextMeta = readSyncMeta();
    setMeta(nextMeta);
    setConflict(null);

    if (!session?.user || !isSupabaseConfigured) {
      setRemote(null);
      setRemoteMissing(false);
      setNeedsInitialUpload(false);
      setCanDownloadRemote(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [localState, remoteRow] = await Promise.all([
        buildLocalSyncState(),
        readRemoteSnapshot(session.user.id),
      ]);

      setRemote(remoteRow);
      setRemoteMissing(!remoteRow);

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
          await applyRemoteSnapshot(remoteRow);
          setMeta(readSyncMeta());
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
        await applyRemoteSnapshot(remoteRow);
        setMeta(readSyncMeta());
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
      setSyncError(error);
      setMeta(readSyncMeta());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const unsubscribe = subscribeSyncMeta((nextMeta) => setMeta(nextMeta));
    return unsubscribe;
  }, []);

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
    if (!session?.user || !isSupabaseConfigured) return null;
    if (!isOnline()) return null;

    setSyncing(true);
    clearSyncError();
    setMeta(readSyncMeta());

    try {
      const [localState, remoteRow] = await Promise.all([
        buildLocalSyncState(),
        readRemoteSnapshot(session.user.id),
      ]);
      setRemote(remoteRow);
      setRemoteMissing(!remoteRow);

      if (!remoteRow) {
        if (isSnapshotEffectivelyEmpty(localState.snapshot)) {
          setNeedsInitialUpload(false);
          return null;
        }
        setConflict(null);
        const uploaded = await uploadSnapshotToCloud(session.user.id, localState.snapshot, {
          hash: localState.hash,
        });
        setMeta(readSyncMeta());
        setNeedsInitialUpload(false);
        setRemoteMissing(false);
        return uploaded;
      }

      const lastSyncedHash = localState.meta.lastSyncedHash;
      const localEmpty = isSnapshotEffectivelyEmpty(localState.snapshot);

      if (!lastSyncedHash) {
        if (localEmpty) {
          await applyRemoteSnapshot(remoteRow);
          setMeta(readSyncMeta());
          setCanDownloadRemote(false);
          setConflict(null);
          return remoteRow;
        }
        if (remoteRow.contentHash === localState.hash) {
          if (hasLegacySources(remoteRow)) {
            const uploaded = await uploadSnapshotToCloud(session.user.id, localState.snapshot, {
              hash: localState.hash,
              remoteState: remoteRow,
            });
            setMeta(readSyncMeta());
            setConflict(null);
            return uploaded;
          }
          await applyRemoteSnapshot(remoteRow);
          setMeta(readSyncMeta());
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
        const uploaded = await uploadSnapshotToCloud(session.user.id, localState.snapshot, {
          hash: localState.hash,
        });
        setMeta(readSyncMeta());
        setConflict(null);
        return uploaded;
      }

      if (remoteChanged) {
        await applyRemoteSnapshot(remoteRow);
        setMeta(readSyncMeta());
        setConflict(null);
        return remoteRow;
      }

      if (hasLegacySources(remoteRow)) {
        const uploaded = await uploadSnapshotToCloud(session.user.id, localState.snapshot, {
          hash: localState.hash,
          remoteState: remoteRow,
        });
        setMeta(readSyncMeta());
        setConflict(null);
        return uploaded;
      }

      setConflict(null);
      setCanDownloadRemote(false);
      return remoteRow;
    } catch (error) {
      setSyncError(error);
      setMeta(readSyncMeta());
      throw error;
    } finally {
      setSyncing(false);
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
    if (!session?.user) return;
    const localState = await buildLocalSyncState();
    setSyncing(true);
    try {
      await uploadSnapshotToCloud(session.user.id, localState.snapshot, { hash: localState.hash });
      setConflict(null);
      setMeta(readSyncMeta());
      await refreshStatus();
    } finally {
      setSyncing(false);
    }
  }

  async function useCloudVersion() {
    if (!remote) return;
    setSyncing(true);
    try {
      await applyRemoteSnapshot(remote);
      setConflict(null);
      setMeta(readSyncMeta());
      await refreshStatus();
    } finally {
      setSyncing(false);
    }
  }

  async function exportConflictBackup() {
    const localState = await buildLocalSyncState();
    return downloadSnapshotJson(localState.snapshot);
  }

  const status = useMemo(
    () => deriveStatus(meta, session, conflict),
    [meta, session?.user?.id, conflict]
  );

  return {
    configured: isSupabaseConfigured,
    status,
    meta,
    remote,
    loading,
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
      clearSyncError();
      setMeta(readSyncMeta());
    },
  };
}
