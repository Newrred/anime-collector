import { supabase } from "../lib/supabaseClient.js";
import {
  MOCK_AUTH_EVENT,
  clearMockAuthSession,
  readMockAuthSession,
} from "./mockAuthStorage.js";

const AUTH_NEXT_STORAGE_KEY = "auth.redirect.next";

function basePath() {
  const rawBase = String(import.meta.env.BASE_URL || "/");
  return rawBase.endsWith("/") ? rawBase : `${rawBase}/`;
}

function persistPendingAuthNext(next) {
  if (typeof window === "undefined") return;
  try {
    const value = String(next || "").trim();
    if (!value) {
      window.localStorage.removeItem(AUTH_NEXT_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(AUTH_NEXT_STORAGE_KEY, value);
  } catch {
    // Ignore storage failures and keep auth flow going.
  }
}

export function consumePendingAuthNext() {
  if (typeof window === "undefined") return "";
  try {
    const value = String(window.localStorage.getItem(AUTH_NEXT_STORAGE_KEY) || "").trim();
    window.localStorage.removeItem(AUTH_NEXT_STORAGE_KEY);
    return value;
  } catch {
    return "";
  }
}

export async function signInWithGoogle(next = "/data/") {
  if (!supabase) throw new Error("Supabase env missing");
  if (typeof window === "undefined") throw new Error("Window unavailable");

  persistPendingAuthNext(next);
  const redirect = new URL(`${basePath()}auth/callback/`, window.location.origin);
  redirect.searchParams.set("next", next);

  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: redirect.toString() },
  });
  if (error) throw error;
}

export async function signOutFromCloud() {
  if (readMockAuthSession()) {
    clearMockAuthSession();
    return;
  }
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getAuthSession() {
  const mockSession = readMockAuthSession();
  if (mockSession) return mockSession;
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data?.session || null;
}

export function onAuthSessionChange(callback) {
  function onMockAuthChange() {
    callback(readMockAuthSession());
  }

  if (typeof window !== "undefined") {
    window.addEventListener(MOCK_AUTH_EVENT, onMockAuthChange);
  }

  let unsubscribeSupabase = () => {};
  if (supabase) {
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      callback(session || null);
    });
    unsubscribeSupabase = () => data.subscription.unsubscribe();
  }

  return () => {
    if (typeof window !== "undefined") {
      window.removeEventListener(MOCK_AUTH_EVENT, onMockAuthChange);
    }
    unsubscribeSupabase();
  };
}

export async function exchangeCodeForSession(code) {
  if (!supabase) throw new Error("Supabase env missing");
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) throw error;
  return data?.session || null;
}

export async function setAuthSession(tokens) {
  if (!supabase) throw new Error("Supabase env missing");
  const accessToken = String(tokens?.access_token || "").trim();
  const refreshToken = String(tokens?.refresh_token || "").trim();
  if (!accessToken || !refreshToken) {
    throw new Error("Missing session tokens");
  }
  const { data, error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  if (error) throw error;
  return data?.session || null;
}
