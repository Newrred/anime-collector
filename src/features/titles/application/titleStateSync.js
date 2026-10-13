import { readTitleLibrary, writeTitleLibrary } from "../../../repositories/titleLibraryRepo.js";
import { readAllWatchLogsPreferred, replaceWatchLogsDurable } from "../../../repositories/watchLogRepo.js";
import { readJson, writeJson } from "../../../storage/localJsonStore.js";
import { supabase } from "../../../lib/supabaseClient.js";
import { normalizeBookshelf, readBookshelf, saveBookshelf } from "../../bookshelf/bookshelfSettings.js";
import { withTitleStateMutation } from "./titleStateMutationLock.js";

const TABLE = "user_title_sync_entities";
const BASE_KEY = "moemoa:title-sync-base:v1:";
const OWNER_KEY = "moemoa:title-sync-local-owner:v1";
const TITLE_RE = /^anime:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

const canonicalJson = value => JSON.stringify(value, function replacer(_key, current) {
  if (!current || typeof current !== "object" || Array.isArray(current)) return current;
  return Object.fromEntries(Object.entries(current).sort(([a], [b]) => a.localeCompare(b)));
});
const fingerprint = value => value == null ? null : canonicalJson(value);
const idFor = (kind, key) => `${kind}:${key}`;
const displayNameFor = (kind, payload) => kind === "bookshelf" ? "컬렉션 선반" : kind === "title" ? (payload?.koTitle || "저장 작품") : "감상 기록";

export function titleSyncKey(item) {
  const catalogId = String(item?.catalogAnimeId || "").toLowerCase();
  if (TITLE_RE.test(catalogId)) return catalogId;
  const anilistId = Number(item?.anilistId);
  return Number.isSafeInteger(anilistId) && anilistId > 0 ? `anilist:${anilistId}` : null;
}

export function makeTitleSyncLocalMap({ titles = [], watchLogs = [], bookshelf = null } = {}) {
  const entries = new Map();
  for (const item of titles) {
    const key = titleSyncKey(item);
    if (key) {
      const id = idFor("title", key);
      if (entries.has(id)) throw new Error("TITLE_SYNC_DUPLICATE_KEY");
      entries.set(id, { kind: "title", key, payload: item });
    }
  }
  for (const log of watchLogs) {
    const rawId = String(log?.id || "").trim();
    if (!rawId || rawId.length > 156) continue;
    const key = `log:${rawId}`;
    const id = idFor("watch_log", key);
    if (entries.has(id)) throw new Error("TITLE_SYNC_DUPLICATE_KEY");
    entries.set(id, { kind: "watch_log", key, payload: log });
  }
  if (bookshelf?.shelves?.length) entries.set(idFor("bookshelf", "default"), { kind: "bookshelf", key: "default", payload: normalizeBookshelf(bookshelf) });
  return entries;
}

export function planTitleSync(localEntries, remoteRows, baseline = {}) {
  const remote = new Map(remoteRows.map(row => [idFor(row.entity_kind, row.entity_key), row]));
  const keys = new Set([...localEntries.keys(), ...remote.keys(), ...Object.keys(baseline)]);
  const plan = { push: [], pull: [], acknowledge: [], conflicts: [] };
  for (const id of keys) {
    const local = localEntries.get(id) || null;
    const row = remote.get(id) || null;
    const base = baseline[id] || null;
    const localHash = fingerprint(local?.payload);
    const remoteHash = row?.deleted_at ? null : fingerprint(row?.payload);
    const remoteVersion = Number(row?.version || 0);
    const samePayload = localHash === remoteHash;
    if (!base) {
      if (!row && local) plan.push.push({ id, local, expectedVersion: 0, deleted: false });
      else if (row && !local && !row.deleted_at) plan.pull.push({ id, row, localHash });
      else if (row && local && samePayload) plan.acknowledge.push({ id, version: remoteVersion, hash: remoteHash });
      else if (row && local && !samePayload) plan.conflicts.push({ id, kind: local.kind, key: local.key, remoteVersion, localHash, displayName: displayNameFor(local.kind, local.payload) });
      continue;
    }
    if (!row) {
      plan.conflicts.push({ id, kind: local?.kind || base.kind, key: local?.key || base.key, remoteVersion: 0, localHash, displayName: displayNameFor(local?.kind || base.kind, local?.payload) });
      continue;
    }
    if (samePayload) {
      plan.acknowledge.push({ id, version: remoteVersion, hash: remoteHash });
    } else if (localHash === base.hash) {
      plan.pull.push({ id, row, localHash });
    } else if (remoteVersion === base.version) {
      const [kind, ...keyParts] = id.split(":");
      plan.push.push({ id, local: local || { kind, key: keyParts.join(":"), payload: {} }, expectedVersion: base.version, deleted: !local });
    } else {
      plan.conflicts.push({ id, kind: local?.kind || base.kind, key: local?.key || base.key, remoteVersion, localHash, displayName: displayNameFor(local?.kind || base.kind, local?.payload || row?.payload) });
    }
  }
  return plan;
}

async function readLocal(userId) {
  const [titles, watchLogs] = await Promise.all([readTitleLibrary(), readAllWatchLogsPreferred()]);
  const bookshelf = readBookshelf(`account:${userId}`);
  return { titles, watchLogs, bookshelf, entries: makeTitleSyncLocalMap({ titles, watchLogs, bookshelf }) };
}

function titleMapPreservingUnkeyed(titles) {
  return new Map(titles.map((item, index) => [titleSyncKey(item) || `local-only:${index}`, item]));
}

function readBaseline(userId) {
  const stored = readJson(`${BASE_KEY}${userId}`, {});
  return stored && typeof stored === "object" && !Array.isArray(stored) ? stored : {};
}

function saveBaseline(userId, baseline) {
  if (!writeJson(`${BASE_KEY}${userId}`, baseline)) throw new Error("TITLE_SYNC_LOCAL_STORAGE_FAILED");
}

function validateRemoteRow(row) {
  if (row.deleted_at) return;
  if (!row.payload || typeof row.payload !== "object" || Array.isArray(row.payload)) throw new Error("TITLE_SYNC_INVALID_REMOTE");
  if (row.entity_kind === "title" && titleSyncKey(row.payload) !== row.entity_key) throw new Error("TITLE_SYNC_INVALID_REMOTE");
  if (row.entity_kind === "watch_log" && `log:${String(row.payload.id || "")}` !== row.entity_key) throw new Error("TITLE_SYNC_INVALID_REMOTE");
  if (row.entity_kind === "bookshelf" && (row.entity_key !== "default" || !Array.isArray(row.payload.shelves))) throw new Error("TITLE_SYNC_INVALID_REMOTE");
}

async function readRemote(client, userId) {
  const rows = [];
  for (let start = 0; start < 50000; start += 500) {
    const { data, error } = await client.from(TABLE)
      .select("entity_kind,entity_key,payload,version,updated_at,deleted_at")
      .eq("user_id", userId).order("entity_kind").order("entity_key").range(start, start + 499);
    if (error) throw error;
    for (const row of data || []) validateRemoteRow(row);
    rows.push(...(data || []));
    if (!data || data.length < 500) return rows;
  }
  throw new Error("TITLE_SYNC_TOO_MANY_ROWS");
}

let activeRun = null;

async function assertAccount(client, userId) {
  const { data, error } = await client.auth.getSession();
  if (error || data?.session?.user?.id !== userId) throw new Error("TITLE_SYNC_ACCOUNT_CHANGED");
}

export async function syncTitleState(userId, { client = supabase, allowPromotion = false } = {}) {
  if (!userId || !client) throw new Error("TITLE_SYNC_ACCOUNT_REQUIRED");
  if (activeRun) {
    if (activeRun.userId !== userId) throw new Error("TITLE_SYNC_ACCOUNT_CHANGED");
    if (allowPromotion && !activeRun.allowPromotion) {
      await activeRun.promise;
      return syncTitleState(userId, { client, allowPromotion });
    }
    return activeRun.promise;
  }
  const run = async () => {
    await assertAccount(client, userId);
    const local = await readLocal(userId);
    const localOwner = readJson(OWNER_KEY, null);
    if (localOwner && localOwner !== userId && local.entries.size) throw new Error("TITLE_SYNC_OTHER_ACCOUNT");
    const baseline = readBaseline(userId);
    if (!localOwner && local.entries.size && !allowPromotion && Object.keys(baseline).length === 0) {
      return { uploaded: 0, downloaded: 0, conflicts: [], promotionRequired: true, localCount: local.entries.size };
    }
    if (!localOwner && !writeJson(OWNER_KEY, userId)) throw new Error("TITLE_SYNC_LOCAL_STORAGE_FAILED");
    const remoteRows = await readRemote(client, userId);
    const plan = planTitleSync(local.entries, remoteRows, baseline);
    for (const item of plan.push) {
      await assertAccount(client, userId);
      const requestId = crypto.randomUUID();
      const { data, error } = await client.rpc("apply_title_sync_entity", {
        p_kind: item.local.kind,
        p_key: item.local.key,
        p_payload: item.deleted ? {} : item.local.payload,
        p_expected_version: item.expectedVersion,
        p_deleted: item.deleted,
        p_request_id: requestId,
      });
      if (error) throw error;
      await assertAccount(client, userId);
      baseline[item.id] = { kind: item.local.kind, key: item.local.key, version: Number(data.version), hash: item.deleted ? null : fingerprint(item.local.payload) };
      saveBaseline(userId, baseline);
    }
    for (const item of plan.acknowledge) {
      const localItem = local.entries.get(item.id);
      const remoteRow = remoteRows.find(row => idFor(row.entity_kind, row.entity_key) === item.id);
      baseline[item.id] = { kind: localItem?.kind || remoteRow.entity_kind, key: localItem?.key || remoteRow.entity_key, version: item.version, hash: item.hash };
    }
    if (plan.pull.length) {
      await assertAccount(client, userId);
      await withTitleStateMutation(async () => {
      const current = await readLocal(userId);
      for (const item of plan.pull) {
        if (fingerprint(current.entries.get(item.id)?.payload) !== item.localHash) throw new Error("TITLE_SYNC_LOCAL_CHANGED");
      }
      const titles = titleMapPreservingUnkeyed(current.titles);
      const logs = new Map(current.watchLogs.map(log => [String(log.id), log]));
      let nextBookshelf = current.bookshelf;
      for (const item of plan.pull) {
        if (item.row.entity_kind === "title") {
          if (item.row.deleted_at) titles.delete(item.row.entity_key);
          else titles.set(item.row.entity_key, item.row.payload);
        } else if (item.row.entity_kind === "watch_log") {
          const logId = item.row.entity_key.slice(4);
          if (item.row.deleted_at) logs.delete(logId);
          else logs.set(logId, item.row.payload);
        } else {
          nextBookshelf = item.row.deleted_at ? { shelves: [] } : normalizeBookshelf(item.row.payload);
        }
      }
      await writeTitleLibrary([...titles.values()], { skipSyncMark: true });
      await replaceWatchLogsDurable([...logs.values()], { skipSyncMark: true });
      if (plan.pull.some(item => item.row.entity_kind === "bookshelf")) saveBookshelf(`account:${userId}`, nextBookshelf, globalThis.localStorage, { source: "sync" });
      for (const item of plan.pull) baseline[item.id] = {
        kind: item.row.entity_kind, key: item.row.entity_key,
        version: Number(item.row.version), hash: item.row.deleted_at ? null : fingerprint(item.row.payload),
      };
      globalThis.dispatchEvent?.(new Event("moemoa:library-updated"));
      });
    }
    await assertAccount(client, userId);
    saveBaseline(userId, baseline);
    if (!writeJson(OWNER_KEY, userId)) throw new Error("TITLE_SYNC_LOCAL_STORAGE_FAILED");
    return { uploaded: plan.push.length, downloaded: plan.pull.length, conflicts: plan.conflicts };
  };
  const promise = run();
  activeRun = { userId, promise, allowPromotion };
  try { return await promise; }
  finally { activeRun = null; }
}

export async function resolveTitleStateConflict(userId, conflict, choice, { client = supabase } = {}) {
  if (!userId || !client || !conflict?.id || !["local", "cloud"].includes(choice)) throw new Error("TITLE_SYNC_INVALID_RESOLUTION");
  if (activeRun) await activeRun.promise;
  await assertAccount(client, userId);
  const local = await readLocal(userId);
  const localItem = local.entries.get(conflict.id) || null;
  if (fingerprint(localItem?.payload) !== conflict.localHash) throw new Error("TITLE_SYNC_LOCAL_CHANGED");
  const rows = await readRemote(client, userId);
  const row = rows.find(item => idFor(item.entity_kind, item.entity_key) === conflict.id);
  if (!row || Number(row.version) !== Number(conflict.remoteVersion)) throw new Error("TITLE_SYNC_CONFLICT_CHANGED");
  await assertAccount(client, userId);
  const current = await readLocal(userId);
  if (fingerprint(current.entries.get(conflict.id)?.payload) !== conflict.localHash) throw new Error("TITLE_SYNC_LOCAL_CHANGED");
  const baseline = readBaseline(userId);
  if (choice === "local") {
    const { data, error } = await client.rpc("apply_title_sync_entity", {
      p_kind: conflict.kind, p_key: conflict.key,
      p_payload: localItem?.payload || {}, p_expected_version: Number(row.version),
      p_deleted: !localItem, p_request_id: crypto.randomUUID(),
    });
    if (error) throw error;
    await assertAccount(client, userId);
    baseline[conflict.id] = { kind: conflict.kind, key: conflict.key, version: Number(data.version), hash: fingerprint(localItem?.payload) };
  } else {
    await withTitleStateMutation(async () => {
    const latest = await readLocal(userId);
    if (fingerprint(latest.entries.get(conflict.id)?.payload) !== conflict.localHash) throw new Error("TITLE_SYNC_LOCAL_CHANGED");
    const titles = titleMapPreservingUnkeyed(latest.titles);
    const logs = new Map(latest.watchLogs.map(log => [String(log.id), log]));
    if (row.entity_kind === "title") {
      if (row.deleted_at) titles.delete(row.entity_key);
      else titles.set(row.entity_key, row.payload);
      await writeTitleLibrary([...titles.values()], { skipSyncMark: true });
    } else if (row.entity_kind === "watch_log") {
      const logId = row.entity_key.slice(4);
      if (row.deleted_at) logs.delete(logId);
      else logs.set(logId, row.payload);
      await replaceWatchLogsDurable([...logs.values()], { skipSyncMark: true });
    } else {
      saveBookshelf(`account:${userId}`, row.deleted_at ? { shelves: [] } : row.payload, globalThis.localStorage, { source: "sync" });
    }
    await assertAccount(client, userId);
    baseline[conflict.id] = { kind: row.entity_kind, key: row.entity_key, version: Number(row.version), hash: row.deleted_at ? null : fingerprint(row.payload) };
    globalThis.dispatchEvent?.(new Event("moemoa:library-updated"));
    });
  }
  saveBaseline(userId, baseline);
  return baseline[conflict.id];
}
