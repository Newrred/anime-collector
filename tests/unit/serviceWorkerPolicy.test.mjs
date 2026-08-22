import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const serviceWorkerSource = await readFile(new URL("../../public/sw.js", import.meta.url), "utf8");

function loadServiceWorker({ match, fetch = async () => { throw new Error("offline"); } } = {}) {
  const listeners = new Map();
  const addAllCalls = [];
  const cache = {
    addAll: async (urls) => { addAllCalls.push(urls); },
    put: async () => {},
  };
  const caches = {
    open: async () => cache,
    keys: async () => [],
    delete: async () => true,
    match: match || (async () => null),
  };
  const self = {
    registration: { scope: "https://example.test/app/" },
    location: { origin: "https://example.test" },
    clients: { claim() {} },
    skipWaiting() {},
    addEventListener(name, listener) { listeners.set(name, listener); },
  };

  vm.runInNewContext(serviceWorkerSource, { self, caches, fetch, URL, Promise });
  return { listeners, addAllCalls };
}

test("service worker precaches every private memory route shell", async () => {
  const { listeners, addAllCalls } = loadServiceWorker();
  let installWork;
  listeners.get("install")({ waitUntil(promise) { installWork = promise; } });
  await installWork;

  assert.equal(addAllCalls.length, 1);
  assert.deepEqual(
    Array.from(addAllCalls[0], String).filter((url) => url.includes("/archive/") || url.includes("/memory/")),
    [
      "https://example.test/app/archive/",
      "https://example.test/app/memory/new/",
      "https://example.test/app/memory/card/",
    ],
  );
});

test("offline memory-card deep links reuse the cached route while preserving the id in the browser URL", async () => {
  const detailShell = { page: "memory-card" };
  const homeShell = { page: "home" };
  const { listeners } = loadServiceWorker({
    match: async (request, options = {}) => {
      const rawUrl = typeof request === "string" ? request : request.url;
      const url = new URL(rawUrl);
      if (options.ignoreSearch && url.pathname === "/app/memory/card/") return detailShell;
      if (url.pathname === "/app/index.html") return homeShell;
      return null;
    },
  });
  let responsePromise;
  listeners.get("fetch")({
    request: {
      method: "GET",
      mode: "navigate",
      url: "https://example.test/app/memory/card/?id=card-123",
    },
    respondWith(promise) { responsePromise = promise; },
  });

  assert.equal(await responsePromise, detailShell);
});

test("authentication parameters always bypass the cache even on a memory route", async () => {
  const networkResponse = { page: "network-only" };
  let cacheReads = 0;
  const { listeners } = loadServiceWorker({
    fetch: async () => networkResponse,
    match: async () => {
      cacheReads += 1;
      return { page: "cached" };
    },
  });
  let responsePromise;
  listeners.get("fetch")({
    request: {
      method: "GET",
      mode: "navigate",
      url: "https://example.test/app/memory/card/?access_token=private-token",
    },
    respondWith(promise) { responsePromise = promise; },
  });

  assert.equal(await responsePromise, networkResponse);
  assert.equal(cacheReads, 0);
});
