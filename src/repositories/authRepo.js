import { supabase } from "../lib/supabaseClient.js";
import {
  MOCK_AUTH_EVENT,
  clearMockAuthSession,
  readMockAuthSession,
} from "./mockAuthStorage.js";
import { resolveWebOAuthNext } from "../features/auth/webOAuth.js";
import { Capacitor } from "@capacitor/core";
import { Browser } from "@capacitor/browser";
import { startNativeGoogleOAuth } from "../features/auth/nativeOAuth.js";

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

  const safeNext = resolveWebOAuthNext({
    rawNext: next,
    origin: window.location.origin,
    base: basePath(),
  });
  if (Capacitor.isNativePlatform()) {
    return startNativeGoogleOAuth({
      supabase,
      browser: Browser,
      persistNext: persistPendingAuthNext,
      rawNext: safeNext,
      origin: window.location.origin,
      base: basePath(),
    });
  }
  persistPendingAuthNext(safeNext);
  const redirect = new URL(`${basePath()}auth/callback/`, window.location.origin);
  redirect.searchParams.set("next", safeNext);

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
