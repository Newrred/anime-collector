// Replaced in dist by finalize-service-worker.mjs, never by modifying user data.
const CACHE_PREFIX = "moemoa-static-";
const CACHE_NAME = `${CACHE_PREFIX}__MOEMOA_BUILD__`;
const SHELL_PATHS = ["./", "./tier/", "./library/", "./archive/",
  "./boards/", "./memory/new/", "./memory/card/", "./title/", "./titles/"];
const STATIC_PATHS = ["./manifest.webmanifest", "./favicon.ico", "./favicon.svg"];
const scoped = (path) => new URL(path, self.registration.scope).href;
const shells = new Set(SHELL_PATHS.map(scoped));
const fixedAssets = new Set(STATIC_PATHS.map(scoped));
const cacheable = (response) => response.ok && !response.redirected
  && response.type !== "opaque"
  && !/no-store|private/i.test(response.headers.get("cache-control") || "")
  && response.headers.get("vary") !== "*";
const sensitive = (request, url) => request.headers.has("authorization")
  || request.cache === "no-store"
  || ["code", "access_token", "refresh_token", "error_description"].some((key) => url.searchParams.has(key));

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    // Only known build-generated static shells; never store a user's navigation response.
    for (const href of [...shells, ...fixedAssets]) {
      const response = await fetch(href, { cache: "reload", credentials: "omit" });
      if (!cacheable(response)) throw new Error("STATIC_SHELL_UNAVAILABLE");
      await cache.put(href, response);
    }
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) {
      if ((name.startsWith(CACHE_PREFIX) || /^ani-site-cache-v\d+$/.test(name)) && name !== CACHE_NAME) {
        await caches.delete(name);
      }
    }
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  const bare = `${url.origin}${url.pathname}`;
  const isShell = request.mode === "navigate" && shells.has(bare);
  const isAsset = !url.search && (fixedAssets.has(url.href)
    || (url.pathname.startsWith(new URL("./_astro/", self.registration.scope).pathname)
      && /\.(?:js|css|woff2?)$/.test(url.pathname)));
  if (sensitive(request, url) || (!isShell && !isAsset)) {
    // Account/API/public media/version responses never enter CacheStorage or HTTP cache.
    event.respondWith(fetch(request, { cache: "no-store" }));
    return;
  }
  if (isShell) {
    event.respondWith(fetch(request, { cache: "no-store" }).catch(async () => {
      const cached = await (await caches.open(CACHE_NAME)).match(bare);
      return cached || Response.error();
    }));
    return;
  }
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    if (cacheable(response)) await cache.put(request, response.clone());
    return response;
  })());
});
