import { STORAGE_KEYS } from "../storage/keys";
import { readJson, writeJson } from "../storage/localJsonStore";
import {
  getAllSearchCacheEntriesIdb,
  putSearchCacheEntryIdb,
  replaceSearchCacheEntriesIdb,
} from "../storage/idb";

export const SEARCH_CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 3; // 3일
export const SEARCH_CACHE_MAX_ENTRIES = 120;

function normalizeRows(rows) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const now = Date.now();
  const out = [];

  for (const row of safeRows) {
    const queryKey = String(row?.queryKey || "").trim();
    const ts = Number(row?.ts);
    const results = Array.isArray(row?.results) ? row.results : null;
    if (!queryKey || !Number.isFinite(ts) || !results) continue;
    if (now - ts > SEARCH_CACHE_TTL_MS) continue;
    out.push({ queryKey, ts, results });
  }

  out.sort((a, b) => b.ts - a.ts);
  return out.slice(0, SEARCH_CACHE_MAX_ENTRIES);
}

function toMap(rows) {
  return new Map(rows.map((row) => [row.queryKey, { ts: row.ts, results: row.results }]));
}

function localRowsFromObject(obj) {
  const entries = Object.entries(obj || {}).map(([queryKey, value]) => ({
    queryKey,
    ts: Number(value?.ts),
    results: Array.isArray(value?.results) ? value.results : null,
  }));
  return normalizeRows(entries);
}

function saveLocalRows(rows) {
  const obj = Object.fromEntries(rows.map((row) => [row.queryKey, { ts: row.ts, results: row.results }]));
  writeJson(STORAGE_KEYS.searchCache, obj);
}

export async function loadSearchCacheMap() {
  try {
    const idbRows = normalizeRows(await getAllSearchCacheEntriesIdb());
    if (idbRows.length > 0) {
      saveLocalRows(idbRows);
      return toMap(idbRows);
    }
  } catch {
    // fallback to local
  }

  const localObj = readJson(STORAGE_KEYS.searchCache, {});
  const localRows = localRowsFromObject(localObj);
  saveLocalRows(localRows);
  replaceSearchCacheEntriesIdb(localRows).catch(() => {});
  return toMap(localRows);
}

export function isFreshSearchCacheEntry(entry, now = Date.now()) {
  return (
    Number.isFinite(Number(entry?.ts)) &&
    now - Number(entry.ts) <= SEARCH_CACHE_TTL_MS &&
    Array.isArray(entry?.results)
  );
}

export function setSearchCacheEntry(cacheMap, key, results) {
  const queryKey = String(key || "").trim();
  if (!queryKey || !(cacheMap instanceof Map)) return;
  cacheMap.set(queryKey, { ts: Date.now(), results: Array.isArray(results) ? results : [] });
}

export function pruneSearchCacheMap(cacheMap) {
  const rows = normalizeRows(
    [...(cacheMap instanceof Map ? cacheMap.entries() : [])].map(([queryKey, value]) => ({
      queryKey,
      ts: Number(value?.ts),
      results: Array.isArray(value?.results) ? value.results : null,
    }))
  );
  return toMap(rows);
}

export async function persistSearchCacheMap(cacheMap) {
  const pruned = pruneSearchCacheMap(cacheMap);
  const rows = [...pruned.entries()].map(([queryKey, value]) => ({
    queryKey,
    ts: Number(value?.ts),
    results: Array.isArray(value?.results) ? value.results : [],
  }));

  saveLocalRows(rows);
  if (rows.length <= 8) {
    for (const row of rows) putSearchCacheEntryIdb(row).catch(() => {});
  } else {
    replaceSearchCacheEntriesIdb(rows).catch(() => {});
  }
  return pruned;
}
