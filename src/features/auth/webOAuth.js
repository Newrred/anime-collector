const MAX_CODE_LENGTH = 4096;

export class WebOAuthError extends Error {
  constructor(code) {
    super("Unable to complete account sign-in");
    this.name = "WebOAuthError";
    this.code = code;
  }
}

const fail = (code) => {
  throw new WebOAuthError(code);
};

const normalizeBase = (base) => {
  const value = String(base || "/").trim();
  const withLeadingSlash = value.startsWith("/") ? value : `/${value}`;
  return withLeadingSlash.endsWith("/") ? withLeadingSlash : `${withLeadingSlash}/`;
};

export function buildWebOAuthRedirect({ origin, base = "/" }) {
  const safeOrigin = new URL(String(origin || ""));
  return new URL(`${normalizeBase(base)}auth/callback/`, safeOrigin).toString();
}

export function resolveWebOAuthNext({ rawNext = "", pendingNext = "", origin, base = "/" }) {
  const safeOrigin = new URL(String(origin || ""));
  const appBase = normalizeBase(base);
  const fallback = `${appBase}data/`;
  const candidate = String(rawNext || pendingNext || "").trim();
  if (!candidate || candidate.startsWith("//")) return fallback;

  try {
    const resolved = new URL(candidate, safeOrigin);
    if (resolved.origin !== safeOrigin.origin) return fallback;
    const insideBase = appBase === "/"
      || resolved.pathname === appBase.slice(0, -1)
      || resolved.pathname.startsWith(appBase);
    if (!insideBase) return fallback;
    return `${resolved.pathname}${resolved.search}${resolved.hash}`;
  } catch {
    return fallback;
  }
}

export function parseWebOAuthCallback({ search = "", hash = "", origin, base = "/", pendingNext = "" }) {
  const query = new URLSearchParams(String(search || "").replace(/^\?/, ""));
  const fragment = new URLSearchParams(String(hash || "").replace(/^#/, ""));
  if (fragment.has("access_token") || fragment.has("refresh_token")) {
    fail("IMPLICIT_TOKEN_REJECTED");
  }
  if (query.has("error") || query.has("error_description")
    || fragment.has("error") || fragment.has("error_description")) {
    fail("OAUTH_PROVIDER_ERROR");
  }

  const codes = query.getAll("code");
  if (codes.length === 0 || !String(codes[0] || "").trim()) fail("AUTH_CODE_MISSING");
  const code = String(codes[0]).trim();
  if (codes.length !== 1 || code.length > MAX_CODE_LENGTH) fail("AUTH_CODE_INVALID");

  return Object.freeze({
    code,
    next: resolveWebOAuthNext({
      rawNext: query.get("next"),
      pendingNext,
      origin,
      base,
    }),
  });
}
