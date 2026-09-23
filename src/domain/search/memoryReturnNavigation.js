const origin = "https://moemoa.invalid";
const normalizeBase = (base) => `${String(base || "/").replace(/\/$/, "")}/`;
const routes = new Set(["", "archive/", "boards/", "title/", "titles/", "library/", "tier/"]);
export function safeMemoryReturn(value, base = "/") {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || /[\\\r\n]/.test(value) || value.length > 3000) return null;
  try {
    const url = new URL(value, origin);
    const root = normalizeBase(base);
    if (url.origin !== origin || !url.pathname.startsWith(root)) return null;
    const route = url.pathname.slice(root.length).replace(/index\.html$/, "");
    if (!routes.has(route)) return null;
    for (const key of ["returnTo", "returnY", "restoreY", "code", "access_token", "refresh_token", "error_description"]) url.searchParams.delete(key);
    return `${url.pathname}${url.search}`;
  } catch { return null; }
}
export function memoryReturnHref(search, base = "/") {
  const params = new URLSearchParams(search || "");
  const safe = safeMemoryReturn(params.get("returnTo"), base);
  if (!safe) return `${normalizeBase(base)}archive/`;
  const url = new URL(safe, origin);
  const y = Number(params.get("returnY"));
  if (Number.isFinite(y) && y > 0 && y <= 200000) url.searchParams.set("restoreY", String(Math.round(y)));
  return `${url.pathname}${url.search}`;
}
export function addMemoryReturn(href, locationHref, scrollY = 0, base = "/") {
  const current = new URL(locationHref);
  const target = new URL(href, current);
  const root = normalizeBase(base);
  if (target.origin !== current.origin || ![`${root}memory/new/`, `${root}memory/card/`, `${root}memory/new/index.html`, `${root}memory/card/index.html`].includes(target.pathname)) return href;
  const from = safeMemoryReturn(`${current.pathname}${current.search}`, base);
  if (!from) return href;
  target.searchParams.set("returnTo", from);
  target.searchParams.set("returnY", String(Math.min(200000, Math.max(0, Math.round(scrollY)))));
  return `${target.pathname}${target.search}${target.hash}`;
}
