import { readJson, writeJson } from "../storage/localJsonStore.js";

const MOCK_AUTH_SESSION_KEY = "moemoa.e2e.mockSession.v1";
const MOCK_PROFILE_STORE_KEY = "moemoa.e2e.profileStore.v1";
const MOCK_PUBLIC_SHOWCASE_STORE_KEY = "moemoa.e2e.publicShowcaseStore.v1";
const MOCK_FOLLOWERS_STORE_KEY = "moemoa.e2e.followersStore.v1";
const MOCK_SHOWCASE_LAYOUT_STORE_KEY = "moemoa.e2e.showcaseLayoutStore.v1";
export const MOCK_AUTH_EVENT = "moemoa:mock-auth-change";

function canUseStorage() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function emitMockAuthChange() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(MOCK_AUTH_EVENT));
}

function removeStorageKey(key) {
  if (!canUseStorage()) return;
  try {
    localStorage.removeItem(key);
  } catch {}
}

function normalizeSession(raw) {
  if (!raw || typeof raw !== "object") return null;
  const user = raw.user && typeof raw.user === "object" ? raw.user : null;
  const userId = String(user?.id || "").trim();
  if (!userId) return null;

  return {
    access_token: String(raw.access_token || "mock-access-token"),
    refresh_token: String(raw.refresh_token || "mock-refresh-token"),
    token_type: "bearer",
    expires_in: Number(raw.expires_in || 3600),
    expires_at: Number(raw.expires_at || Math.floor(Date.now() / 1000) + 3600),
    user: {
      id: userId,
      email: String(user?.email || "").trim() || null,
      app_metadata: user?.app_metadata && typeof user.app_metadata === "object" ? user.app_metadata : {},
      user_metadata: user?.user_metadata && typeof user.user_metadata === "object" ? user.user_metadata : {},
      aud: String(user?.aud || "authenticated"),
      role: String(user?.role || "authenticated"),
    },
  };
}

function readStore(key) {
  return readJson(key, {});
}

function writeStore(key, value) {
  writeJson(key, value && typeof value === "object" ? value : {});
}

function readUserScopedValue(key, userId, fallbackValue = null) {
  const safeUserId = String(userId || "").trim();
  if (!safeUserId) return fallbackValue;
  const store = readStore(key);
  return store[safeUserId] ?? fallbackValue;
}

function writeUserScopedValue(key, userId, value) {
  const safeUserId = String(userId || "").trim();
  if (!safeUserId) return;
  const store = readStore(key);
  store[safeUserId] = value;
  writeStore(key, store);
}

export function readMockAuthSession() {
  return normalizeSession(readJson(MOCK_AUTH_SESSION_KEY, null));
}

export function hasMockAuthSession() {
  return Boolean(readMockAuthSession()?.user?.id);
}

export function writeMockAuthSession(session) {
  const normalized = normalizeSession(session);
  if (!normalized) {
    clearMockAuthSession();
    return;
  }
  writeJson(MOCK_AUTH_SESSION_KEY, normalized);
  emitMockAuthChange();
}

export function clearMockAuthSession() {
  removeStorageKey(MOCK_AUTH_SESSION_KEY);
  emitMockAuthChange();
}

export function readMockProfileRow(userId) {
  return readUserScopedValue(MOCK_PROFILE_STORE_KEY, userId, null);
}

export function writeMockProfileRow(userId, profile) {
  writeUserScopedValue(MOCK_PROFILE_STORE_KEY, userId, profile);
}

export function readMockPublicShowcaseSnapshot(userId) {
  return readUserScopedValue(MOCK_PUBLIC_SHOWCASE_STORE_KEY, userId, null);
}

export function writeMockPublicShowcaseSnapshot(userId, snapshot) {
  writeUserScopedValue(MOCK_PUBLIC_SHOWCASE_STORE_KEY, userId, snapshot);
}

export function readMockShowcaseLayout(userId) {
  return readUserScopedValue(MOCK_SHOWCASE_LAYOUT_STORE_KEY, userId, null);
}

export function writeMockShowcaseLayout(userId, layout) {
  writeUserScopedValue(MOCK_SHOWCASE_LAYOUT_STORE_KEY, userId, layout);
}

export function listMockFollowers(userId) {
  return readUserScopedValue(MOCK_FOLLOWERS_STORE_KEY, userId, []);
}

export function setMockFollowers(userId, rows) {
  writeUserScopedValue(MOCK_FOLLOWERS_STORE_KEY, userId, Array.isArray(rows) ? rows : []);
}
