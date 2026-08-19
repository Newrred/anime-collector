import { createClient } from "@supabase/supabase-js";

export function resolveCatalogSupabaseConfig(env = {}) {
  const url = typeof env.PUBLIC_CATALOG_SUPABASE_URL === "string"
    ? env.PUBLIC_CATALOG_SUPABASE_URL.trim().replace(/\/+$/u, "")
    : "";
  const publishableKey = typeof env.PUBLIC_CATALOG_SUPABASE_ANON_KEY === "string"
    ? env.PUBLIC_CATALOG_SUPABASE_ANON_KEY.trim()
    : "";
  try {
    if (!url || new URL(url).protocol !== "https:" || !publishableKey) return null;
  } catch {
    return null;
  }
  return Object.freeze({ url, publishableKey });
}

const env = (typeof import.meta !== "undefined" && import.meta?.env) ? import.meta.env : {};
const config = resolveCatalogSupabaseConfig(env);

export const isCatalogSupabaseConfigured = Boolean(config);
export const catalogSupabase = config
  ? createClient(config.url, config.publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    })
  : null;
