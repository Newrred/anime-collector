const CATALOG_ANIME_ID = /^anime:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function joinBase(base, path) {
  const normalized = String(base || "/").endsWith("/") ? String(base || "/") : `${base}/`;
  return `${normalized}${path}`;
}

export function toPlatformAppHref(href, { native = false, origin = "https://localhost" } = {}) {
  if (!native) return href;
  const url = new URL(href, origin);
  if (url.origin !== origin || !url.pathname.endsWith("/")) return href;
  url.pathname = `${url.pathname}index.html`;
  return `${url.pathname}${url.search}${url.hash}`;
}

export function handleNativeAppLinkClick(event, {
  native = false,
  origin = "https://localhost",
  assign = (href) => window.location.assign(href),
} = {}) {
  if (!native || event?.defaultPrevented || event?.button !== 0
    || event?.metaKey || event?.ctrlKey || event?.shiftKey || event?.altKey) return false;
  const anchor = event?.target?.closest?.("a[href]");
  if (!anchor || (anchor.target && anchor.target !== "_self") || anchor.hasAttribute?.("download")) return false;
  const href = String(anchor.getAttribute?.("href") || "").trim();
  if (!href || href.startsWith("#")) return false;
  const resolved = new URL(href, origin);
  if (resolved.origin !== origin) return false;
  const target = toPlatformAppHref(href, { native: true, origin });
  if (target === href) return false;
  event.preventDefault?.();
  event.stopImmediatePropagation?.();
  assign(target);
  return true;
}

export function installNativeAppLinkNavigation({
  native = false,
  documentRef = document,
  locationRef = window.location,
} = {}) {
  if (!native) return () => {};
  const listener = (event) => handleNativeAppLinkClick(event, {
    native: true,
    origin: locationRef.origin,
    assign: (href) => locationRef.assign(href),
  });
  documentRef.addEventListener("click", listener, true);
  return () => documentRef.removeEventListener("click", listener, true);
}

export function buildMemoryCardHref({ base = "/", native = false, row } = {}) {
  const params = new URLSearchParams();
  const catalogAnimeId = String(row?.catalogAnimeId || "").trim();
  const title = String(row?.title || "").trim();
  if (CATALOG_ANIME_ID.test(catalogAnimeId)) params.set("animeId", catalogAnimeId);
  if (title) params.set("title", title);
  const query = params.toString();
  const href = `${joinBase(base, "memory/new/")}${query ? `?${query}` : ""}`;
  return toPlatformAppHref(href, { native });
}
