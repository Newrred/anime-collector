import type { Page } from "@playwright/test";

type AppState = {
  locale?: "en" | "ko";
  list?: unknown[];
  watchLogs?: unknown[];
  mediaById?: Record<string, unknown>;
};

export async function installAppState(page: Page, state: AppState = {}) {
  await page.addInitScript((seed) => {
    localStorage.setItem("ui:locale:v1", JSON.stringify(seed.locale ?? "en"));
    localStorage.setItem("anime:list:v1", JSON.stringify(seed.list ?? []));
    localStorage.setItem("anime:watchLogs:v1", JSON.stringify(seed.watchLogs ?? []));
    const mediaCache = Object.fromEntries(
      Object.entries(seed.mediaById ?? {}).map(([id, media]) => [id, { ts: Date.now(), media }]),
    );
    localStorage.setItem("anime:mediaCache:v1", JSON.stringify(mediaCache));
  }, state);
}

export async function clearAppState(page: Page) {
  await page.addInitScript(() => {
    localStorage.clear();
    indexedDB.deleteDatabase("anime-collector-db");
  });
}
