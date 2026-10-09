import { privateImageReadCache } from '../features/memory/adapters/platform/privateImageReadCache.js';
import { supabase } from "../lib/supabaseClient.js";
import {
  MOCK_AUTH_EVENT,
  clearMockAuthSession,
  readMockAuthSession,
} from "./mockAuthStorage.js";
import {
  buildWebOAuthRedirect,
  resolveWebOAuthNext,
} from "../features/auth/webOAuth.js";
import { Capacitor } from "@capacitor/core";
import { Browser } from "@capacitor/browser";
import { startNativeGoogleOAuth } from "../features/auth/nativeOAuth.js";
import { clearPendingSignup } from '../features/auth/simpleSignup.js';

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
  if (typeof window !== 'undefined' && !Capacitor.isNativePlatform() && import.meta.env.PUBLIC_SIMPLE_SIGNUP_V1 === '1') {
    const safeNext = resolveWebOAuthNext({ rawNext: next, origin: window.location.origin, base: basePath() });
    window.location.assign(`${basePath()}auth/start/?next=${encodeURIComponent(safeNext)}`);
    return;
  }
  return startGoogleOAuth(next);
}

export async function startGoogleOAuth(next = "/data/", declaration) {
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
  if (import.meta.env.PUBLIC_SIMPLE_SIGNUP_V1 === '1') {
    const response=await fetch('/api/signup?action=start',{method:'POST',credentials:'same-origin',
      headers:{'Content-Type':'application/json'},body:JSON.stringify({declaration,next:safeNext})});
    const data=await response.json();
    if(!response.ok||!data.url)throw Object.assign(new Error('Signup failed'),{code:data.error});
    const target=new URL(data.url);
    if(target.origin!=='https://accounts.google.com'||target.pathname!=='/o/oauth2/v2/auth')throw new Error('Invalid sign-in destination');
    window.location.assign(target.toString());return;
  }
  persistPendingAuthNext(safeNext);
  const redirectTo = buildWebOAuthRedirect({
    origin: window.location.origin,
    base: basePath(),
  });

  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo, queryParams: { prompt: "select_account" } },
  });
  if (error) throw error;
}

export async function signOutFromCloud() {
  try { if (typeof window !== 'undefined') clearPendingSignup(window.sessionStorage); }
  catch { /* Storage restrictions must never prevent signing out. */ }
  privateImageReadCache.clear();
  if (readMockAuthSession()) {
    clearMockAuthSession();
    return;
  }
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

function rememberSession(session) {
  privateImageReadCache.setOwner(session?.user?.id ? `account:${session.user.id}` : null);
  return session;
}

export async function getAuthSession() {
  const mockSession = readMockAuthSession();
  if (mockSession) return rememberSession(mockSession);
  if (!supabase) return rememberSession(null);
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return rememberSession(data?.session || null);
}

export function onAuthSessionChange(callback) {
  function onMockAuthChange() {
    callback(rememberSession(readMockAuthSession()));
  }

  if (typeof window !== "undefined") {
    window.addEventListener(MOCK_AUTH_EVENT, onMockAuthChange);
  }

  let unsubscribeSupabase = () => {};
  if (supabase) {
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      callback(rememberSession(session || null));
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
  return rememberSession(data?.session || null);
}
