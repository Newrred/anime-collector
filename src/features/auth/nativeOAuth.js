import { resolveWebOAuthNext } from "./webOAuth.js";

export const NATIVE_AUTH_CALLBACK = "com.newrred.moemoa://auth/callback";
const MAX_CODE_LENGTH = 4096;

export class NativeOAuthError extends Error {
  constructor(code) {
    super("Unable to complete native account sign-in");
    this.name = "NativeOAuthError";
    this.code = code;
  }
}

const fail = (code) => { throw new NativeOAuthError(code); };

export function parseNativeAuthCallback(rawUrl) {
  try {
    const url = new URL(String(rawUrl || ""));
    if (url.protocol !== "com.newrred.moemoa:" || url.hostname !== "auth" || url.pathname !== "/callback") return null;
    if (url.username || url.password || url.port || url.hash) return null;
    if (url.searchParams.has("access_token") || url.searchParams.has("refresh_token")
      || url.searchParams.has("error") || url.searchParams.has("error_description")) return null;
    const codes = url.searchParams.getAll("code");
    const code = String(codes[0] || "").trim();
    if (codes.length !== 1 || !code || code.length > MAX_CODE_LENGTH) return null;
    return Object.freeze({ code });
  } catch {
    return null;
  }
}

export async function startNativeGoogleOAuth({
  supabase, browser, persistNext, rawNext, origin, base = "/",
}) {
  if (!supabase?.auth?.signInWithOAuth || !browser?.open) fail("NATIVE_OAUTH_UNAVAILABLE");
  const safeNext = resolveWebOAuthNext({ rawNext, origin, base });
  persistNext(safeNext);
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: NATIVE_AUTH_CALLBACK,
      skipBrowserRedirect: true,
    },
  });
  if (error) fail("OAUTH_START_FAILED");
  let authorizationUrl;
  try { authorizationUrl = new URL(String(data?.url || "")); }
  catch { fail("OAUTH_URL_INVALID"); }
  if (authorizationUrl.protocol !== "https:") fail("OAUTH_URL_INVALID");
  await browser.open({ url: authorizationUrl.toString() });
  return safeNext;
}

export async function installNativeOAuthCallback({
  app, browser, exchangeCode, consumeNext, navigate, origin, base = "/", report = () => {},
}) {
  if (!app?.addListener || !app?.getLaunchUrl || typeof exchangeCode !== "function") {
    fail("NATIVE_OAUTH_UNAVAILABLE");
  }
  const consumedCodes = new Set();
  let nextConsumed = false;
  const handle = async (rawUrl) => {
    const callback = parseNativeAuthCallback(rawUrl);
    if (!callback || consumedCodes.has(callback.code)) return Boolean(callback);
    consumedCodes.add(callback.code);
    try {
      await exchangeCode(callback.code);
      await browser?.close?.().catch(() => {});
      const pendingNext = nextConsumed ? "" : consumeNext();
      nextConsumed = true;
      navigate(resolveWebOAuthNext({ pendingNext, origin, base }));
    } catch {
      report({ code: "PKCE_EXCHANGE_FAILED" });
    }
    return true;
  };
  const listener = await app.addListener("appUrlOpen", ({ url }) => handle(url));
  const ready = Promise.resolve(app.getLaunchUrl())
    .then((launch) => launch?.url ? handle(launch.url) : false)
    .catch(() => false);
  return Object.freeze({
    ready,
    remove: () => listener.remove(),
  });
}
