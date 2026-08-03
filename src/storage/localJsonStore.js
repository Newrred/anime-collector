function canUseStorage() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

export function readJson(key, fallbackValue) {
  if (!canUseStorage()) return fallbackValue;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallbackValue;
  } catch {
    return fallbackValue;
  }
}

export function writeJson(key, value) {
  if (!canUseStorage()) return false;
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function hasStoredValue(key) {
  if (!canUseStorage()) return false;
  try {
    return localStorage.getItem(key) !== null;
  } catch {
    return false;
  }
}

export function readString(key, fallbackValue = "") {
  if (!canUseStorage()) return fallbackValue;
  try {
    const raw = localStorage.getItem(key);
    return raw ?? fallbackValue;
  } catch {
    return fallbackValue;
  }
}

export function writeString(key, value) {
  if (!canUseStorage()) return;
  try {
    localStorage.setItem(key, String(value));
  } catch {}
}

