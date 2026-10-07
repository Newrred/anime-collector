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
export function titleReturnHref(search, base = "/") {
  const params = new URLSearchParams(search || "");
  const safe = safeMemoryReturn(params.get("returnTo"), base);
  if (!safe || [`${normalizeBase(base)}title/`, `${normalizeBase(base)}title/index.html`].includes(new URL(safe, origin).pathname)) return `${normalizeBase(base)}titles/`;
  const url = new URL(safe, origin);
  const y = Number(params.get("returnY"));
  if (Number.isFinite(y) && y > 0 && y <= 200000) url.searchParams.set("restoreY", String(Math.round(y)));
  return `${url.pathname}${url.search}`;
}
export function addMemoryReturn(href, locationHref, scrollY = 0, base = "/") {
  const current = new URL(locationHref);
  const target = new URL(href, current);
  const root = normalizeBase(base);
  if (target.origin !== current.origin || ![`${root}record/`, `${root}record/index.html`, `${root}memory/new/`, `${root}memory/card/`, `${root}memory/new/index.html`, `${root}memory/card/index.html`, `${root}title/`, `${root}title/index.html`].includes(target.pathname)) return href;
  if (current.pathname === target.pathname && (target.pathname === `${root}title/` || target.pathname === `${root}title/index.html`)) return href;
  const isRecordEntry = [ `${root}record/`, `${root}record/index.html` ].includes(current.pathname);
  const provided = [`${root}titles/`, `${root}titles/index.html`].includes(current.pathname)
    ? safeMemoryReturn(target.searchParams.get("returnTo"), base) : null;
  const from = provided || safeMemoryReturn(isRecordEntry ? current.searchParams.get("returnTo") : `${current.pathname}${current.search}`, base);
  if (!from) return href;
  const y = isRecordEntry ? Number(current.searchParams.get("returnY")) || 0 : scrollY;
  target.searchParams.set("returnTo", from);
  target.searchParams.set("returnY", String(Math.min(200000, Math.max(0, Math.round(y)))));
  return `${target.pathname}${target.search}${target.hash}`;
}
