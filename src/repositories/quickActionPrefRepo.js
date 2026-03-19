import { STORAGE_KEYS } from "../storage/keys.js";

const DEFAULT_STATUS = "미분류";
const RECENT_LIMIT = 8;

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function readQuickAddStatus() {
  if (!canUseStorage()) return DEFAULT_STATUS;
  try {
    return localStorage.getItem(STORAGE_KEYS.quickAddStatus) || DEFAULT_STATUS;
  } catch {
    return DEFAULT_STATUS;
  }
}

export function writeQuickAddStatus(status) {
  if (!canUseStorage()) return;
  try {
    localStorage.setItem(STORAGE_KEYS.quickAddStatus, String(status || DEFAULT_STATUS));
  } catch {}
}

export function readQuickSearchRecent() {
  if (!canUseStorage()) return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.quickSearchRecent);
    const arr = JSON.parse(raw || "[]");
    return Array.isArray(arr) ? arr.filter(Boolean).slice(0, RECENT_LIMIT) : [];
  } catch {
    return [];
  }
}

export function pushQuickSearchRecent(query) {
  const trimmed = String(query || "").trim();
  if (!trimmed) return readQuickSearchRecent();
  if (!canUseStorage()) return [trimmed];

  const next = [trimmed, ...readQuickSearchRecent().filter((value) => value !== trimmed)]
    .filter(Boolean)
    .slice(0, RECENT_LIMIT);

  try {
    localStorage.setItem(STORAGE_KEYS.quickSearchRecent, JSON.stringify(next));
  } catch {}

  return next;
}
