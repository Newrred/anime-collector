const HEADER_ROUTES = Object.freeze({
  "": "home", titles: "titles", title: "title", archive: "archive", boards: "boards", minihome: "boards",
  "memory/new": "memory-new", "memory/card": "memory-card", record: "record-new", library: "library",
  data: "data", help: "help", tier: "tier", profile: "profile", u: "profile", admin: "admin", moderation: "boards",
});
const SOFT_ROUTES = new Set([...Object.keys(HEADER_ROUTES), "public/home", "public/board", "catalog/detail"]);
function routePath(pathname, base) {
  const prefix = base.endsWith("/") ? base : `${base}/`;
  if (!pathname.startsWith(prefix)) return null;
  return pathname.slice(prefix.length).replace(/index\.html$/, "").replace(/\/$/, "");
}
export function appHeaderRoute(pathname, base = "/") {
  const path = routePath(pathname, base);
  return path !== null && Object.hasOwn(HEADER_ROUTES, path) ? HEADER_ROUTES[path] : null;
}
export function isSoftAppRoute(pathname, base = "/") { return SOFT_ROUTES.has(routePath(pathname, base)); }
