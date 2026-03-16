import { supabase } from "../lib/supabaseClient.js";

function basePath() {
  const rawBase = String(import.meta.env.BASE_URL || "/");
  return rawBase.endsWith("/") ? rawBase : `${rawBase}/`;
}

export async function signInWithGoogle(next = "/data/") {
  if (!supabase) throw new Error("Supabase env missing");
  if (typeof window === "undefined") throw new Error("Window unavailable");

  const redirect = new URL(`${basePath()}auth/callback/`, window.location.origin);
  redirect.searchParams.set("next", next);

  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: redirect.toString() },
  });
  if (error) throw error;
}

export async function signOutFromCloud() {
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getAuthSession() {
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data?.session || null;
}

export function onAuthSessionChange(callback) {
  if (!supabase) return () => {};
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session || null);
  });
  return () => data.subscription.unsubscribe();
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
